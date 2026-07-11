import type { ImportedChapter, NovelCharacter, NovelChoice, NovelStoryBlock, StoryBeat } from "./types";

export const SOURCE_WINDOW_SIZE = 4;

export function paragraphIndex(chapter: ImportedChapter, paragraphId: string) {
  const index = chapter.paragraphs.findIndex((paragraph) => paragraph.id === paragraphId);
  if (index < 0) throw new Error(`章节规划引用了不存在的原文段落：${paragraphId}`);
  return index;
}

export function sourceBlocks(chapter: ImportedChapter, start: number, endExclusive: number): NovelStoryBlock[] {
  const safeStart = Math.max(0, Math.min(chapter.paragraphs.length, start));
  const safeEnd = Math.max(safeStart, Math.min(chapter.paragraphs.length, endExclusive));
  return chapter.paragraphs.slice(safeStart, safeEnd).map((paragraph) => ({ type: "narration" as const, text: paragraph.text }));
}

export function beatCheckpointExclusive(chapter: ImportedChapter, beat: StoryBeat) {
  return paragraphIndex(chapter, beat.endParagraphId) + 1;
}

/**
 * Reads the next sequential source window. A beat only caps the window at its
 * checkpoint; its start coordinate never moves the source cursor, so original
 * paragraphs cannot be skipped when compiled beats have gaps.
 */
export function readNextSourceBlocks(
  chapter: ImportedChapter,
  beat: StoryBeat | undefined,
  nextParagraphIndex: number,
  limit = SOURCE_WINDOW_SIZE,
) {
  const start = Math.max(0, Math.min(chapter.paragraphs.length, nextParagraphIndex));
  const checkpointExclusive = beat ? beatCheckpointExclusive(chapter, beat) : chapter.paragraphs.length;
  const endExclusive = Math.min(chapter.paragraphs.length, Math.max(start, checkpointExclusive), start + Math.max(1, limit));
  return {
    blocks: sourceBlocks(chapter, start, endExclusive),
    nextCursor: endExclusive,
    checkpointReached: endExclusive >= checkpointExclusive,
  };
}

export function hasReachedCheckpoint(chapter: ImportedChapter, beat: StoryBeat, nextParagraphIndex: number) {
  return nextParagraphIndex >= beatCheckpointExclusive(chapter, beat);
}

/** `revealedExclusive` is the number of original paragraphs actually visible. */
export function calculateProgress(chapter: ImportedChapter, revealedExclusive: number, completed: boolean) {
  if (chapter.paragraphs.length === 0) return completed ? 100 : 0;
  if (completed) return 100;
  const revealed = Math.max(0, Math.min(chapter.paragraphs.length, revealedExclusive));
  return Math.min(99, Math.max(1, Math.round((revealed / chapter.paragraphs.length) * 100)));
}

export function choicesForRole(beat: StoryBeat, roleId: string, characters: ReadonlyArray<Pick<NovelCharacter, "id" | "name">>): NovelChoice[] {
  const characterById = new Map(characters.map((character) => [character.id, character]));
  const compiled = (beat.choiceTemplates || [])
    .filter((template) => template.roleIds.length === 0 || template.roleIds.includes(roleId))
    .flatMap((template, index): NovelChoice[] => {
      if (template.kind === "observe_character" && template.targetCharacterId) {
        const target = characterById.get(template.targetCharacterId);
        if (!target) return [];
        return [{ id: `${beat.id}-observe-${index}`, kind: "observe", label: `留意${target.name}`, hint: "观察原著人物", doesNotChangeCanon: true }];
      }
      if (template.kind === "focus_source") {
        return [{ id: `${beat.id}-focus-${index}`, kind: "focus", label: "细看这一处细节", hint: "关注原文信息", doesNotChangeCanon: true }];
      }
      return [];
    });

  return [
    { id: `${beat.id}-continue`, kind: "focus", label: "继续阅读原文", hint: "沿原著顺序继续", doesNotChangeCanon: true },
    ...compiled.slice(0, 2),
  ];
}
