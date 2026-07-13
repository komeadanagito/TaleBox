import { NextRequest, NextResponse } from "next/server";
import { getEnv, loadPrompt, thinkingRequestOptions } from "../../env";
import { parseModelJSON, renderPrompt } from "../helpers";
import { CHUNK_MAX_OUTPUT_TOKENS, CHUNK_REQUEST_TIMEOUT_MS } from "../../../../lib/import-novel/compiler/constants";
import type { AiNarrativeMode, NovelChoice, NovelStoryBlock, StoryKnowledgeEdge, StoryKnowledgeNode, StoryRuntimeMemory, StoryRuntimeSnapshot } from "../../../../lib/import-novel/types";

type JsonObject = Record<string, unknown>;

function safeRuntimeContext(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "{}";
  const text = JSON.stringify(value);
  if (text.length > 8000) throw new Error("故事运行上下文过大");
  return text;
}

function buildRuntimeSnapshot(input: {
  previous: unknown;
  roleId: string;
  roleName: string;
  selectedChoice: string;
  narrativeMode: AiNarrativeMode;
  sourceParagraphIds: string[];
  location: string;
  blocks: NovelStoryBlock[];
}): StoryRuntimeSnapshot {
  const previous = input.previous && typeof input.previous === "object" && !Array.isArray(input.previous) ? input.previous as Partial<StoryRuntimeSnapshot> : {};
  const previousMemories = Array.isArray(previous.memories) ? previous.memories.filter((item): item is StoryRuntimeMemory => Boolean(item && typeof item.content === "string")).slice(-7) : [];
  const previousNodes = Array.isArray(previous.graph?.nodes) ? previous.graph.nodes.filter((item): item is StoryKnowledgeNode => Boolean(item && typeof item.id === "string" && typeof item.label === "string")).slice(-24) : [];
  const previousEdges = Array.isArray(previous.graph?.edges) ? previous.graph.edges.filter((item): item is StoryKnowledgeEdge => Boolean(item && typeof item.id === "string")).slice(-36) : [];
  const presentCharacterNames = [...new Set([input.roleName, ...input.blocks.flatMap((block) => block.type === "dialogue" || block.type === "action" ? [block.speaker] : [])])];
  const locationId = input.location ? `location:${encodeURIComponent(input.location)}` : "";
  const nodeMap = new Map(previousNodes.map((node) => [node.id, node]));
  for (const name of presentCharacterNames) {
    const id = `character:${encodeURIComponent(name)}`;
    nodeMap.set(id, { id, type: "character", label: name, sourceParagraphIds: input.sourceParagraphIds });
  }
  if (input.location) nodeMap.set(locationId, { id: locationId, type: "location", label: input.location, sourceParagraphIds: input.sourceParagraphIds });
  const edgeMap = new Map(previousEdges.map((edge) => [edge.id, edge]));
  if (locationId) for (const name of presentCharacterNames) {
    const fromNodeId = `character:${encodeURIComponent(name)}`;
    const id = `${fromNodeId}:位于:${locationId}`;
    edgeMap.set(id, { id, fromNodeId, relation: "位于", toNodeId: locationId, sourceParagraphIds: input.sourceParagraphIds });
  }
  const memory: StoryRuntimeMemory = {
    id: crypto.randomUUID(), kind: "decision", content: input.selectedChoice,
    sourceParagraphIds: input.sourceParagraphIds, createdAt: new Date().toISOString(),
  };
  const previousInventory = Array.isArray(previous.state?.inventory) ? previous.state.inventory.filter((item): item is string => typeof item === "string").slice(0, 24) : [];
  return {
    version: Math.max(0, Number(previous.version) || 0) + 1,
    agent: { roleId: input.roleId, roleName: input.roleName, activeGoal: input.selectedChoice, narrativeMode: input.narrativeMode, sourceParagraphIds: input.sourceParagraphIds },
    state: { location: input.location, presentCharacterNames, inventory: previousInventory, activeGoals: [input.selectedChoice] },
    memories: [...previousMemories, memory],
    graph: { nodes: [...nodeMap.values()].slice(-24), edges: [...edgeMap.values()].slice(-36) },
  };
}

