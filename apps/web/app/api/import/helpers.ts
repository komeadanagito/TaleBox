import type { ChapterAnalysis, ChapterTurnResult, NovelChoice, NovelStoryBlock, StoryBeat } from "../../../lib/import-novel/types";

export function parseModelJSON(raw: string) {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("模型没有返回 JSON 对象");
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function blocks(value: unknown): NovelStoryBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): NovelStoryBlock[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const type = row.type;
    const content = text(row.text);
    if (!content) return [];
    if (type === "dialogue" || type === "action") return [{ type, speaker: text(row.speaker, "角色"), text: content }];
    return [{ type: "narration", text: content }];
  }).slice(0, 8);
}

function choices(value: unknown): NovelChoice[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index): NovelChoice[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const label = text(row.label);
    if (!label) return [];
    return [{ id: text(row.id, `choice-${index + 1}`), label, hint: text(row.hint) }];
  }).slice(0, 4);
}

function beats(value: unknown, paragraphIds: string[]): StoryBeat[] {
  if (!Array.isArray(value)) return [];
  const validIds = new Set(paragraphIds);
  return value.flatMap((item, index): StoryBeat[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const startParagraphId = text(row.startParagraphId);
    const endParagraphId = text(row.endParagraphId);
    if (!validIds.has(startParagraphId) || !validIds.has(endParagraphId)) return [];
    const characterIds = Array.isArray(row.characterIds) ? row.characterIds.filter((id): id is string => typeof id === "string") : [];
    return [{ id: text(row.id, `beat-${index + 1}`), order: index + 1, title: text(row.title, `剧情节点 ${index + 1}`), summary: text(row.summary), startParagraphId, endParagraphId, location: text(row.location), characterIds, required: row.required !== false, completionCondition: text(row.completionCondition, "完成当前核心事件") }];
  }).sort((a, b) => paragraphIds.indexOf(a.startParagraphId) - paragraphIds.indexOf(b.startParagraphId)).slice(0, 12).map((beat, index) => ({ ...beat, order: index + 1 }));
}

export function normalizeAnalysis(parsed: Record<string, unknown>, paragraphIds: string[]): ChapterAnalysis {
  const rawCharacters = Array.isArray(parsed.characters) ? parsed.characters : [];
  const characters = rawCharacters.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const name = text(row.name);
    if (!name) return [];
    return [{
      id: text(row.id, `character-${index + 1}`).replace(/[^a-zA-Z0-9\u4e00-\u9fa5-]/g, "-"),
      name,
      role: text(row.role, "本章角色"),
      description: text(row.description),
      status: row.status === "continuing" ? "continuing" as const : "entering" as const,
      playable: row.playable !== false,
      initials: text(row.initials, name.slice(0, 1)).slice(0, 1),
    }];
  }).slice(0, 6);
  if (characters.length === 0) throw new Error("模型未能识别本章角色");
  if (!characters.some((character) => character.playable)) characters[0]!.playable = true;
  const normalizedBlocks = blocks(parsed.blocks);
  const normalizedChoices = choices(parsed.choices);
  const normalizedBeats = beats(parsed.beats, paragraphIds);
  if (normalizedBlocks.length === 0 || normalizedChoices.length === 0 || normalizedBeats.length === 0) throw new Error("模型返回的章节内容不完整");
  return {
    summary: text(parsed.summary, "本章故事即将开始。"),
    goal: text(parsed.goal, "跟随原著线索推进本章事件。"),
    location: text(parsed.location, "故事现场"),
    characters,
    blocks: normalizedBlocks,
    choices: normalizedChoices,
    beats: normalizedBeats,
  };
}

export function normalizeTurn(parsed: Record<string, unknown>): ChapterTurnResult {
  const chapterCompleted = parsed.chapterCompleted === true;
  const normalizedBlocks = blocks(parsed.blocks);
  const normalizedChoices = choices(parsed.choices);
  if (normalizedBlocks.length === 0) throw new Error("模型未返回剧情内容");
  if (!chapterCompleted && normalizedChoices.length === 0) throw new Error("模型未返回下一步选项");
  return {
    blocks: normalizedBlocks,
    choices: chapterCompleted ? [] : normalizedChoices,
    chapterCompleted,
    beatCompleted: parsed.beatCompleted === true || chapterCompleted,
    ...(text(parsed.chapterSummary) ? { chapterSummary: text(parsed.chapterSummary) } : {}),
  };
}
