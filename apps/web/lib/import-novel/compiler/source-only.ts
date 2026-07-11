import type { ChapterAnalysis } from "../types";
import type { TaggedParagraph } from "./chunker";

/**
 * Lossless degradation for a chunk that cannot be indexed by the model.
 * It contains coordinates only: no generated facts, characters or choices.
 */
export function createSourceOnlyChunkPlan(paragraphs: TaggedParagraph[]): ChapterAnalysis {
  const first = paragraphs[0];
  const last = paragraphs.at(-1);
  if (!first || !last) throw new Error("原文分块为空");
  return {
    sourceMode: "faithful-v3",
    characters: [],
    beats: [{
      id: "beat-local-source-only",
      order: 1,
      startParagraphId: first.id,
      endParagraphId: last.id,
      characterIds: [],
      choiceTemplates: [],
    }],
  };
}
