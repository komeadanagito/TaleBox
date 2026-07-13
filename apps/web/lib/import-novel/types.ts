export interface NovelCharacter {
  id: string;
  name: string;
  role: string;
  playable: boolean;
  evidenceParagraphId: string;
}

export type NovelStoryBlock =
  | { type: "narration"; text: string }
  | { type: "dialogue"; speaker: string; text: string }
  | { type: "action"; speaker: string; text: string };

export interface NovelChoice {
  id: string;
  kind: "observe" | "focus" | "act" | "speak" | "explore";
  label: string;
  hint: string;
  doesNotChangeCanon: boolean;
}

export type NovelDriveMode = "original" | "ai";
export type AiNarrativeMode = "faithful" | "free";

export interface StoryRuntimeMemory {
  id: string;
  kind: "decision" | "event";
  content: string;
  sourceParagraphIds: string[];
  createdAt: string;
}

export interface StoryKnowledgeNode {
  id: string;
  type: "character" | "location";
  label: string;
  sourceParagraphIds: string[];
}

export interface StoryKnowledgeEdge {
  id: string;
  fromNodeId: string;
  relation: "位于" | "参与";
  toNodeId: string;
  sourceParagraphIds: string[];
}

export interface StoryRuntimeSnapshot {
  version: number;
  agent: {
    roleId: string;
    roleName: string;
    activeGoal: string;
    narrativeMode: AiNarrativeMode;
    sourceParagraphIds: string[];
  };
  state: {
    location: string;
    presentCharacterNames: string[];
    inventory: string[];
    activeGoals: string[];
  };
  memories: StoryRuntimeMemory[];
  graph: {
    nodes: StoryKnowledgeNode[];
    edges: StoryKnowledgeEdge[];
  };
}

export interface AiChapterTurn {
  id: string;
  sourceStart: number;
  sourceEnd: number;
  location: string;
  blocks: NovelStoryBlock[];
  choices: NovelChoice[];
  selectedChoiceId?: string;
  runtimeSnapshot?: StoryRuntimeSnapshot;
  createdAt: string;
}

export interface ChoiceTemplate {
  kind: "observe_character" | "focus_source";
  anchorParagraphId: string;
  targetCharacterId: string | null;
  roleIds: string[];
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
  startParagraphId: string;
  endParagraphId: string;
  characterIds: string[];
  choiceTemplates: ChoiceTemplate[];
}

export interface ChapterAnalysis {
  sourceMode?: "faithful-v1" | "faithful-v2" | "faithful-v3";
  compilerVersion?: string;
  promptVersion?: string;
  promptHash?: string;
  sourceHash?: string;
  coverage?: {
    coveredParagraphCount: number;
    totalParagraphCount: number;
    ratio: number;
  };
  characters: NovelCharacter[];
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

export interface ChapterDecision {
  id: string;
  beatId: string;
  choiceId: string;
  createdAt: string;
}

export interface ChapterSession {
  sourceMode?: "faithful-v1" | "faithful-v2" | "faithful-v3";
  compilerVersion?: string;
  sourceHash?: string;
  id: string;
  novelId: string;
  chapterNumber: number;
  roleId: string;
  driveMode?: NovelDriveMode;
  aiNarrativeMode?: AiNarrativeMode;
  aiRuntimeVersion?: string;
  storyRuntime?: StoryRuntimeSnapshot;
  currentBeatIndex: number;
  sourceCursor: number;
  completedBeatIds: string[];
  decisions?: ChapterDecision[];
  aiTurns?: AiChapterTurn[];
  revealedBlockCount: number;
  choicesVisible: boolean;
  progress: number;
  status: "playing" | "completed";
  updatedAt: string;
}
