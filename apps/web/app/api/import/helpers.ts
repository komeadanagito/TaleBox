import { CHUNK_MAX_OUTPUT_TOKENS, CHUNK_REQUEST_TIMEOUT_MS } from "../../../lib/import-novel/compiler/constants";
import type { TaggedParagraph } from "../../../lib/import-novel/compiler/chunker";
import type { ChapterAnalysis, ChoiceTemplate, NovelCharacter, StoryBeat } from "../../../lib/import-novel/types";

const CHARACTER_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const PARAGRAPH_ID_PATTERN = /^p-\d{4,}$/;
const MAX_CHARACTERS_PER_CHUNK = 6;
const MAX_BEATS_PER_CHUNK = 6;
const MAX_TEMPLATES_PER_BEAT = 2;

type JsonObject = Record<string, unknown>;

export interface AnalyzeChapterInput {
  chapterTitle: string;
  paragraphs: TaggedParagraph[];
}

export interface ChunkModelConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  retryPrompt: string;
  paragraphs: TaggedParagraph[];
}

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}必须是JSON对象`);
  return value as JsonObject;
}

function exactKeys(row: JsonObject, allowed: readonly string[], label: string) {
  const allowedKeys = new Set(allowed);
  const unexpected = Object.keys(row).filter((key) => !allowedKeys.has(key));
  const missing = allowed.filter((key) => !Object.prototype.hasOwnProperty.call(row, key));
  if (unexpected.length > 0 || missing.length > 0) {
    throw new Error(`${label}字段不符合契约`);
  }
}

function string(row: JsonObject, key: string, options: { allowEmpty?: boolean; maxLength?: number } = {}) {
  if (typeof row[key] !== "string") throw new Error(`${key}必须是字符串`);
  const value = row[key].trim();
  if (!options.allowEmpty && !value) throw new Error(`${key}不能为空`);
  if (options.maxLength && value.length > options.maxLength) throw new Error(`${key}超过长度限制`);
  return value;
}

function normalized(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, "").toLocaleLowerCase();
}

export function parseModelJSON(raw: string): JsonObject {
  const parsed = JSON.parse(raw.trim()) as unknown;
  return object(parsed, "模型输出");
}

export function parseAnalyzeChapterInput(value: unknown): AnalyzeChapterInput {
  const row = object(value, "请求体");
  const hasParagraphs = Object.prototype.hasOwnProperty.call(row, "paragraphs");
  const hasChapterContent = Object.prototype.hasOwnProperty.call(row, "chapterContent");
  if (hasParagraphs === hasChapterContent) throw new Error("paragraphs与chapterContent必须且只能提供一个");
  exactKeys(row, hasParagraphs ? ["chapterTitle", "paragraphs"] : ["chapterTitle", "chapterContent"], "请求体");

  const chapterTitle = string(row, "chapterTitle", { maxLength: 200 });
  let paragraphs: TaggedParagraph[];
  if (hasParagraphs) {
    if (!Array.isArray(row.paragraphs) || row.paragraphs.length === 0) throw new Error("paragraphs必须是非空数组");
    const ids = new Set<string>();
    paragraphs = row.paragraphs.map((item, index) => {
      const paragraph = object(item, `paragraphs[${index}]`);
      exactKeys(paragraph, ["id", "text"], `paragraphs[${index}]`);
      const id = string(paragraph, "id", { maxLength: 32 });
      if (typeof paragraph.text !== "string" || !paragraph.text.trim()) throw new Error("text不能为空");
      const text = paragraph.text;
      if (!PARAGRAPH_ID_PATTERN.test(id) || ids.has(id)) throw new Error(`段落ID无效或重复: ${id}`);
      ids.add(id);
      return { id, text };
    });
  } else {
    const chapterContent = string(row, "chapterContent");
    paragraphs = chapterContent
      .split(/\n+/)
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text, index) => ({ id: `p-${String(index + 1).padStart(4, "0")}`, text }));
  }

  if (paragraphs.map((paragraph) => paragraph.text).join("").replace(/\s/g, "").length < 50) {
    throw new Error("章节正文过短");
  }
  return { chapterTitle, paragraphs };
}

export function isNonNarrativeChapter(chapterTitle: string, paragraphs: TaggedParagraph[]) {
  const content = paragraphs.map((paragraph) => paragraph.text).join("\n");
  const nonNarrativeTitle = /^(?:copyright|all rights reserved|contents?|table of contents|dedication|epigraph|acknowledgements?|about the author|publication info|colophon|版权|目录|扉页|题词|献词|致谢|简介|内容简介|内容提要|故事简介|本书简介|作者简介|出版信息|奥付)/i.test(chapterTitle.trim());
  const nonNarrativeContent = content.replace(/\s/g, "").length < 6000
    && /(?:all rights reserved|no part of this (?:book|publication)|isbn(?:-1[03])?\s*[:：]|copyright\s*[©\u00a9]|版权所有|出版发行)/i.test(content.slice(0, 2500));
  return nonNarrativeTitle || nonNarrativeContent;
}

export function renderPrompt(template: string, values: Record<string, string>) {
  if (!template.trim()) throw new Error("提示词文件为空");
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) throw new Error(`提示词变量未提供: ${key}`);
    return values[key]!;
  });
}

function normalizeCharacters(value: unknown, paragraphs: TaggedParagraph[]): NovelCharacter[] {
  if (!Array.isArray(value) || value.length > MAX_CHARACTERS_PER_CHUNK) throw new Error("characters数量无效");
  const paragraphById = new Map(paragraphs.map((paragraph) => [paragraph.id, paragraph.text]));
  const ids = new Set<string>();
  const names = new Set<string>();
  return value.flatMap((item, index): NovelCharacter[] => {
    try {
      const row = object(item, `characters[${index}]`);
      exactKeys(row, ["id", "name", "role", "playable", "evidenceParagraphId"], `characters[${index}]`);
      const id = string(row, "id", { maxLength: 48 });
      const name = string(row, "name", { maxLength: 40 });
      const rawRole = string(row, "role", { allowEmpty: true, maxLength: 24 });
      const evidenceParagraphId = string(row, "evidenceParagraphId", { maxLength: 32 });
      const evidence = paragraphById.get(evidenceParagraphId);
      const normalizedName = normalized(name);
      if (!CHARACTER_ID_PATTERN.test(id) || ids.has(id) || names.has(normalizedName)) return [];
      if (!evidence || !normalized(evidence).includes(normalizedName)) return [];
      if (typeof row.playable !== "boolean") return [];
      const role = rawRole && normalized(evidence).includes(normalized(rawRole)) ? rawRole : "";
      ids.add(id);
      names.add(normalizedName);
      return [{ id, name, role, playable: row.playable, evidenceParagraphId }];
    } catch {
      return [];
    }
  });
}

function normalizeTemplates(
  value: unknown,
  beatStart: number,
  beatEnd: number,
  paragraphIds: string[],
  beatCharacterIds: Set<string>,
  playableIds: Set<string>,
): ChoiceTemplate[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_TEMPLATES_PER_BEAT).flatMap((item, index): ChoiceTemplate[] => {
    try {
      const row = object(item, `choiceTemplates[${index}]`);
      exactKeys(row, ["kind", "anchorParagraphId", "targetCharacterId", "roleIds"], `choiceTemplates[${index}]`);
      if (row.kind !== "observe_character" && row.kind !== "focus_source") return [];
      const anchorParagraphId = string(row, "anchorParagraphId", { maxLength: 32 });
      const anchorIndex = paragraphIds.indexOf(anchorParagraphId);
      if (anchorIndex < beatStart || anchorIndex > beatEnd) return [];
      const targetCharacterId = row.targetCharacterId === null ? null : string(row, "targetCharacterId", { maxLength: 48 });
      if (row.kind === "observe_character" && (!targetCharacterId || !beatCharacterIds.has(targetCharacterId))) return [];
      if (row.kind === "focus_source" && targetCharacterId !== null) return [];
      if (!Array.isArray(row.roleIds)) return [];
      const roleIds = [...new Set(row.roleIds.filter((roleId): roleId is string => typeof roleId === "string" && playableIds.has(roleId)))];
      if (row.roleIds.length > 0 && roleIds.length === 0) return [];
      return [{ kind: row.kind, anchorParagraphId, targetCharacterId, roleIds }];
    } catch {
      return [];
    }
  });
}

function normalizeBeats(value: unknown, paragraphs: TaggedParagraph[], characters: NovelCharacter[]): StoryBeat[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_BEATS_PER_CHUNK) throw new Error("beats数量无效");
  const paragraphIds = paragraphs.map((paragraph) => paragraph.id);
  const characterIds = new Set(characters.map((character) => character.id));
  const playableIds = new Set(characters.filter((character) => character.playable).map((character) => character.id));
  let previousEnd = -1;
  const beats = value.map((item, index) => {
    const row = object(item, `beats[${index}]`);
    exactKeys(row, ["startParagraphId", "endParagraphId", "characterIds", "choiceTemplates"], `beats[${index}]`);
    const startParagraphId = string(row, "startParagraphId", { maxLength: 32 });
    const endParagraphId = string(row, "endParagraphId", { maxLength: 32 });
    const start = paragraphIds.indexOf(startParagraphId);
    const end = paragraphIds.indexOf(endParagraphId);
    if (start < 0 || end < start || start !== previousEnd + 1) throw new Error(`剧情节点必须连续且不重叠: ${startParagraphId}-${endParagraphId}`);
    const beatCharacterIds = Array.isArray(row.characterIds)
      ? [...new Set(row.characterIds.filter((characterId): characterId is string => typeof characterId === "string" && characterIds.has(characterId)))]
      : [];
    previousEnd = end;
    return {
      id: `beat-local-${index + 1}`,
      order: index + 1,
      startParagraphId,
      endParagraphId,
      characterIds: beatCharacterIds,
      choiceTemplates: normalizeTemplates(row.choiceTemplates, start, end, paragraphIds, new Set(beatCharacterIds), playableIds),
    };
  });
  if (previousEnd !== paragraphIds.length - 1) throw new Error("beats未完整覆盖当前原文块");
  return beats;
}

export function normalizeAnalysis(parsed: JsonObject, paragraphs: TaggedParagraph[]): ChapterAnalysis {
  exactKeys(parsed, ["characters", "beats", "isNonNarrative"], "模型输出");
  const isNonNarrative = parsed.isNonNarrative === true || parsed.isNonNarrative === "true" || parsed.isNonNarrative === "是";
  if (isNonNarrative) {
    throw new Error("该页面属于电子书前置信息，不作为互动章节");
  }
  const characters = normalizeCharacters(parsed.characters, paragraphs);
  return {
    sourceMode: "faithful-v3",
    characters,
    beats: normalizeBeats(parsed.beats, paragraphs, characters),
  };
}

async function requestModelOutput(config: ChunkModelConfig, userPrompt: string) {
  const response = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(CHUNK_REQUEST_TIMEOUT_MS),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      enable_thinking: false,
      max_tokens: CHUNK_MAX_OUTPUT_TOKENS,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: config.systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  const data = object(await response.json(), "模型接口响应");
  if (!response.ok) {
    const error = data.error && typeof data.error === "object" ? data.error as JsonObject : null;
    throw new Error(typeof error?.message === "string" ? error.message : "章节结构提取失败");
  }
  const choices = Array.isArray(data.choices) ? data.choices : [];
  const firstChoice = choices[0] && typeof choices[0] === "object" ? choices[0] as JsonObject : null;
  const message = firstChoice?.message && typeof firstChoice.message === "object" ? firstChoice.message as JsonObject : null;
  if (typeof message?.content !== "string" || !message.content.trim()) {
    const finishReason = typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : "unknown";
    const reasoningLength = typeof message?.reasoning_content === "string" ? message.reasoning_content.length : 0;
    throw new Error(`模型没有返回JSON内容（finish=${finishReason}, reasoning=${reasoningLength}）`);
  }
  return message.content;
}

export async function extractChunkWithRetry(config: ChunkModelConfig): Promise<ChapterAnalysis> {
  const firstOutput = await requestModelOutput(config, config.userPrompt);
  try {
    return normalizeAnalysis(parseModelJSON(firstOutput), config.paragraphs);
  } catch (error) {
    if (error instanceof Error && error.message === "该页面属于电子书前置信息，不作为互动章节") {
      throw error;
    }
    const retryOutput = await requestModelOutput(config, `${config.userPrompt}\n\n${config.retryPrompt}`);
    return normalizeAnalysis(parseModelJSON(retryOutput), config.paragraphs);
  }
}
