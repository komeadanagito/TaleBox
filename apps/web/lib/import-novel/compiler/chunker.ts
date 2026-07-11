import { CHUNK_CHARACTER_LIMIT, CHUNK_OVERLAP_PARAGRAPHS } from "./constants";

export type TaggedParagraph = { id: string; text: string };
export type ParagraphChunk = { paragraphs: TaggedParagraph[]; index: number };

export function createParagraphChunks(paragraphs: TaggedParagraph[]): ParagraphChunk[] {
  const chunks: ParagraphChunk[] = [];
  let start = 0;
  while (start < paragraphs.length) {
    let end = start;
    let length = 0;
    while (end < paragraphs.length) {
      const paragraph = paragraphs[end]!;
      const addition = paragraph.text.length + paragraph.id.length + 4;
      if (end > start && length + addition > CHUNK_CHARACTER_LIMIT) break;
      length += addition;
      end += 1;
    }
    chunks.push({ paragraphs: paragraphs.slice(start, end), index: chunks.length });
    if (end >= paragraphs.length) break;
    start = Math.max(start + 1, end - CHUNK_OVERLAP_PARAGRAPHS);
  }
  return chunks;
}