function normalizeResult(parsed: JsonObject, isFinal: boolean, characterNames: string[], currentLocation: string, narrativeMode: "faithful" | "free") {
  const rawLocation = typeof parsed.location === "string" ? parsed.location.trim() : "";
  if (rawLocation.length > 48) throw new Error("AI地点文本无效");
  const location = rawLocation || currentLocation;
  if (!Array.isArray(parsed.blocks) || parsed.blocks.length < 1 || parsed.blocks.length > 8) throw new Error("AI叙事段落数量无效");
  const blocks = parsed.blocks.map((item): NovelStoryBlock => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("AI叙事段落格式无效");
    const row = item as JsonObject;
    const text = typeof row.text === "string" ? row.text.trim() : "";
    if (!text || text.length > 1200) throw new Error("AI叙事文本无效");
    if (row.type === "dialogue" || row.type === "action") {
      const speaker = typeof row.speaker === "string" ? row.speaker.trim() : "";
      if (!speaker || !characterNames.includes(speaker)) throw new Error(`AI叙事人物不在角色档案中: ${speaker || "空"}`);
      return { type: row.type, speaker, text };
    }
    if (row.type !== "narration" || row.speaker !== null) throw new Error("AI旁白格式无效");
    return { type: "narration", text };
  });
  if (!Array.isArray(parsed.choices)) throw new Error("AI选项格式无效");
  const choices = parsed.choices.slice(0, 3).map((item, index): NovelChoice => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("AI选项格式无效");
    const row = item as JsonObject;
    const kind = row.kind;
    if (kind !== "observe" && kind !== "focus" && kind !== "act" && kind !== "speak" && kind !== "explore") throw new Error("AI选项类型无效");
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const hint = typeof row.hint === "string" ? row.hint.trim() : "";
    if (!label || label.length > 80 || hint.length > 120) throw new Error("AI选项文本无效");
    return { id: `ai-choice-${index + 1}`, kind, label, hint, doesNotChangeCanon: kind !== "explore" };
  });
  if (isFinal && choices.length > 0) throw new Error("最后窗口不能返回选项");
  if (!isFinal && (choices.length < 2 || choices.length > 3)) throw new Error("AI选项数量无效");
  if (!isFinal && narrativeMode === "faithful" && choices.some((choice) => choice.kind === "explore")) {
    throw new Error("遵循原作模式不能返回探索选项");
  }
  return { location, blocks, choices: isFinal ? [] : choices };
}

