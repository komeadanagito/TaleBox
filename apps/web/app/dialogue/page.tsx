"use client";

import React, { useState, useRef, useEffect as useScrollEffect } from "react";
import { useRouter } from "next/navigation";
import { Send, Box, Laptop, PanelLeftClose, PanelLeftOpen, BookOpen } from "lucide-react";
import { useStory, Message } from "../context/StoryContext";
import ChatBubble from "../../components/ChatBubble";
import PageTurnTransition, { PageTurnDestination } from "../../components/PageTurnTransition";
import ChapterCompleteOverlay from "../../components/ChapterCompleteOverlay";
import StoryEndingOverlay from "../../components/StoryEndingOverlay";

type ChapterClosureSource = "reader" | "narrative";

interface PendingCompletion {
  destination: PageTurnDestination;
  source: ChapterClosureSource;
  summary: string;
  transitions: any;
  endingTitle?: string;
  endingSummary?: string;
}

export default function DialoguePage() {
  const router = useRouter();
  const {
    generatedFramework,
    setGeneratedFramework,
    chatMessages,
    setChatMessages,
    dialogueSuggestions,
    setDialogueSuggestions,
    storyCurrentChapter: currentChapterNumber,
    setStoryCurrentChapter: setCurrentChapterNumber,
    storyChapters,
    storyStatus,
    storyEnding,
    saveChapterRecord,
    completeStory,
  } = useStory();

  const [userInput, setUserInput] = useState<string>("");
  const [activeTone, setActiveTone] = useState<string>("普通");
  const [isAIResponding, setIsAIResponding] = useState<boolean>(false);
  const [revealedParagraphsCount, setRevealedParagraphsCount] = useState<number>(1);
  const [showChapterCompleteOverlay, setShowChapterCompleteOverlay] = useState<boolean>(false);
  const [chapterSummary, setChapterSummary] = useState<string>("");
  const [pendingTransitions, setPendingTransitions] = useState<any>(null);
  // Note: currentChapterNumber is now driven by StoryContext (storyCurrentChapter)
  // Next chapter data: pre-generated in background while settlement screen is shown
  const [nextChapterData, setNextChapterData] = useState<any>(null);
  const [isGeneratingNextChapter, setIsGeneratingNextChapter] = useState<boolean>(false);
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [isSuggestionsExpanded, setIsSuggestionsExpanded] = useState<boolean>(false);
  const [pageTurnPhase, setPageTurnPhase] = useState<"idle" | "turning" | "settled">("idle");
  const [pendingCompletion, setPendingCompletion] = useState<PendingCompletion | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const nextChapterAbortRef = useRef<AbortController | null>(null);
  const pageTurnLockRef = useRef(false);

  // Streaming updates arrive frequently. Instant scrolling keeps the latest text
  // visible without repeatedly restarting a smooth-scroll animation.
  useScrollEffect(() => {
    chatBottomRef.current?.scrollIntoView({
      behavior: isAIResponding ? "auto" : "smooth"
    });
  }, [chatMessages, isAIResponding]);

  // New AI suggestions start compact so they do not displace the story text.
  React.useEffect(() => {
    setIsSuggestionsExpanded(false);
  }, [dialogueSuggestions]);


  useScrollEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
      nextChapterAbortRef.current?.abort();
    };
  }, []);

  // If no story setup exists, redirect back to creation root inside useEffect
  React.useEffect(() => {
    if (!generatedFramework) {
      router.push("/creation");
    }
  }, [generatedFramework, router]);

  if (!generatedFramework) {
    return null;
  }

  const isOverlayVisible =
    pageTurnPhase === "turning" ||
    showChapterCompleteOverlay ||
    (storyStatus === "completed" && Boolean(storyEnding));

  const prepareNextChapter = async (summary: string, transitions: any) => {
    nextChapterAbortRef.current?.abort();
    const abortController = new AbortController();
    nextChapterAbortRef.current = abortController;
    setIsGeneratingNextChapter(true);
    setNextChapterData(null);

    try {
      const response = await fetch("/api/generate-chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          framework: generatedFramework,
          chapterSummary: summary,
          characterTransitions: transitions || { leave: [], enter: [] },
          chapterNumber: currentChapterNumber,
        }),
        signal: abortController.signal,
      });
      if (!response.ok) throw new Error("Failed to prepare the next chapter");
      const data = await response.json();
      if (nextChapterAbortRef.current === abortController && data.result) {
        setNextChapterData(data.result);
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error("Background chapter generation failed:", error);
      }
    } finally {
      if (nextChapterAbortRef.current === abortController) {
        nextChapterAbortRef.current = null;
        setIsGeneratingNextChapter(false);
      }
    }
  };

  const beginPageTurn = (completion: PendingCompletion) => {
    if (pageTurnLockRef.current || pageTurnPhase === "turning" || storyStatus === "completed") return;
    pageTurnLockRef.current = true;
    setChapterSummary(completion.summary);
    setPendingTransitions(completion.transitions || null);
    setPendingCompletion(completion);
    setDialogueSuggestions([]);
    setPageTurnPhase("turning");

    if (completion.destination === "chapter") {
      void prepareNextChapter(completion.summary, completion.transitions);
    }
  };

  // Keep the force-end capability, but present it as a neutral story action.
  const handleForceChapterEnd = () => {
    if (pageTurnPhase !== "idle" || storyStatus === "completed") return;
    streamAbortRef.current?.abort();
    setIsAIResponding(false);

    const completion: PendingCompletion = pendingCompletion || {
      destination: "chapter",
      source: "reader",
      summary: chapterSummary || `第 ${currentChapterNumber} 章在此落笔，未尽的线索与情绪将随故事继续向前。`,
      transitions: pendingTransitions || null,
    };

    beginPageTurn({ ...completion, source: "reader" });
  };

  // Send dialogue message to Server API and read the text stream chunk-by-chunk
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanInput = userInput.trim();
    if (!cleanInput || isAIResponding || pendingCompletion || pageTurnPhase !== "idle" || storyStatus === "completed") return;

    // 1. Append user message
    const userMsg: Message = {
      id: `msg_user_${Date.now()}`,
      role: "user",
      content: cleanInput
    };
    const nextMessages = [...chatMessages, userMsg];
    setChatMessages(nextMessages);
    setUserInput("");
    setIsAIResponding(true);
    setRevealedParagraphsCount(1); // Reset clicked reveal counter for the new turn

    // 2. Append temporary AI message for streaming content
    const aiTempId = `msg_ai_stream_${Date.now()}`;
    setChatMessages((prev) => [
      ...prev,
      {
        id: aiTempId,
        role: "narrator", // rendered as parsed paragraphs block
        content: ""
      }
    ]);

    const abortCtrl = new AbortController();
    try {
      streamAbortRef.current = abortCtrl;
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          framework: generatedFramework,
          messages: nextMessages,
          userInput: cleanInput,
          tone: activeTone,
          chapterNumber: currentChapterNumber,
        }),
        signal: abortCtrl.signal
      });
      if (!response.ok) {
        throw new Error("API request failed");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is not readable");
      }

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        // Robust real-time split: search for "---" or metadata markers
        let novelText = chunk;
        const lowerFullText = fullText.toLowerCase();
        const splitIndex = fullText.indexOf("---");

        if (splitIndex !== -1) {
          novelText = fullText.substring(0, splitIndex).trim();
        } else {
          // If model skipped "---", find first appearance of suggestions/state_patch
          const sugIdx = lowerFullText.indexOf("[suggestions]");
          const patchIdx = lowerFullText.indexOf("[state_patch]");
          let markerIdx = -1;
          if (sugIdx !== -1 && patchIdx !== -1) {
            markerIdx = Math.min(sugIdx, patchIdx);
          } else {
            markerIdx = sugIdx !== -1 ? sugIdx : patchIdx;
          }

          if (markerIdx !== -1) {
            novelText = fullText.substring(0, markerIdx).trim();
          } else {
            novelText = fullText.trim();
          }
        }

        // Update the temporary AI message content in real time
        setChatMessages((prev) =>
          prev.map((msg) => (msg.id === aiTempId ? { ...msg, content: novelText } : msg))
        );
      }

      // Stream completed! Parse metadata blocks from the full text
      const parts = fullText.split("---");
      const metadata = parts[1] || "";

      let suggestions: string[] = [];
      let statePatch: any = null;

      // Extract suggestions block
      if (metadata.includes("[SUGGESTIONS]")) {
        const sugIndex = metadata.indexOf("[SUGGESTIONS]");
        const patchIndex = metadata.indexOf("[STATE_PATCH]");
        
        let sugText = "";
        if (patchIndex !== -1) {
          sugText = metadata.substring(sugIndex + 13, patchIndex).trim();
        } else {
          sugText = metadata.substring(sugIndex + 13).trim();
        }
        
        suggestions = sugText
          .split("\n")
          .map((line) => line.replace(/^-\s*/, "").trim())
          .filter(Boolean);
      }

      // Extract state patch block
      if (metadata.includes("[STATE_PATCH]")) {
        const patchIndex = metadata.indexOf("[STATE_PATCH]");
        const jsonText = metadata.substring(patchIndex + 13).trim();
        try {
          const startBrace = jsonText.indexOf("{");
          const endBrace = jsonText.lastIndexOf("}");
          if (startBrace !== -1 && endBrace !== -1) {
            statePatch = JSON.parse(jsonText.substring(startBrace, endBrace + 1));
          }
        } catch (e) {
          console.error("Failed to parse state patch JSON from stream:", e);
        }
      }

      const hasReachedEnding = Boolean(statePatch?.chapterCompleted);

      // If AI returned no suggestions during an active chapter, use safe defaults.
      if (!hasReachedEnding && suggestions.length === 0) {
        suggestions = [
          "继续深入追问，要求对方给出明确答复。",
          "保持沉默，静静观察对方的神态变化。",
          "转换话题，从另一个角度切入核心问题。"
        ];
      }
      setDialogueSuggestions(hasReachedEnding ? [] : suggestions);

      // Apply numerical state patch updates if exists
      if (statePatch) {
        const nextFramework = { ...generatedFramework };
        
        // 1. Update relationships
        if (statePatch.relationships) {
          nextFramework.characters = nextFramework.characters.map((c) => {
            const delta = statePatch.relationships[c.id] || 0;
            if (delta !== 0) {
              const currentRel = c.relationship ?? 50;
              const nextRel = Math.max(0, Math.min(100, currentRel + delta));
              return { ...c, relationship: nextRel };
            }
            return c;
          });
        }
        
        // 2. Update inventory items (with discovery flags)
        if (statePatch.inventory) {
          const added = statePatch.inventory.add || [];
          const removed = statePatch.inventory.remove || [];
          
          let nextItems = [...nextFramework.items];
          
          if (removed.length > 0) {
            nextItems = nextItems.filter((item) => {
              return !removed.some((remName: string) => 
                item.name.toLowerCase().includes(remName.toLowerCase()) || 
                remName.toLowerCase().includes(item.name.toLowerCase())
              );
            });
          }
          
          for (const addItemName of added) {
            const matchIndex = nextItems.findIndex((item) => item.name === addItemName);
            if (matchIndex === -1) {
              nextItems.push({
                id: `item_added_${Date.now()}_${Math.random()}`,
                name: addItemName,
                description: "在探索剧情中获取的新线索或物品。",
                discovered: true
              });
            } else {
              nextItems[matchIndex] = {
                ...nextItems[matchIndex],
                discovered: true
              } as any;
            }
          }
          
          nextFramework.items = nextItems;
        }

        // 3. Update character moods
        if (statePatch.characterMoods) {
          nextFramework.characters = nextFramework.characters.map((c) => {
            const mood = statePatch.characterMoods[c.id];
            return mood !== undefined ? { ...c, mood } : c;
          });
        }

        // 4. Queue the ending and let the reader reveal the final paragraphs first.
        if (statePatch.storyCompleted && statePatch.chapterCompleted) {
          const summary = statePatch.chapterSummary || statePatch.endingSummary || "故事的核心矛盾已经落定。";
          setChapterSummary(summary);
          setPendingTransitions(null);
          setPendingCompletion({
            destination: "story",
            source: "narrative",
            summary,
            transitions: null,
            endingTitle: statePatch.endingTitle || "你的故事，已在这里圆满落笔",
            endingSummary: statePatch.endingSummary || summary,
          });
        } else if (statePatch.chapterCompleted) {
          const summary = statePatch.chapterSummary || "这一章节的探险目标已达成。";
          setChapterSummary(summary);
          setPendingTransitions(statePatch.characterTransitions || null);
          setPendingCompletion({
            destination: "chapter",
            source: "narrative",
            summary,
            transitions: statePatch.characterTransitions || null,
          });
        }
        
        setGeneratedFramework(nextFramework);
      }

    } catch (err: any) {
      // If the stream was aborted by handleForceChapterEnd, silently discard the temp message
      if (err?.name === 'AbortError') {
        setChatMessages((prev) => prev.filter((msg) => msg.id !== aiTempId));
        return;
      }
      console.error("Streaming error:", err);
      // Clean up empty AI message on failure and push fallback
      setChatMessages((prev) => prev.filter((msg) => msg.id !== aiTempId));
      const charName = generatedFramework.characters[0]?.name || "墨言";
      setChatMessages((prev) => [
        ...prev,
        {
          id: `msg_fallback_${Date.now()}`,
          role: "character",
          characterName: charName,
          content: "（时空流动受阻，当前选择未能得到回应……请检查 API 及模型状态。）"
        }
      ]);
    } finally {
      if (streamAbortRef.current === abortCtrl) {
        streamAbortRef.current = null;
      }
      setIsAIResponding(false);
    }
  };

  // Handle clicking on page to reveal the next paragraph chunk of the active turn
  const handleRevealNext = () => {
    if (isAIResponding) return;
    const lastMsg = chatMessages[chatMessages.length - 1];
    if (!lastMsg || lastMsg.role === "user") return;

    const paragraphs = lastMsg.content.split("\n\n").filter((p) => p.trim());
    if (revealedParagraphsCount < paragraphs.length) {
      setRevealedParagraphsCount((prev) => prev + 1);
    }
  };

  const handlePageTurnComplete = () => {
    if (pageTurnPhase !== "turning" || !pendingCompletion) return;
    setPageTurnPhase("settled");

    if (pendingCompletion.destination === "story") {
      const completedAt = new Date().toISOString();
      saveChapterRecord({
        number: currentChapterNumber,
        summary: pendingCompletion.summary,
        completedAt,
      });
      completeStory({
        chapterNumber: currentChapterNumber,
        title: pendingCompletion.endingTitle || "你的故事，已在这里圆满落笔",
        summary: pendingCompletion.endingSummary || pendingCompletion.summary,
        completedAt,
      });
      setShowChapterCompleteOverlay(false);
      pageTurnLockRef.current = false;
      return;
    }

    setShowChapterCompleteOverlay(true);
  };

  // Perform cinematic timeline transition to next chapter
  const handleTransitionToNextChapter = async () => {
    setShowChapterCompleteOverlay(false);

    // 1. Apply character transitions (leave → inactive, enter → add to characters)
    let nextFramework = { ...generatedFramework } as any;
    if (pendingTransitions) {
      const { leave, enter } = pendingTransitions;
      if (leave && leave.length > 0) {
        nextFramework.characters = nextFramework.characters.map((c: any) =>
          leave.includes(c.id) ? { ...c, status: "inactive" } : c
        );
      }
      if (enter && enter.length > 0) {
        const addedEnter = enter.map((newChar: any) => ({
          ...newChar,
          status: "active",
          relationship: newChar.relationship ?? 50
        }));
        nextFramework.characters = [...nextFramework.characters, ...addedEnter];
      }
    }

    // 2. Apply pre-generated next chapter scene & items (replace scene, append new items)
    const chapterData = nextChapterData;
    if (chapterData) {
      // Replace current scene with new scene (or keep existing if null)
      if (chapterData.newScene) {
        nextFramework.scenes = [chapterData.newScene];
      }
      // Append new items (all discovered: false)
      if (chapterData.newItems && chapterData.newItems.length > 0) {
        nextFramework.items = [...(nextFramework.items || []), ...chapterData.newItems];
      }
      // Update chapter goal for the new chapter so orchestrator can judge chapter completion
      if (chapterData.nextChapterGoal) {
        nextFramework.chapterGoal = chapterData.nextChapterGoal;
      }
    }

    setGeneratedFramework(nextFramework);

    // 3. Persist completed chapter record before incrementing
    if (chapterSummary) {
      saveChapterRecord({
        number: currentChapterNumber,
        summary: chapterSummary,
        completedAt: new Date().toISOString(),
      });
    }

    // 4. Increment chapter count and reset dialogue state
    const nextChapter = currentChapterNumber + 1;
    setCurrentChapterNumber(nextChapter);
    setChatMessages([]);
    setDialogueSuggestions([]);
    setChapterSummary("");
    setPendingTransitions(null);
    setNextChapterData(null);
    setRevealedParagraphsCount(1);
    setPageTurnPhase("idle");
    setPendingCompletion(null);
    pageTurnLockRef.current = false;
    setShowChapterCompleteOverlay(false);

    // 4. Use pre-generated opening narrative if available; otherwise fallback to API stream
    const openingText = chapterData?.openingNarrative;
    const openingSuggestions = chapterData?.suggestions || [];

    if (openingText) {
      // Directly display the pre-generated opening (typewriter will animate it)
      const aiTempId = `msg_ai_stream_${Date.now()}`;
      setChatMessages([{ id: aiTempId, role: "narrator", content: openingText }]);
      setDialogueSuggestions(openingSuggestions);
    } else {
      // Fallback: call /api/chat to generate opening narrative on the fly
      setIsAIResponding(true);
      const aiTempId = `msg_ai_stream_${Date.now()}`;
      setChatMessages([{ id: aiTempId, role: "narrator", content: "" }]);

      const transitionMsg = `【章节流转】开启第 ${nextChapter} 章。上一章故事概要：${chapterSummary}。请为新章节撰写精彩的开篇旁白（150字左右），交代当前环境与危机，引导与在场角色的第一句对话。`;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            framework: nextFramework,
            messages: [{ id: `msg_tr_${Date.now()}`, role: "user", content: transitionMsg }],
            userInput: transitionMsg,
            tone: "章节切换",
            chapterNumber: nextChapter,
          })
        });

        if (!response.ok) throw new Error("Failed to start new chapter");
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Response body not readable");

        const decoder = new TextDecoder();
        let fullText = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          const novelText = fullText.split("---")[0]?.trim() || "";
          setChatMessages([{ id: aiTempId, role: "narrator", content: novelText }]);
        }

        const metadata = fullText.split("---")[1] || "";
        if (metadata.includes("[SUGGESTIONS]")) {
          const sugIndex = metadata.indexOf("[SUGGESTIONS]");
          const patchIndex = metadata.indexOf("[STATE_PATCH]");
          const sugText = patchIndex !== -1 ? metadata.substring(sugIndex + 13, patchIndex) : metadata.substring(sugIndex + 13);
          setDialogueSuggestions(sugText.split("\n").map((l) => l.replace(/^-\s*/, "").trim()).filter(Boolean));
        }
      } catch (e) {
        console.error("Fallback transition API error:", e);
        setChatMessages([{ id: `msg_err_${Date.now()}`, role: "narrator", content: "（进入下一章剧情时受阻，请返回书架重试。）" }]);
      } finally {
        setIsAIResponding(false);
      }
    }
  };

  return (
    <>
      <div
        className="min-h-dvh bg-[#fcfcfc] text-[#18181b] flex flex-col font-sans selection:bg-neutral-100 selection:text-neutral-900"
        inert={isOverlayVisible}
        aria-hidden={isOverlayVisible || undefined}
      >
      {/* Upper Navigation Bar */}
      <header className="h-14 px-6 md:px-8 border-b border-neutral-100/80 bg-white/70 backdrop-blur-md flex items-center justify-between sticky top-0 z-50">
        <div 
          onClick={() => router.push("/")}
          className="flex items-center gap-3 cursor-pointer group active:scale-98 transition-all"
          title="返回主页"
        >
          <span className="h-8 w-8 rounded-lg bg-neutral-900 flex items-center justify-center text-white font-serif font-bold text-sm tracking-tight shadow-sm group-hover:scale-105 transition-transform">T</span>
          <h1 className="text-base font-medium tracking-tight font-serif text-[#09090b]">
            TaleBox <span className="text-xs font-normal text-zinc-400 font-sans ml-1">Draft Workshop</span>
          </h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <span className="hover:text-zinc-900 transition-colors flex items-center gap-1.5 font-medium cursor-pointer">
            <Laptop className="h-4 w-4" />
            <span>极简白色版</span>
          </span>
          <button
            type="button"
            onClick={() => setIsFocusMode((value) => !value)}
            aria-pressed={isFocusMode}
            className="hidden md:flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-neutral-900 hover:text-zinc-950"
          >
            {isFocusMode ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
            <span>{isFocusMode ? "退出专注" : "专注阅读"}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 md:px-6 py-3 flex flex-col items-center justify-center">
        <div className={`w-full h-[calc(100dvh-8rem)] min-h-[480px] bg-white rounded-2xl border border-neutral-200/60 subtle-shadow flex overflow-hidden ${isFocusMode ? "md:h-[calc(100dvh-5rem)]" : ""}`}>
          
          {/* Left Context Side Panel */}
          <aside className={isFocusMode ? "hidden" : "w-60 border-r border-neutral-100/80 bg-zinc-50/50 p-4 flex-col justify-between hidden md:flex"}>
            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-zinc-400 font-medium tracking-wider uppercase block">正在阅读故事</span>
                <h3 className="text-sm font-semibold font-serif text-zinc-950 mt-1">《{generatedFramework.title}》</h3>
                <span className="inline-block mt-1 text-[10px] bg-neutral-900 text-white px-2 py-0.5 rounded font-mono">第 {currentChapterNumber} 章</span>
              </div>

              {/* Protagonist (You) Character Card */}
              {(() => {
                const protagonist = generatedFramework.characters.find((c) => c.id === "char_1") || generatedFramework.characters[0];
                if (!protagonist) return null;
                return (
                  <div className="space-y-2">
                    <span className="text-[10px] text-zinc-400 font-semibold tracking-wider uppercase block">👤 我扮演的角色</span>
                    <div className="p-3.5 rounded-xl border border-neutral-300 bg-neutral-900 text-white space-y-1 shadow">
                      <div className="flex items-center gap-2">
                        <span className="h-4.5 w-4.5 rounded-full bg-white text-neutral-950 flex items-center justify-center text-[9px] font-bold">
                          {protagonist.name[0]}
                        </span>
                        <span className="text-xs font-bold font-serif">{protagonist.name}</span>
                      </div>
                      <p className="text-[10px] text-zinc-300 line-clamp-1">{protagonist.role}</p>
                      <p className="text-[9px] text-zinc-400 font-serif leading-relaxed line-clamp-2">{protagonist.personality || protagonist.persona || "暂无性格设定"}</p>
                    </div>
                  </div>
                );
              })()}

              {/* NPCs List in Left Panel (Only show active status NPCs) */}
              <div className="space-y-2">
                <span className="text-[10px] text-zinc-400 font-semibold tracking-wider uppercase block">👥 遭遇的NPC角色</span>
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {generatedFramework.characters.filter((c) => c.id !== "char_1" && c.status !== "inactive").map((char) => (
                    <div key={char.id} className="p-3 rounded-xl border border-neutral-200 bg-white space-y-1 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-4.5 w-4.5 rounded-full bg-zinc-200 text-zinc-700 flex items-center justify-center text-[8px] font-bold">
                            {char.name[0]}
                          </span>
                          <span className="text-xs font-semibold text-zinc-950 font-serif">{char.name}</span>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-50 border border-neutral-200/60 text-zinc-500 font-mono font-medium" title="当前好感度">
                          🤝 {char.relationship ?? 50}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 line-clamp-1">{char.role}</p>
                      {char.mood && (
                        <div className="text-[9px] text-purple-600 bg-purple-50/50 border border-purple-100/50 rounded px-1.5 py-0.5 mt-1 font-serif line-clamp-1 animate-pulse-subtle">
                          🎭 心境: {char.mood}
                        </div>
                      )}
                    </div>
                  ))}
                  {generatedFramework.characters.filter((c) => c.id !== "char_1" && c.status !== "inactive").length === 0 && (
                    <span className="text-[10px] text-zinc-400 italic block py-2">（此场景尚无遇到的NPC）</span>
                  )}
                </div>
              </div>

              {/* Items in Left Panel (Only show discovered items) */}
              <div className="space-y-2">
                <span className="text-[10px] text-zinc-400 font-medium tracking-wider uppercase block font-semibold">🔍 发现的奇珍与线索</span>
                <div className="space-y-1.5 max-h-[145px] overflow-y-auto pr-1">
                  {generatedFramework.items.filter((item) => item.discovered).map((item) => (
                    <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg border border-dashed border-zinc-200 bg-white text-[10px] text-zinc-600 shadow-sm" title={item.description}>
                      <Box className="h-3 w-3 text-zinc-400 flex-shrink-0" />
                      <span className="truncate font-medium">{item.name}</span>
                    </div>
                  ))}
                  {generatedFramework.items.filter((item) => item.discovered).length === 0 && (
                    <span className="text-[10px] text-zinc-400 italic block py-1">（尚未发现物品线索）</span>
                  )}
                </div>
              </div>
            </div>

            {/* Chapter Actions */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleForceChapterEnd}
                disabled={pageTurnPhase !== "idle" || storyStatus === "completed"}
                title="根据当前进展收束本章"
                className="w-full py-2.5 bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed rounded-lg text-xs font-semibold transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
              >
                <BookOpen className="h-3.5 w-3.5" strokeWidth={1.7} />
                <span>在此翻篇</span>
              </button>
              <button
                onClick={() => { router.push("/bookshelf"); }}
                className="w-full py-2 bg-white border border-neutral-200 hover:border-neutral-900 hover:bg-neutral-50 rounded-lg text-xs font-medium transition-all text-zinc-600 shadow-sm"
              >
                <span>返回小说书架</span>
              </button>
            </div>
          </aside>

          {/* Chat Box Panel */}
          <section className="flex-1 flex flex-col justify-between bg-[#faf9f6] h-full relative">
            
            {/* Header */}
            <header className="h-12 px-6 md:px-8 border-b border-neutral-100/60 bg-[#faf9f6]/95 backdrop-blur-sm flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-neutral-900 animate-pulse"></span>
                <span className="text-xs font-bold text-zinc-800 font-serif">{generatedFramework.scenes[0]?.title || "开篇场景"}</span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">SCENE 01 / {generatedFramework.scenes[0]?.location || "默认地点"}</span>
            </header>

            {/* Dialogue Chat area - clicking this area reveals the next paragraph */}
            <div 
              onClick={handleRevealNext}
              className={`flex-1 overflow-y-auto space-y-4 cursor-pointer selection:bg-neutral-200 outline-none ${isFocusMode ? "px-8 md:px-16 py-6" : "px-6 md:px-8 py-5"}`}
              title="点击书页空白处可继续阅读"
            >
              {chatMessages.map((msg, idx) => {
                const isLastMsg = idx === chatMessages.length - 1;
                const isAiMsg = msg.role !== "user";
                const limit = isLastMsg && isAiMsg ? revealedParagraphsCount : undefined;
                return (
                  <ChatBubble 
                    key={msg.id} 
                    message={msg} 
                    revealLimit={limit}
                    isStreaming={isAIResponding && isLastMsg && isAiMsg}
                    characters={generatedFramework.characters}
                    primaryCharacterAvatar={generatedFramework.characters[0]?.name[0] || "AI"} 
                    protagonistName={generatedFramework.characters.find((c) => c.id === "char_1")?.name}
                  />
                );
              })}

              {/* AI typing simulation */}
              {isAIResponding && (
                <div className="flex gap-3 max-w-[85%] animate-pulse">
                  <span className="h-6 w-6 rounded bg-neutral-900 text-white flex items-center justify-center text-[9px] font-bold mt-0.5 shadow-sm">
                    AI
                  </span>
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-400 block font-sans">AI 场景主笔</span>
                    <div className="px-4 py-2 rounded-xl bg-neutral-50 border border-neutral-100 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "0ms" }}></span>
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "300ms" }}></span>
                    </div>
                  </div>
                </div>
              )}

              {/* Click to continue Indicator */}
              {(() => {
                const lastMsg = chatMessages[chatMessages.length - 1];
                if (!lastMsg || lastMsg.role === "user" || isAIResponding) return null;
                const paragraphs = lastMsg.content.split("\n\n").filter((p) => p.trim());
                if (revealedParagraphsCount < paragraphs.length) {
                  return (
                    <div className="pt-2 flex justify-center animate-pulse">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent duplicate trigger from container
                          handleRevealNext();
                        }}
                        className="px-4 py-2 rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-50 text-purple-600 hover:text-purple-800 text-xs font-serif font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                      >
                        <span>▼ 点击继续阅读故事...</span>
                      </button>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Natural chapter/story ending — only offered after the final paragraphs are read. */}
              {(() => {
                const lastMsg = chatMessages[chatMessages.length - 1];
                if (!lastMsg || lastMsg.role === "user" || isAIResponding) return null;
                const paragraphs = lastMsg.content.split("\n\n").filter((p) => p.trim());
                if (revealedParagraphsCount >= paragraphs.length && pendingCompletion) {
                  const isStoryEnding = pendingCompletion.destination === "story";
                  return (
                    <div className="pt-4 border-t border-dashed border-neutral-200/50 space-y-3 mt-4 animate-fade-in-up">
                      <span className="text-[10px] text-amber-700 uppercase tracking-wider block font-semibold font-sans">
                        {isStoryEnding ? "故事的最后一行已经写成" : "这一章已抵达句点"}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          beginPageTurn(pendingCompletion);
                        }}
                        className="w-full min-h-12 text-center p-3.5 text-xs bg-neutral-900 text-white hover:bg-neutral-800 rounded-xl transition-all font-serif font-bold shadow active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2"
                      >
                        {isStoryEnding ? "为故事落笔" : "翻开章末"}
                      </button>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Scroll anchor - always at the bottom of the chat area */}
              <div ref={chatBottomRef} className="h-1" />
            </div>

            {/* === SUGGESTIONS PANEL: Fixed between chat and input, shown ONLY when all paragraphs are revealed === */}
            {(() => {
              const lastMsg = chatMessages[chatMessages.length - 1];
              const paragraphs = lastMsg && lastMsg.role !== "user" ? lastMsg.content.split("\n\n").filter((p) => p.trim()) : [];
              const allRevealed = revealedParagraphsCount >= paragraphs.length;

              if (allRevealed && dialogueSuggestions.length > 0 && !isAIResponding && !pendingCompletion) {
                return (
                  <div className="px-6 md:px-8 py-2 border-t border-neutral-100 bg-[#faf9f6]/95 animate-fade-in-up">
                    <button
                      type="button"
                      onClick={() => setIsSuggestionsExpanded((value) => !value)}
                      aria-expanded={isSuggestionsExpanded}
                      className="w-full flex items-center justify-between text-left py-1 text-[10px] text-zinc-400 uppercase tracking-wider font-semibold font-sans hover:text-zinc-700 transition-colors"
                    >
                      <span>✦ 抉择下一步行动 · {dialogueSuggestions.length} 个建议</span>
                      <span>{isSuggestionsExpanded ? "收起" : "展开"}</span>
                    </button>
                    {isSuggestionsExpanded && (
                      <div className="mt-2 flex flex-col gap-1.5">
                        {dialogueSuggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setUserInput(suggestion)}
                            className="w-full text-left px-3 py-2 text-xs bg-white hover:bg-neutral-900 hover:text-white rounded-xl border border-neutral-200/70 transition-all duration-200 shadow-sm leading-relaxed font-serif active:scale-[0.99] hover:-translate-y-0.5"
                          >
                            <span className="font-mono text-zinc-400 mr-2">0{idx + 1}.</span>
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })()}

            {/* Dialogue inputs only (Very compact footer) */}
            <div className="px-4 md:px-6 py-3 border-t border-neutral-100 bg-[#fafafa]/50">
              {/* Form input with Tone Selector */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }} 
                className="flex flex-col gap-2 bg-white p-3 rounded-2xl border border-neutral-100 shadow-sm"
              >
                {/* Attitude/Tone Selector */}
                <div className="flex items-center gap-1.5 border-b border-neutral-50 pb-2 mb-0.5 overflow-x-auto select-none no-scrollbar">
                  <span className="text-[10px] text-zinc-400 font-medium mr-1 flex-shrink-0">🎭 说话语调 Stance:</span>
                  {[
                    { label: "🤝 诚恳", value: "诚恳 (态度诚恳温和，拉近心理距离)" },
                    { label: "🕵️ 试探", value: "试探 (试探对方反应，暗中揣摩对方是否有隐瞒或谎言)" },
                    { label: "⚡ 强硬", value: "强硬 (态度强硬冰冷，施加威慑力或压迫感)" },
                    { label: "😏 戏谑", value: "戏谑 (幽默取乐或玩世不恭，缓和或挑衅对手)" },
                    { label: "✉️ 普通", value: "普通 (正常的礼貌谈吐或行为动作描述)" }
                  ].map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => setActiveTone(t.value)}
                      disabled={Boolean(pendingCompletion) || pageTurnPhase !== "idle" || storyStatus === "completed"}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all flex-shrink-0 active:scale-95 ${
                        activeTone === t.value
                          ? "bg-neutral-900 text-white shadow-sm scale-105"
                          : "bg-zinc-50 border border-neutral-200/50 text-zinc-500 hover:text-zinc-900 hover:bg-neutral-100"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 relative items-center">
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    disabled={isAIResponding || Boolean(pendingCompletion) || pageTurnPhase !== "idle" || storyStatus === "completed"}
                    placeholder={pendingCompletion ? "这一章已经落笔，请翻开章末" : isAIResponding ? "AI 正在编织命运分支..." : `以【${activeTone.split(" ")[0]}】态度，输入你的选择或对白...`}
                    className="flex-1 px-4 py-2 border border-neutral-200/80 rounded-xl text-xs outline-none bg-white focus:border-neutral-900 disabled:bg-zinc-100 disabled:text-zinc-400 transition-colors shadow-inner font-serif"
                  />
                  <button
                    type="submit"
                    disabled={!userInput.trim() || isAIResponding || Boolean(pendingCompletion) || pageTurnPhase !== "idle" || storyStatus === "completed"}
                    className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all ${
                      !userInput.trim() || isAIResponding || Boolean(pendingCompletion) || pageTurnPhase !== "idle" || storyStatus === "completed"
                        ? "bg-zinc-100 text-zinc-300 cursor-not-allowed"
                        : "bg-neutral-900 text-white hover:bg-neutral-800 shadow"
                    }`}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </div>

          </section>
        </div>
      </main>

      {/* Subtle Footer */}
      <footer className={`py-3 border-t border-neutral-100 bg-white text-center text-[10px] text-zinc-400 ${isFocusMode ? "hidden" : ""}`}>
        TaleBox Interactive Novel Lab © 2026. Made with Premium Minimalism.
      </footer>

      </div>

      {pageTurnPhase === "turning" && pendingCompletion && (
        <PageTurnTransition
          chapterNumber={currentChapterNumber}
          destination={pendingCompletion.destination}
          onComplete={handlePageTurnComplete}
        />
      )}

      {showChapterCompleteOverlay && (
        <ChapterCompleteOverlay
          chapterNumber={currentChapterNumber}
          summary={chapterSummary}
          framework={generatedFramework}
          transitions={pendingTransitions}
          nextChapterData={nextChapterData}
          isGeneratingNextChapter={isGeneratingNextChapter}
          onContinue={handleTransitionToNextChapter}
          onBackToBookshelf={() => router.push("/bookshelf")}
        />
      )}

      {storyStatus === "completed" && storyEnding && (
        <StoryEndingOverlay
          framework={generatedFramework}
          ending={storyEnding}
          completedChapterCount={storyChapters.length}
          onBackToBookshelf={() => router.push("/bookshelf")}
        />
      )}
    </>
  );
}
