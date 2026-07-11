import type { ChapterAnalysis, NovelCharacter } from "./types";

export const READER_ROLE_ID = "reader";

export type SelectableCharacter = Pick<NovelCharacter, "id" | "name" | "role" | "playable">;

export const READER_CHARACTER: SelectableCharacter = {
  id: READER_ROLE_ID,
  name: "读者",
  role: "旁观阅读",
  playable: true,
};

/** The reader is a UI role and is never persisted into the compiled source plan. */
export function selectableCharacters(analysis: ChapterAnalysis) {
  if (analysis.characters.some((character) => character.playable)) return analysis.characters;
  return [...analysis.characters.filter((character) => character.id !== READER_ROLE_ID), READER_CHARACTER];
}
