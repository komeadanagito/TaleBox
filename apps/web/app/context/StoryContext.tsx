"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface Character {
  id: string;
  name: string;
  role: string;
  age?: string; // 年龄
  gender?: "male" | "female";
  relationshipToProtagonist?: string; // 与主角的叙事关系
  personality?: string; // 外显性格
  secret?: string; // 内心秘密
  persona?: string; // 兼容已有故事的旧人设字段（向后兼容）
  appearance?: string; // 外貌速描，用于旁白首次登场描写
  speechStyle: string;
  relationship?: number; // 好感度值 (0 - 100)
  mood?: string; // 实时心情与神态特征（格式："情绪关键词 (微表情描述)"）
  status?: "active" | "inactive";
}

export interface Scene {
  id: string;
  title: string;
  location: string;
  summary: string;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  type?: "线索" | "道具" | "关键钥匙"; // 道具类型
  associatedChar?: string; // 关联角色 ID 或 "scene"
  discovered?: boolean;
}

export interface StoryFramework {
  title: string;
  genre?: string; // 题材类别
  worldView: string;
  narrativeTone?: string; // 叙事基调（如：悬疑推理、温情治愈）
  coreConflict?: string; // 贯穿全局的核心矛盾（由 creation-agent 生成，传递给 orchestrator）
  chapterGoal?: string; // 当前章节的核心目标（由 scene-architect / chapter-transition 更新）
  characters: Character[];
  scenes: Scene[];
  items: Item[];
}

export interface Message {
  id: string;
  role: "user" | "character" | "narrator";
  characterName?: string;
  content: string;
}

export interface ChapterRecord {
  number: number;
  summary: string;
  completedAt: string; // ISO timestamp
}

export interface StoryEnding {
  chapterNumber: number;
  title: string;
  summary: string;
  completedAt: string;
}

export type StoryStatus = "ongoing" | "completed";

export interface SavedStory {
  id: string;
  framework: StoryFramework;
  chatMessages: Message[];
  dialogueSuggestions: string[];
  selectedGenre: string;
  customGenre: string;
  inspiration: string;
  createdAt: string;
  currentChapterNumber: number; // which chapter the user is currently on
  chapters: ChapterRecord[];    // completed chapter summaries
  storyStatus?: StoryStatus;
  ending?: StoryEnding | null;
}

interface StoryContextType {
  selectedGenre: string;
  setSelectedGenre: React.Dispatch<React.SetStateAction<string>>;
  customGenre: string;
  setCustomGenre: React.Dispatch<React.SetStateAction<string>>;
  inspiration: string;
  setInspiration: React.Dispatch<React.SetStateAction<string>>;
  
  isGeneratingFramework: boolean;
  setIsGeneratingFramework: React.Dispatch<React.SetStateAction<boolean>>;
  
  generatedFramework: StoryFramework | null;
  setGeneratedFramework: React.Dispatch<React.SetStateAction<StoryFramework | null>>;
  generatedChapter1: string;
  setGeneratedChapter1: React.Dispatch<React.SetStateAction<string>>;
  dialogueSuggestions: string[];
  setDialogueSuggestions: React.Dispatch<React.SetStateAction<string[]>>;
  
  chatMessages: Message[];
  setChatMessages: React.Dispatch<React.SetStateAction<Message[]>>;

  frameworkTab: "character" | "scene" | "item" | "world";
  setFrameworkTab: React.Dispatch<React.SetStateAction<"character" | "scene" | "item" | "world">>;

  // Persistence and Bookshelf states
  stories: SavedStory[];
  activeStoryId: string | null;
  createNewStory: () => void;
  loadStory: (storyId: string) => void;
  saveActiveStory: () => void;
  deleteStory: (storyId: string) => void;

  // Chapter tracking
  storyCurrentChapter: number;
  setStoryCurrentChapter: React.Dispatch<React.SetStateAction<number>>;
  storyChapters: ChapterRecord[];
  saveChapterRecord: (record: ChapterRecord) => void;
  storyStatus: StoryStatus;
  storyEnding: StoryEnding | null;
  completeStory: (ending: StoryEnding) => void;
}

const StoryContext = createContext<StoryContextType | undefined>(undefined);

