import { NextRequest, NextResponse } from "next/server";
import { getEnv, loadPrompt } from "../../env";
import { parseModelJSON, renderPrompt } from "../helpers";
import { CHUNK_MAX_OUTPUT_TOKENS, CHUNK_REQUEST_TIMEOUT_MS } from "../../../../lib/import-novel/compiler/constants";
import type { NovelChoice, NovelStoryBlock } from "../../../../lib/import-novel/types";

type JsonObject = Record<string, unknown>;

function normalizeResult(parsed: JsonObject, isFinal: boolean, characterNames: string[], currentLocation: string) {
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
    if (kind !== "observe" && kind !== "focus" && kind !== "act" && kind !== "speak") throw new Error("AI选项类型无效");
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const hint = typeof row.hint === "string" ? row.hint.trim() : "";
    if (!label || label.length > 80 || hint.length > 120) throw new Error("AI选项文本无效");
    return { id: `ai-choice-${index + 1}`, kind, label, hint, doesNotChangeCanon: true };
  });
  if (isFinal && choices.length > 0) throw new Error("最后窗口不能返回选项");
  if (!isFinal && choices.length < 2) throw new Error("AI选项数量不足");
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
      enable_thinking: false,
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
    const selectedChoice = typeof body.selectedChoice === "string" ? body.selectedChoice.trim() : "进入本章";
    const currentLocation = typeof body.currentLocation === "string" ? body.currentLocation.trim().slice(0, 48) : "";
    const characterNames = Array.isArray(body.characterNames)
      ? [...new Set(body.characterNames.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()))].slice(0, 12)
      : [];
    const isFinal = body.isFinal === true;
    const sourceParagraphs = Array.isArray(body.sourceParagraphs) ? body.sourceParagraphs : [];
    if (!chapterTitle || !roleName || !characterNames.includes(roleName) || sourceParagraphs.length === 0 || sourceParagraphs.length > 8) return NextResponse.json({ error: "AI叙事请求格式无效" }, { status: 400 });
    const source = sourceParagraphs.map((item) => {
      const row = item as JsonObject;
      if (typeof row.id !== "string" || typeof row.text !== "string" || !row.text.trim()) throw new Error("原文窗口格式无效");
      return `[${row.id}] ${row.text}`;
    }).join("\n");
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
      RECENT_DECISIONS: recentDecisions || "无",
      IS_FINAL: isFinal ? "是" : "否",
      SOURCE_PARAGRAPHS: source,
    });
    try {
      return NextResponse.json({ result: normalizeResult(parseModelJSON(await requestModel(baseUrl, apiKey, model, systemPrompt, userPrompt)), isFinal, characterNames, currentLocation) });
    } catch (err) {
      console.warn("[AI-Turn First Attempt Error]:", err instanceof Error ? err.message : err);
      try {
        const retried = await requestModel(baseUrl, apiKey, model, systemPrompt, `${userPrompt}\n\n${retryPrompt}`);
        return NextResponse.json({ result: normalizeResult(parseModelJSON(retried), isFinal, characterNames, currentLocation) });
      } catch (retryErr) {
        console.error("[AI-Turn Retry Attempt Error]:", retryErr instanceof Error ? retryErr.message : retryErr);
        throw retryErr;
      }
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI叙事失败" }, { status: 500 });
  }
}
