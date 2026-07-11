import type { ChapterAnalysis, NovelCharacter, StoryBeat } from "../types";
import { MIN_PLAN_COVERAGE, NOVEL_COMPILER_VERSION, NOVEL_PROMPT_VERSION } from "./constants";

function normalizedName(name: string) {
  return name.replace(/\s+/g, "").toLowerCase();
}

function mergeCharacters(results: ChapterAnalysis[]) {
  const byName = new Map<string, NovelCharacter>();
  const aliasesByResult = new Map<ChapterAnalysis, Map<string, string>>();
  for (const result of results) {
    const aliases = new Map<string, string>();
    aliasesByResult.set(result, aliases);
    for (const character of result.characters) {
      const key = normalizedName(character.name);
      const existing = byName.get(key);
      if (!existing) {
        if (byName.size >= 12) continue;
        const id = `character-${String(byName.size + 1).padStart(2, "0")}`;
        byName.set(key, {
          ...character,
          id,
        });
        aliases.set(character.id, id);
      } else {
        aliases.set(character.id, existing.id);
        byName.set(key, {
          ...existing,
          playable: existing.playable || character.playable,
          role: existing.role || character.role,
          evidenceParagraphId: existing.role || !character.role ? existing.evidenceParagraphId : character.evidenceParagraphId,
        });
      }
    }
  }
  return { characters: [...byName.values()], aliasesByResult };
}

function mergeBeats(results: ChapterAnalysis[], paragraphIds: string[], aliasesByResult: Map<ChapterAnalysis, Map<string, string>>) {
  const candidates = results
    .flatMap((result) => result.beats.map((beat) => ({ beat, aliases: aliasesByResult.get(result)! })))
    .sort((a, b) => paragraphIds.indexOf(a.beat.startParagraphId) - paragraphIds.indexOf(b.beat.startParagraphId));
  const beats: StoryBeat[] = [];
  let previousEnd = -1;
  for (const { beat: candidate, aliases } of candidates) {
    let start = paragraphIds.indexOf(candidate.startParagraphId);
    const end = paragraphIds.indexOf(candidate.endParagraphId);
    if (start < 0 || end < start || end <= previousEnd) continue;
    if (start <= previousEnd) start = previousEnd + 1;
    const characterIds = [...new Set(candidate.characterIds.map((id) => aliases.get(id)).filter((id): id is string => Boolean(id)))];
    const choiceTemplates = candidate.choiceTemplates.flatMap((template) => {
      const anchorIndex = paragraphIds.indexOf(template.anchorParagraphId);
      if (anchorIndex < start || anchorIndex > end) return [];
      const targetCharacterId = template.targetCharacterId ? aliases.get(template.targetCharacterId) : null;
      if (template.kind === "observe_character" && !targetCharacterId) return [];
      const roleIds = [...new Set(template.roleIds.map((id) => aliases.get(id)).filter((id): id is string => Boolean(id)))];
      if (template.roleIds.length > 0 && roleIds.length === 0) return [];
      return [{
        ...template,
        targetCharacterId: targetCharacterId || null,
        roleIds,
      }];
    });
    beats.push({ ...candidate, id: `beat-${String(beats.length + 1).padStart(2, "0")}`, order: beats.length + 1, startParagraphId: paragraphIds[start]!, characterIds, choiceTemplates });
    previousEnd = end;
  }
  return beats;
}

function coverageFor(beats: StoryBeat[], paragraphIds: string[]) {
  const covered = new Set<number>();
  for (const beat of beats) {
    const start = paragraphIds.indexOf(beat.startParagraphId);
    const end = paragraphIds.indexOf(beat.endParagraphId);
    for (let index = start; index <= end; index += 1) covered.add(index);
  }
  const ratio = paragraphIds.length > 0 ? covered.size / paragraphIds.length : 0;
  return { coveredParagraphCount: covered.size, totalParagraphCount: paragraphIds.length, ratio };
}

export function mergeChapterPlan(results: ChapterAnalysis[], paragraphIds: string[], sourceHash: string): ChapterAnalysis {
  const { characters, aliasesByResult } = mergeCharacters(results);
  const beats = mergeBeats(results, paragraphIds, aliasesByResult);
  const coverage = coverageFor(beats, paragraphIds);
  if (beats.length === 0 || coverage.ratio < MIN_PLAN_COVERAGE) throw new Error(`章节结构覆盖率不足: ${Math.round(coverage.ratio * 100)}%`);
  return {
    sourceMode: "faithful-v3",
    compilerVersion: NOVEL_COMPILER_VERSION,
    promptVersion: NOVEL_PROMPT_VERSION,
    sourceHash,
    coverage,
    characters,
    beats,
  };
}
