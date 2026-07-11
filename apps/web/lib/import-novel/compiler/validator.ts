import type { ChapterAnalysis, SourceParagraph } from "../types";
import { NOVEL_COMPILER_VERSION, NOVEL_PROMPT_VERSION } from "./constants";

type CanonicalParagraph = Pick<SourceParagraph, "id" | "text">;

function normalized(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, "").toLocaleLowerCase();
}

export function assertChapterPlan(
  plan: ChapterAnalysis,
  paragraphs: CanonicalParagraph[],
  expectedSourceHash?: string,
) {
  if (plan.sourceMode !== "faithful-v3") throw new Error("章节计划模式无效");
  if (plan.compilerVersion !== NOVEL_COMPILER_VERSION || plan.promptVersion !== NOVEL_PROMPT_VERSION) {
    throw new Error("章节计划版本已过期");
  }
  if (!/^[a-f0-9]{64}$/.test(plan.sourceHash || "")) throw new Error("章节原文指纹无效");
  if (expectedSourceHash && plan.sourceHash !== expectedSourceHash) throw new Error("章节原文指纹不匹配");
  if (!/^[a-f0-9]{64}$/.test(plan.promptHash || "")) throw new Error("章节提示词指纹无效");
  if (paragraphs.length === 0 || plan.beats.length === 0) throw new Error("章节计划为空");

  const paragraphIndex = new Map(paragraphs.map((paragraph, index) => [paragraph.id, index]));
  const paragraphText = new Map(paragraphs.map((paragraph) => [paragraph.id, paragraph.text]));
  const characterById = new Map<string, ChapterAnalysis["characters"][number]>();
  const characterNames = new Set<string>();
  for (const character of plan.characters) {
    const normalizedName = normalized(character.name);
    const evidence = paragraphText.get(character.evidenceParagraphId);
    if (!character.id || characterById.has(character.id) || !normalizedName || characterNames.has(normalizedName)) {
      throw new Error("章节人物存在重复或空标识");
    }
    if (!evidence || !normalized(evidence).includes(normalizedName)) throw new Error(`人物缺少原文证据: ${character.name}`);
    if (character.role && !normalized(evidence).includes(normalized(character.role))) throw new Error(`人物身份缺少原文证据: ${character.name}`);
    characterById.set(character.id, character);
    characterNames.add(normalizedName);
  }

  let previousEnd = -1;
  const beatIds = new Set<string>();
  for (let beatIndex = 0; beatIndex < plan.beats.length; beatIndex += 1) {
    const beat = plan.beats[beatIndex]!;
    const start = paragraphIndex.get(beat.startParagraphId);
    const end = paragraphIndex.get(beat.endParagraphId);
    if (beat.order !== beatIndex + 1 || beatIds.has(beat.id) || start === undefined || end === undefined || start !== previousEnd + 1 || end < start) {
      throw new Error("章节节点坐标不连续");
    }
    beatIds.add(beat.id);
    previousEnd = end;
    const beatCharacterIds = new Set(beat.characterIds);
    if (beatCharacterIds.size !== beat.characterIds.length || beat.characterIds.some((id) => !characterById.has(id))) {
      throw new Error("章节节点引用了无效人物");
    }
    if (beat.choiceTemplates.length > 2) throw new Error("章节节点选项模板过多");
    for (const template of beat.choiceTemplates) {
      const anchor = paragraphIndex.get(template.anchorParagraphId);
      if (anchor === undefined || anchor < start || anchor > end) throw new Error("选项锚点超出章节节点");
      if (template.kind === "observe_character") {
        if (!template.targetCharacterId || !beatCharacterIds.has(template.targetCharacterId)) throw new Error("观察选项人物无效");
      } else if (template.kind === "focus_source") {
        if (template.targetCharacterId !== null) throw new Error("原文关注选项不能指定人物");
      } else {
        throw new Error("未知选项模板");
      }
      const roleIds = new Set(template.roleIds);
      if (roleIds.size !== template.roleIds.length || template.roleIds.some((id) => !characterById.get(id)?.playable)) {
        throw new Error("选项适用角色无效");
      }
    }
  }

  if (previousEnd !== paragraphs.length - 1) throw new Error("章节计划未完整覆盖原文");
  if (!plan.coverage
    || plan.coverage.coveredParagraphCount !== paragraphs.length
    || plan.coverage.totalParagraphCount !== paragraphs.length
    || plan.coverage.ratio !== 1) {
    throw new Error("章节计划覆盖率无效");
  }
}
