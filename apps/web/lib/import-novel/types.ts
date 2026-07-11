export type NovelCharacterStatus = "continuing" | "entering";

export interface NovelCharacter {
  id: string;
  name: string;
  role: string;
  description: string;
  status: NovelCharacterStatus;
  playable: boolean;
  initials: string;
}

export type NovelStoryBlock =
  | { type: "narration"; text: string }
  | { type: "dialogue"; speaker: string; text: string }
  | { type: "action"; speaker: string; text: string };

export interface NovelChoice {
  id: string;
  label: string;
  hint: string;
}

export interface SourceParagraph {
  id: string;
  index: number;
  text: string;
  startOffset: number;
  endOffset: number;
}

export interface StoryBeat {
  id: string;
  order: number;
  title: string;
  summary: string;
  startParagraphId: string;
  endParagraphId: string;
  location: string;
  characterIds: string[];
  required: boolean;
  completionCondition: string;
}

export interface ChapterAnalysis {
  summary: string;
  goal: string;
  location: string;
  characters: NovelCharacter[];
  blocks: NovelStoryBlock[];
  choices: NovelChoice[];
  beats: StoryBeat[];
}

export interface ImportedChapter {
  id: string;
  number: number;
  title: string;
  content: string;
  paragraphs: SourceParagraph[];
  wordCount: number;
  analysis?: ChapterAnalysis;
}

export interface ImportedNovel {
  id: string;
  title: string;
  author: string;
  fileName: string;
  fileType: "txt" | "epub";
  coverDataUrl?: string;
  encoding: string;
  wordCount: number;
  createdAt: string;
  chapters: ImportedChapter[];
}

export interface ChapterTurnResult {
  blocks: NovelStoryBlock[];
  choices: NovelChoice[];
  chapterCompleted: boolean;
  chapterSummary?: string;
  beatCompleted: boolean;
}

export interface ChapterTurn {
  id: string;
  choice: NovelChoice;
  blocks: NovelStoryBlock[];
  createdAt: string;
}

export interface ChapterSession {
  id: string;
  novelId: string;
  chapterNumber: number;
  roleId: string;
  currentBeatIndex: number;
  sourceCursor: number;
  completedBeatIds: string[];
  turns: ChapterTurn[];
  currentBlocks: NovelStoryBlock[];
  currentChoices: NovelChoice[];
  revealedBlockCount: number;
  choicesVisible: boolean;
  progress: number;
  status: "playing" | "completed";
  endingSummary?: string;
  updatedAt: string;
}
