"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Box, Laptop } from "lucide-react";
import { useStory, Message } from "../context/StoryContext";
import ChatBubble from "../../components/ChatBubble";

export default function DialoguePage() {
  const router = useRouter();
  const {
    generatedFramework,
    setGeneratedFramework,
    chatMessages,
    setChatMessages,
    dialogueSuggestions,
    setDialogueSuggestions
  } = useStory();

  const [userInput, setUserInput] = useState<string>("");
  const [activeTone, setActiveTone] = useState<string>("普通");
  const [isAIResponding, setIsAIResponding] = useState<boolean>(false);
  const [revealedParagraphsCount, setRevealedParagraphsCount] = useState<number>(1);
  const [showChapterCompleteOverlay, setShowChapterCompleteOverlay] = useState<boolean>(false);
  const [chapterSummary, setChapterSummary] = useState<string>("");
  const [pendingTransitions, setPendingTransitions] = useState<any>(null);
  const [currentChapterNumber, setCurrentChapterNumber] = useState<number>(1);

  // If no story setup exists, redirect back to creation root inside useEffect
  React.useEffect(() => {
    if (!generatedFramework) {
      router.push("/creation");
    }
  }, [generatedFramework, router]);

  if (!generatedFramework) {
    return null;
  }

  // Send dialogue message to Server API and read the text stream chunk-by-chunk
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanInput = userInput.trim();
    if (!cleanInput || isAIResponding) return;

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

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          framework: generatedFramework,
          messages: nextMessages,
          userInput: cleanInput,
          tone: activeTone
        })
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

        // Split text at "---" to separate novel text from metadata block
        const parts = fullText.split("---");
        const novelText = parts[0]?.trim() || "";

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

      setDialogueSuggestions(suggestions);

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

        // 4. Update chapter completion triggers
        if (statePatch.chapterCompleted) {
          setChapterSummary(statePatch.chapterSummary || "这一章节的探险目标已达成。");
          setPendingTransitions(statePatch.characterTransitions || null);
        }
        
        setGeneratedFramework(nextFramework);
      }

    } catch (err: any) {
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

  // Perform cinematic timeline transition to next chapter
  const handleTransitionToNextChapter = async () => {
    setShowChapterCompleteOverlay(false);
    
    // Apply leaving & entering NPC character list transitions
    let nextFramework = { ...generatedFramework };
    if (pendingTransitions) {
      const { leave, enter } = pendingTransitions;
      
      if (leave && leave.length > 0) {
        nextFramework.characters = nextFramework.characters.map((c) => 
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
    
    setGeneratedFramework(nextFramework);
    
    // Increment chapter count
    const nextChapter = currentChapterNumber + 1;
    setCurrentChapterNumber(nextChapter);
    
    // Reset dialogue stream states
    setChatMessages([]);
    setDialogueSuggestions([]);
    setChapterSummary("");
    setPendingTransitions(null);
    setRevealedParagraphsCount(1);
    setIsAIResponding(true);

    const transitionMsg = `【章节流转】开启第 ${nextChapter} 章。上一章故事概要为：${chapterSummary}。现在主角已动身前往新场景，遇到了新人物。请为新章节设计并撰写第一段开篇旁白描述（150字左右），交代当前的环境与危机，并引导与在场新角色的第一句对话。`;
    
    const aiTempId = `msg_ai_stream_${Date.now()}`;
    setChatMessages([
      {
        id: aiTempId,
        role: "narrator",
        content: ""
      }
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          framework: nextFramework,
          messages: [
            {
              id: `msg_transition_sys_${Date.now()}`,
              role: "user",
              content: transitionMsg
            }
          ],
          userInput: transitionMsg,
          tone: "章节切换"
        })
      });

      if (!response.ok) {
        throw new Error("Failed to start new chapter");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body not readable");
      }

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        const parts = fullText.split("---");
        const novelText = parts[0]?.trim() || "";

        setChatMessages([{ id: aiTempId, role: "narrator", content: novelText }]);
      }

      const parts = fullText.split("---");
      const metadata = parts[1] || "";
      let suggestions: string[] = [];
      let statePatch: any = null;

      if (metadata.includes("[SUGGESTIONS]")) {
        const sugIndex = metadata.indexOf("[SUGGESTIONS]");
        const patchIndex = metadata.indexOf("[STATE_PATCH]");
        let sugText = patchIndex !== -1 ? metadata.substring(sugIndex + 13, patchIndex).trim() : metadata.substring(sugIndex + 13).trim();
        suggestions = sugText.split("\n").map(l => l.replace(/^-\s*/, "").trim()).filter(Boolean);
      }

      if (metadata.includes("[STATE_PATCH]")) {
        const patchIndex = metadata.indexOf("[STATE_PATCH]");
        const jsonText = metadata.substring(patchIndex + 13).trim();
        try {
          const startBrace = jsonText.indexOf("{");
          const endBrace = jsonText.lastIndexOf("}");
          if (startBrace !== -1 && endBrace !== -1) {
            statePatch = JSON.parse(jsonText.substring(startBrace, endBrace + 1));
          }
        } catch (e) {}
      }

      setDialogueSuggestions(suggestions);

      if (statePatch) {
        const updatedFramework = { ...nextFramework };
        if (statePatch.relationships) {
          updatedFramework.characters = updatedFramework.characters.map((c) => {
            const delta = statePatch.relationships[c.id] || 0;
            const currentRel = c.relationship ?? 50;
            return { ...c, relationship: Math.max(0, Math.min(100, currentRel + delta)) };
          });
        }
        if (statePatch.inventory) {
          const added = statePatch.inventory.add || [];
          const removed = statePatch.inventory.remove || [];
          let nextItems = [...updatedFramework.items];
          nextItems = nextItems.filter(item => !removed.some((rem: string) => item.name.toLowerCase().includes(rem.toLowerCase())));
          for (const item of added) {
            const idx = nextItems.findIndex(i => i.name === item);
            if (idx === -1) {
              nextItems.push({ id: `item_${Date.now()}`, name: item, description: "新获取的物品。", discovered: true });
            } else {
              nextItems[idx] = { ...nextItems[idx], discovered: true } as any;
            }
          }
          updatedFramework.items = nextItems;
        }
        setGeneratedFramework(updatedFramework);
      }

    } catch (e) {
      console.error("Transition API error:", e);
      setChatMessages([
        {
          id: `msg_err_${Date.now()}`,
          role: "narrator",
          content: "（进入下一章剧情时受阻，请点击返回书架重试。）"
        }
      ]);
    } finally {
      setIsAIResponding(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-[#18181b] flex flex-col font-sans selection:bg-neutral-100 selection:text-neutral-900">
      {/* Upper Navigation Bar */}
      <header className="h-16 px-8 border-b border-neutral-100/80 bg-white/70 backdrop-blur-md flex items-center justify-between sticky top-0 z-50">
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
        <div className="flex items-center gap-6 text-sm text-zinc-500">
          <span className="hover:text-zinc-900 transition-colors flex items-center gap-1.5 font-medium cursor-pointer">
            <Laptop className="h-4 w-4" />
            <span>极简白色版</span>
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-6 flex flex-col items-center justify-center">
        <div className="w-full max-w-5xl lg:max-w-6xl h-[82vh] bg-white rounded-2xl border border-neutral-200/60 subtle-shadow flex overflow-hidden">
          
          {/* Left Context Side Panel */}
          <aside className="w-64 border-r border-neutral-100/80 bg-zinc-50/50 p-5 flex flex-col justify-between hidden md:flex">
            <div className="space-y-6">
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
                      <p className="text-[9px] text-zinc-400 font-serif leading-relaxed line-clamp-2">{protagonist.persona}</p>
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

            {/* Reset Actions */}
            <button 
              onClick={() => {
                router.push("/bookshelf");
              }}
              className="w-full py-2 bg-white border border-neutral-200 hover:border-neutral-900 hover:bg-neutral-50 rounded-lg text-xs font-medium transition-all text-zinc-600 shadow-sm"
            >
              <span>返回小说书架</span>
            </button>
          </aside>

          {/* Chat Box Panel */}
          <section className="flex-1 flex flex-col justify-between bg-[#faf9f6] h-full relative">
            
            {/* Header */}
            <header className="h-14 px-8 border-b border-neutral-100/60 bg-[#faf9f6]/95 backdrop-blur-sm flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-neutral-900 animate-pulse"></span>
                <span className="text-xs font-bold text-zinc-800 font-serif">{generatedFramework.scenes[0]?.title || "开篇场景"}</span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">SCENE 01 / {generatedFramework.scenes[0]?.location || "默认地点"}</span>
            </header>

            {/* Dialogue Chat area - clicking this area reveals the next paragraph */}
            <div 
              onClick={handleRevealNext}
              className="flex-1 overflow-y-auto px-10 py-8 space-y-5 cursor-pointer selection:bg-neutral-200"
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

              {/* End of Chapter Trigger Button */}
              {(() => {
                const lastMsg = chatMessages[chatMessages.length - 1];
                if (!lastMsg || lastMsg.role === "user" || isAIResponding) return null;
                const paragraphs = lastMsg.content.split("\n\n").filter((p) => p.trim());
                if (revealedParagraphsCount === paragraphs.length && chapterSummary) {
                  return (
                    <div className="pt-4 border-t border-dashed border-neutral-200/50 space-y-3 mt-4 animate-fade-in-up">
                      <span className="text-[10px] text-purple-600 uppercase tracking-wider block font-semibold font-sans animate-pulse">
                        ✨ 达成当前章节主线终点：
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowChapterCompleteOverlay(true);
                        }}
                        className="w-full text-center p-3.5 text-xs bg-neutral-900 text-white hover:bg-neutral-800 rounded-xl transition-all font-serif font-bold shadow active:scale-99 animate-pulse-subtle"
                      >
                        🎬 完结本章，进入下一章
                      </button>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Inline Suggestions inside the book page (Only shown when all paragraphs are revealed and chapter is not complete) */}
              {(() => {
                const lastMsg = chatMessages[chatMessages.length - 1];
                const paragraphs = lastMsg && lastMsg.role !== "user" ? lastMsg.content.split("\n\n").filter((p) => p.trim()) : [];
                const allRevealed = revealedParagraphsCount >= paragraphs.length;
                if (allRevealed && dialogueSuggestions.length > 0 && !isAIResponding && !chapterSummary) {
                  return (
                    <div className="pt-6 border-t border-dashed border-neutral-200/50 space-y-3 animate-fade-in-up mt-4">
                      <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-semibold font-sans">
                        ✦ 抉择下一步行动 / 追问 (Choose your next move):
                      </span>
                      <div className="flex flex-col gap-2.5">
                        {dialogueSuggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUserInput(suggestion);
                            }}
                            className="w-full text-left p-3 text-xs bg-white hover:bg-neutral-900 hover:text-white rounded-xl border border-neutral-200/70 transition-all duration-200 shadow-sm leading-relaxed font-serif active:scale-[0.99] hover:-translate-y-0.5"
                          >
                            <span className="font-mono text-zinc-400 mr-2 group-hover:text-white/60">0{idx + 1}.</span>
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Dialogue inputs only (Very compact footer) */}
            <div className="p-4 border-t border-neutral-100 bg-[#fafafa]/50">
              {/* Form input with Tone Selector */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }} 
                className="flex flex-col gap-2.5 bg-white p-3.5 rounded-2xl border border-neutral-100 shadow-sm"
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
                    disabled={isAIResponding}
                    placeholder={isAIResponding ? "AI 正在编织命运分支..." : `以【${activeTone.split(" ")[0]}】态度，输入你的选择或对白...`}
                    className="flex-1 px-4 py-2.5 border border-neutral-200/80 rounded-xl text-xs outline-none bg-white focus:border-neutral-900 disabled:bg-zinc-100 disabled:text-zinc-400 transition-colors shadow-inner font-serif"
                  />
                  <button
                    type="submit"
                    disabled={!userInput.trim() || isAIResponding}
                    className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all ${
                      !userInput.trim() || isAIResponding
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
      <footer className="py-8 border-t border-neutral-100 bg-white text-center text-[10px] text-zinc-400">
        TaleBox Interactive Novel Lab © 2026. Made with Premium Minimalism.
      </footer>

      {/* Cinematic Full Screen Chapter Complete Overlay */}
      {showChapterCompleteOverlay && (
        <div className="fixed inset-0 bg-neutral-950 text-white z-50 flex flex-col items-center justify-center p-8 space-y-8 animate-fade-in select-none">
          <style>{`
            @keyframes fade-in {
              0% { opacity: 0; }
              100% { opacity: 1; }
            }
            .animate-fade-in {
              animation: fade-in 0.8s ease-out forwards;
            }
          `}</style>
          <div className="space-y-3 text-center">
            <span className="text-zinc-500 font-mono tracking-widest text-xs block uppercase animate-pulse">
              CHRONOLOGY / 历史大事记
            </span>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-white tracking-wide">
              第 {currentChapterNumber} 章 完结
            </h2>
            <div className="w-16 h-px bg-zinc-700 mx-auto my-6" />
          </div>

          <div className="max-w-xl w-full bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 md:p-8 space-y-4 shadow-2xl">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">本章故事概要 Summary:</span>
            <p className="text-sm font-serif leading-relaxed text-zinc-300 text-justify indent-8 tracking-wide">
              {chapterSummary}
            </p>
          </div>

          <div className="pt-8">
            <button
              type="button"
              onClick={handleTransitionToNextChapter}
              className="px-8 py-3 bg-white text-neutral-950 hover:bg-zinc-200 rounded-xl text-sm font-serif font-bold tracking-wider transition-all shadow-lg active:scale-95 hover:shadow-xl"
            >
              开启下一章 ➔
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
