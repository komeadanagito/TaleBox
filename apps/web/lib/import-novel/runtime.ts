import type { ChapterSession, ImportedChapter, StoryBeat } from "./types";

export function paragraphIndex(chapter: ImportedChapter, paragraphId: string) {
  const index = chapter.paragraphs.findIndex((paragraph) => paragraph.id === paragraphId);
  return Math.max(0, index);
}

export function createSourceContext(chapter: ImportedChapter, beat: StoryBeat, cursor: number) {
  const beatStart = paragraphIndex(chapter, beat.startParagraphId);
  const beatEnd = Math.max(beatStart, paragraphIndex(chapter, beat.endParagraphId));
  const start = Math.max(beatStart, cursor - 2);
  const end = Math.min(beatEnd, cursor + 3);
  return chapter.paragraphs.slice(start, end + 1).map((paragraph) => `[${paragraph.id}] ${paragraph.text}`).join("\n");
}

export function advanceSourceCursor(chapter: ImportedChapter, beat: StoryBeat, cursor: number, beatCompleted: boolean, nextBeat?: StoryBeat) {
  if (beatCompleted && nextBeat) return paragraphIndex(chapter, nextBeat.startParagraphId);
  const beatEnd = paragraphIndex(chapter, beat.endParagraphId);
  const remaining = Math.max(0, beatEnd - cursor);
  return Math.min(beatEnd, cursor + Math.max(1, Math.ceil(remaining / 2)));
}

export function calculateProgress(chapter: ImportedChapter, cursor: number, completed: boolean) {
  if (completed) return 100;
  if (chapter.paragraphs.length <= 1) return 0;
  return Math.min(99, Math.max(1, Math.round((cursor / (chapter.paragraphs.length - 1)) * 100)));
}

export function recentHistory(session: ChapterSession) {
  return session.turns.slice(-4).map((turn) => `选择：${turn.choice.label}\n结果：${turn.blocks.map((block) => block.text).join(" ")}`).join("\n\n") || "无";
}