async function requestModel(baseUrl: string, apiKey: string, model: string, systemPrompt: string, userPrompt: string) {
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(CHUNK_REQUEST_TIMEOUT_MS),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      ...thinkingRequestOptions(baseUrl),
      max_tokens: CHUNK_MAX_OUTPUT_TOKENS,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    }),
  });
  const data = await response.json() as JsonObject;
  if (!response.ok) throw new Error(typeof (data.error as JsonObject | undefined)?.message === "string" ? (data.error as JsonObject).message as string : "AI叙事请求失败");
  const choices = Array.isArray(data.choices) ? data.choices : [];
  const first = choices[0] as JsonObject | undefined;
  const message = first?.message as JsonObject | undefined;
  if (typeof message?.content !== "string" || !message.content.trim()) throw new Error("AI没有返回叙事内容");
  console.log("[AI-Turn Output]:", message.content);
  return message.content;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as JsonObject;
    const chapterTitle = typeof body.chapterTitle === "string" ? body.chapterTitle.trim() : "";
    const roleName = typeof body.roleName === "string" ? body.roleName.trim() : "";
    const roleId = typeof body.roleId === "string" ? body.roleId.trim().slice(0, 100) : roleName;
    const selectedChoice = typeof body.selectedChoice === "string" ? body.selectedChoice.trim() : "进入本章";
    const selectedChoiceKind = body.selectedChoiceKind === "explore" ? "explore" : "canon";
    const narrativeMode = body.narrativeMode === "free" ? "free" : "faithful";
    const currentLocation = typeof body.currentLocation === "string" ? body.currentLocation.trim().slice(0, 48) : "";
    const characterNames = Array.isArray(body.characterNames)
      ? [...new Set(body.characterNames.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()))].slice(0, 12)
      : [];
    const isFinal = body.isFinal === true;
    const sourceParagraphs = Array.isArray(body.sourceParagraphs) ? body.sourceParagraphs : [];
    if (!chapterTitle || !roleName || selectedChoice.length > 120 || !characterNames.includes(roleName) || sourceParagraphs.length === 0 || sourceParagraphs.length > 8) return NextResponse.json({ error: "AI叙事请求格式无效" }, { status: 400 });
    const source = sourceParagraphs.map((item) => {
      const row = item as JsonObject;
      if (typeof row.id !== "string" || typeof row.text !== "string" || !row.text.trim()) throw new Error("原文窗口格式无效");
      return `[${row.id}] ${row.text}`;
    }).join("\n");
    const sourceParagraphIds = sourceParagraphs.map((item) => String((item as JsonObject).id));
    const runtimeContext = safeRuntimeContext(body.previousRuntime);
    const recentDecisions = Array.isArray(body.recentDecisions) ? body.recentDecisions.filter((item): item is string => typeof item === "string").slice(-3).join("；") : "无";
    const apiKey = getEnv("LLM_API_KEY");
    const baseUrl = getEnv("LLM_BASE_URL");
    const model = getEnv("LLM_IMPORT_AI_MODEL") || getEnv("LLM_IMPORT_MODEL") || getEnv("LLM_MODEL");
    if (!apiKey || !baseUrl || !model) throw new Error("缺少AI叙事模型配置");
    const systemPrompt = loadPrompt("novel-ai-turn.system.md");
    const retryPrompt = loadPrompt("novel-ai-turn.retry.md");
    const userPrompt = renderPrompt(loadPrompt("novel-ai-turn.user.md"), {
      CHAPTER_TITLE: chapterTitle,
      ROLE_NAME: roleName,
      CHARACTER_NAMES: characterNames.join("、"),
      CURRENT_LOCATION: currentLocation || "尚未明确",
      SELECTED_CHOICE: selectedChoice || "进入本章",
      SELECTED_CHOICE_KIND: selectedChoiceKind === "explore" ? "探索剧情" : "沿原著推进",
      NARRATIVE_MODE: narrativeMode === "free" ? "自由探索" : "遵循原作",
      RECENT_DECISIONS: recentDecisions || "无",
      IS_FINAL: isFinal ? "是" : "否",
      SOURCE_PARAGRAPHS: source,
      STORY_RUNTIME: runtimeContext,
    });
    try {
      const result = normalizeResult(parseModelJSON(await requestModel(baseUrl, apiKey, model, systemPrompt, userPrompt)), isFinal, characterNames, currentLocation, narrativeMode);
      const runtimeSnapshot = buildRuntimeSnapshot({ previous: body.previousRuntime, roleId, roleName, selectedChoice, narrativeMode, sourceParagraphIds, location: result.location, blocks: result.blocks });
      return NextResponse.json({ result: { ...result, runtimeSnapshot } });
    } catch (err) {
      console.warn("[AI-Turn First Attempt Error]:", err instanceof Error ? err.message : err);
      try {
        const retried = await requestModel(baseUrl, apiKey, model, systemPrompt, `${userPrompt}\n\n${retryPrompt}`);
        const result = normalizeResult(parseModelJSON(retried), isFinal, characterNames, currentLocation, narrativeMode);
        const runtimeSnapshot = buildRuntimeSnapshot({ previous: body.previousRuntime, roleId, roleName, selectedChoice, narrativeMode, sourceParagraphIds, location: result.location, blocks: result.blocks });
        return NextResponse.json({ result: { ...result, runtimeSnapshot } });
      } catch (retryErr) {
        console.error("[AI-Turn Retry Attempt Error]:", retryErr instanceof Error ? retryErr.message : retryErr);
        throw retryErr;
      }
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI叙事失败" }, { status: 500 });
  }
}