export function StoryProvider({ children }: { children: React.ReactNode }) {
  const [selectedGenre, setSelectedGenre] = useState<string>("奇幻悬疑");
  const [customGenre, setCustomGenre] = useState<string>("");
  const [inspiration, setInspiration] = useState<string>("");
  const [isGeneratingFramework, setIsGeneratingFramework] = useState<boolean>(false);
  
  const [generatedFramework, setGeneratedFramework] = useState<StoryFramework | null>(null);
  const [generatedChapter1, setGeneratedChapter1] = useState<string>("");
  const [dialogueSuggestions, setDialogueSuggestions] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [frameworkTab, setFrameworkTab] = useState<"character" | "scene" | "item" | "world">("character");

  // Chapter tracking
  const [storyCurrentChapter, setStoryCurrentChapter] = useState<number>(1);
  const [storyChapters, setStoryChapters] = useState<ChapterRecord[]>([]);
  const [storyStatus, setStoryStatus] = useState<StoryStatus>("ongoing");
  const [storyEnding, setStoryEnding] = useState<StoryEnding | null>(null);

  // Bookshelf local storage list state
  const [stories, setStories] = useState<SavedStory[]>([]);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);

  // 1. Initial Load of Saved Stories from LocalStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("talebox_stories");
      if (stored) {
        try {
          setStories(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse stored stories:", e);
        }
      }
    }
  }, []);

  // 2. Auto-save current active story to LocalStorage whenever changes happen
  useEffect(() => {
    if (!generatedFramework || !activeStoryId) return;

    const updatedStories = stories.map((s) => {
      if (s.id === activeStoryId) {
        return {
          ...s,
          framework: generatedFramework,
          chatMessages,
          dialogueSuggestions,
          selectedGenre,
          customGenre,
          inspiration,
          currentChapterNumber: storyCurrentChapter,
          chapters: storyChapters,
          storyStatus,
          ending: storyEnding,
        };
      }
      return s;
    });

    // If activeStoryId is not in list (newly created story), add it
    const exists = stories.some((s) => s.id === activeStoryId);
    if (!exists) {
      const newSavedStory: SavedStory = {
        id: activeStoryId,
        framework: generatedFramework,
        chatMessages,
        dialogueSuggestions,
        selectedGenre,
        customGenre,
        inspiration,
        createdAt: new Date().toISOString(),
        currentChapterNumber: storyCurrentChapter,
        chapters: storyChapters,
        storyStatus,
        ending: storyEnding,
      };
      updatedStories.push(newSavedStory);
    }

    setStories(updatedStories);
    localStorage.setItem("talebox_stories", JSON.stringify(updatedStories));
  }, [generatedFramework, chatMessages, dialogueSuggestions, storyCurrentChapter, storyChapters, storyStatus, storyEnding]);

  // Actions: Start a fresh new story setup
  const createNewStory = () => {
    setActiveStoryId(`story_${Date.now()}`);
    setGeneratedFramework(null);
    setGeneratedChapter1("");
    setDialogueSuggestions([]);
    setChatMessages([]);
    setInspiration("");
    setSelectedGenre("奇幻悬疑");
    setCustomGenre("");
    setStoryCurrentChapter(1);
    setStoryChapters([]);
    setStoryStatus("ongoing");
    setStoryEnding(null);
  };

  // Actions: Load an existing story from bookshelf
  const loadStory = (storyId: string) => {
    const found = stories.find((s) => s.id === storyId);
    if (found) {
      setActiveStoryId(found.id);
      setGeneratedFramework(found.framework);
      setDialogueSuggestions(found.dialogueSuggestions);
      setChatMessages(found.chatMessages);
      setSelectedGenre(found.selectedGenre);
      setCustomGenre(found.customGenre);
      setInspiration(found.inspiration);
      setStoryCurrentChapter(found.currentChapterNumber || 1);
      setStoryChapters(found.chapters || []);
      setStoryStatus(found.storyStatus || "ongoing");
      setStoryEnding(found.ending || null);
    }
  };

  // Append a new completed chapter record to the history
  const saveChapterRecord = (record: ChapterRecord) => {
    setStoryChapters((prev) => {
      // avoid duplicates: replace if same chapter number exists
      const filtered = prev.filter((r) => r.number !== record.number);
      return [...filtered, record].sort((a, b) => a.number - b.number);
    });
  };

  const completeStory = (ending: StoryEnding) => {
    setStoryStatus("completed");
    setStoryEnding(ending);
  };

  // Actions: Force save active state (fallback helper)
  const saveActiveStory = () => {
    if (!generatedFramework || !activeStoryId) return;
    const updated = stories.map((s) => {
      if (s.id === activeStoryId) {
        return {
          ...s,
          framework: generatedFramework,
          chatMessages,
          dialogueSuggestions,
          currentChapterNumber: storyCurrentChapter,
          chapters: storyChapters,
          storyStatus,
          ending: storyEnding,
        };
      }
      return s;
    });
    setStories(updated);
    localStorage.setItem("talebox_stories", JSON.stringify(updated));
  };

  // Actions: Delete a story from bookshelf
  const deleteStory = (storyId: string) => {
    const nextStories = stories.filter((s) => s.id !== storyId);
    setStories(nextStories);
    localStorage.setItem("talebox_stories", JSON.stringify(nextStories));
    if (activeStoryId === storyId) {
      setActiveStoryId(null);
      setGeneratedFramework(null);
      setChatMessages([]);
      setStoryStatus("ongoing");
      setStoryEnding(null);
    }
  };

  return (
    <StoryContext.Provider
      value={{
        selectedGenre,
        setSelectedGenre,
        customGenre,
        setCustomGenre,
        inspiration,
        setInspiration,
        isGeneratingFramework,
        setIsGeneratingFramework,
        generatedFramework,
        setGeneratedFramework,
        generatedChapter1,
        setGeneratedChapter1,
        dialogueSuggestions,
        setDialogueSuggestions,
        chatMessages,
        setChatMessages,
        frameworkTab,
        setFrameworkTab,
        storyCurrentChapter,
        setStoryCurrentChapter,
        storyChapters,
        saveChapterRecord,
        storyStatus,
        storyEnding,
        completeStory,
        stories,
        activeStoryId,
        createNewStory,
        loadStory,
        saveActiveStory,
        deleteStory
      }}
    >
      {children}
    </StoryContext.Provider>
  );
}

export function useStory() {
  const context = useContext(StoryContext);
  if (!context) {
    throw new Error("useStory must be used within a StoryProvider");
  }
  return context;
}
