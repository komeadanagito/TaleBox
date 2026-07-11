"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  BookOpen, Plus, Trash2, Box, Users, MapPin, 
  MessageSquare, ChevronRight, Upload, Sparkles, 
  Laptop, X, ArrowRight 
} from "lucide-react";
import { useStory } from "../context/StoryContext";
import ThreeBookshelf from "../../components/ThreeBookshelf";
import { deleteImportedNovel, listChapterSessions, listImportedNovels } from "../../lib/import-novel/store";
import type { ImportedNovel } from "../../lib/import-novel/types";

export default function BookshelfPage() {
  const router = useRouter();
  const { stories, loadStory, createNewStory, deleteStory } = useStory();
  const [shelfTab, setShelfTab] = useState<"create" | "upload">("create");
  const [importedNovels, setImportedNovels] = useState<Array<ImportedNovel & { currentChapter: number; readingProgress: number; resumePath: string }>>([]);

  useEffect(() => {
    void Promise.all([listImportedNovels(), listChapterSessions()]).then(([novels, sessions]) => {
      setImportedNovels(novels.map((novel) => {
        const novelSessions = sessions.filter((session) => session.novelId === novel.id);
        const highestChapter = novelSessions.reduce((highest, session) => Math.max(highest, session.chapterNumber), 0);
        const chapterSessions = novelSessions.filter((session) => session.chapterNumber === highestChapter).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
        const activeSession = chapterSessions[0];
        if (!activeSession) return { ...novel, currentChapter: 1, readingProgress: 0, resumePath: `/story/${novel.id}/chapter/1/setup` };
        const moveToNext = activeSession.status === "completed" && activeSession.chapterNumber < novel.chapters.length;
        const currentChapter = moveToNext ? activeSession.chapterNumber + 1 : activeSession.chapterNumber;
        const completedFraction = activeSession.status === "completed" ? 1 : (activeSession.progress || 0) / 100;
        const readingProgress = Math.min(100, Math.max(1, Math.round(((activeSession.chapterNumber - 1 + completedFraction) / novel.chapters.length) * 100)));
        const modeQuery = activeSession.driveMode === "ai" ? "&mode=ai" : "";
        const resumePath = moveToNext
          ? `/story/${novel.id}/chapter/${currentChapter}/setup`
          : activeSession.status === "completed"
            ? `/story/${novel.id}/chapter/${activeSession.chapterNumber}/play?role=${encodeURIComponent(activeSession.roleId)}${modeQuery}`
            : `/story/${novel.id}/chapter/${activeSession.chapterNumber}/play?role=${encodeURIComponent(activeSession.roleId)}${modeQuery}`;
        return { ...novel, currentChapter, readingProgress, resumePath };
      }));
    }).catch((error) => console.error("Failed to load imported bookshelf:", error));
  }, []);
  
  // Modal states for 3D page flipping details view
  const [selectedStory, setSelectedStory] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isModalBurning, setIsModalBurning] = useState(false);

  // Deletion tracking state to sync WebGL combustion animation
  const [deletingStoryId, setDeletingStoryId] = useState<string | null>(null);

  const handleStartNewCreation = () => {
    if (shelfTab === "upload") {
      router.push("/creation/import-novel");
      return;
    }
    createNewStory();
    router.push("/creation");
  };

  const handleOpenSavedStory = (id: string) => {
    loadStory(id);
    router.push("/dialogue");
  };

  // Right panel tab state for the open book detail view
  const [detailTab, setDetailTab] = useState<'chapters' | 'characters' | 'scenes' | 'items'>('chapters');
  const [selectedDetail, setSelectedDetail] = useState<any | null>(null);

  const handleSelectBook = (story: any) => {
    if (story.fileType && Array.isArray(story.chapters)) {
      router.push(story.resumePath || `/story/${story.id}/chapter/1/setup`);
      return;
    }
    setSelectedStory(story);
    setDetailTab('chapters');
    setSelectedDetail(null);
    setModalOpen(true);
    setTimeout(() => {
      setIsFlipped(true);
    }, 100);
  };

  const handleDeleteImported = async (novel: ImportedNovel) => {
    if (!confirm(`确定要从上传书架移出《${novel.title}》吗？该书的互动进度也会一并删除。`)) return;
    try {
      await deleteImportedNovel(novel.id);
      setImportedNovels((current) => current.filter((item) => item.id !== novel.id));
    } catch (error) {
      console.error("Failed to delete imported novel:", error);
      alert("暂时无法移除这本书，请稍后再试。");
    }
  };

  const handleCloseModal = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setModalOpen(false);
      setSelectedStory(null);
    }, 600);
  };

  const handleDeleteTrigger = () => {
    if (!selectedStory) return;
    if (confirm(`确定要从书架上移出《${selectedStory.framework.title}》吗？`)) {
      setIsModalBurning(true);
      
      // Delay closing modal until combustion animation finishes (1.5s)
      setTimeout(() => {
        setModalOpen(false);
        setIsFlipped(false);
        setIsModalBurning(false);
        
        // Trigger shelf book card deletion (combustion animation on the shelf)
        setDeletingStoryId(selectedStory.id);
      }, 1500);
    }
  };

  const handleDeleteComplete = (id: string) => {
    deleteStory(id);
    setDeletingStoryId(null);
  };

  // Esc key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isModalBurning) {
        handleCloseModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalBurning]);

  const getGenreTheme = (genre: string, customGenre?: string) => {
    const g = genre === "自定义" ? customGenre || "" : genre;
    if (g.includes("科幻") || g.includes("三体") || g.includes("未来") || g.includes("太空")) {
      return {
        cover: "from-[#0b1b3d] via-[#1a3a5c] to-[#050b14] border-cyan-500/30",
        accent: "text-cyan-400 bg-cyan-950/40 border-cyan-800/40",
        badgeBg: "bg-cyan-950 text-cyan-400",
      };
    }
    if (g.includes("仙侠") || g.includes("武侠") || g.includes("玄幻") || g.includes("修真") || g.includes("古风")) {
      return {
        cover: "from-[#143525] via-[#235e42] to-[#0d2419] border-emerald-600/30",
        accent: "text-emerald-400 bg-emerald-950/40 border-emerald-800/40",
        badgeBg: "bg-emerald-950 text-emerald-400",
      };
    }
    if (g.includes("奇幻") || g.includes("魔幻") || g.includes("魔法") || g.includes("异世")) {
      return {
        cover: "from-[#2d183f] via-[#4e296c] to-[#1c0f2a] border-purple-500/30",
        accent: "text-purple-400 bg-purple-950/40 border-purple-800/40",
        badgeBg: "bg-purple-950 text-purple-400",
      };
    }
    if (g.includes("都市") || g.includes("言情") || g.includes("恋爱") || g.includes("青春") || g.includes("日常")) {
      return {
        cover: "from-[#612d3a] via-[#944f60] to-[#401d25] border-rose-400/30",
        accent: "text-rose-400 bg-rose-950/40 border-rose-800/40",
        badgeBg: "bg-rose-950 text-rose-400",
      };
    }
    return {
      cover: "from-[#2c241c] via-[#483c2e] to-[#1d1812] border-amber-600/30",
      accent: "text-amber-400 bg-amber-950/40 border-amber-800/40",
      badgeBg: "bg-amber-950 text-amber-400",
    };
  };

  return (
    <div className="min-h-screen w-screen bg-[#f8f8f7] text-[#18181b] flex flex-col font-sans selection:bg-neutral-100 selection:text-neutral-900 overflow-x-hidden">
      {/* Navigation - flex-none to prevent expanding */}
      <header className="h-14 px-5 sm:px-8 bg-[#f8f8f7]/90 backdrop-blur-md flex items-center justify-between flex-none z-40">
        <div 
          onClick={() => router.push("/")}
          className="flex items-center gap-3 cursor-pointer group active:scale-98 transition-all"
          title="返回主页"
        >
          <span className="h-6 w-6 rounded-full bg-neutral-900 flex items-center justify-center text-white font-serif font-bold text-[10px] tracking-tight shadow-sm group-hover:scale-105 transition-transform">T</span>
          <h1 className="text-xs font-semibold tracking-tight text-[#09090b]">
            TaleBox <span className="font-normal text-zinc-400 ml-1">Story Editions</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <button
            onClick={() => router.push("/")}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-950 transition-colors"
          >
            <span>返回主页</span>
          </button>
          
          <button onClick={handleStartNewCreation} className="rounded-full bg-zinc-950 px-4 py-2 text-[10px] font-semibold text-white transition hover:bg-zinc-700 active:scale-95">开始创作</button>
        </div>
      </header>

      <main className="flex-1 min-h-0 w-full max-w-[1440px] mx-auto px-5 sm:px-12 flex flex-col">
        <div className="flex items-center justify-between pt-5 sm:pt-8">
          <div>
            <p className="text-[10px] uppercase tracking-[.22em] text-zinc-400">Personal library</p>
            <h2 className="mt-1 font-serif text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">我的书架</h2>
          </div>
          <div className="flex gap-1 rounded-full bg-zinc-100 p-1">
            <button type="button" onClick={() => setShelfTab("create")} className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${shelfTab === "create" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-400 hover:text-zinc-600"}`}>创作 ({stories.length})</button>
            <button type="button" onClick={() => setShelfTab("upload")} className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${shelfTab === "upload" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-400 hover:text-zinc-600"}`}>上传 ({importedNovels.length})</button>
          </div>
        </div>
        <div className="flex-1 min-h-[580px] w-full flex items-center justify-center">
          <ThreeBookshelf
            stories={stories}
            importedNovels={importedNovels}
            onSelectBook={handleSelectBook}
            onCreateNew={handleStartNewCreation}
            tab={shelfTab}
            deletingStoryId={deletingStoryId}
            onDeleteComplete={handleDeleteComplete}
            onDeleteImported={(story) => void handleDeleteImported(story)}
          />
        </div>
      </main>

      {/* Book Details Modal */}
      {modalOpen && selectedStory && (
        <div 
          className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${
            isFlipped ? "opacity-100" : "opacity-0"
          } ${isModalBurning ? "pointer-events-none" : ""}`}
          onClick={() => !isModalBurning && handleCloseModal()}
        >
          {/* Keyframes for modal book combustion */}
          <style>{`
            @keyframes modal-book-burn-effect {
              0% {
                transform: scale(1) translateY(0) rotate(0deg);
                filter: brightness(1) contrast(1) grayscale(0);
                opacity: 1;
              }
              30% {
                filter: brightness(0.12) contrast(1.9) grayscale(0.85) sepia(0.3) saturate(1.8);
                box-shadow: 0 0 50px rgba(239, 68, 68, 0.7);
                transform: scale(0.98) translateY(-15px) rotate(-1deg);
              }
              100% {
                transform: scale(0.4) translateY(120px) rotate(2deg);
                opacity: 0;
                filter: brightness(0) grayscale(1);
              }
            }
            @keyframes ember-fly {
              0% {
                transform: translateY(0) scale(1) rotate(0deg);
                opacity: 1;
                filter: blur(0px) brightness(1.5);
              }
              100% {
                transform: translateY(-280px) translateX(var(--dx)) scale(0) rotate(360deg);
                opacity: 0;
                filter: blur(1px) brightness(0.5);
              }
            }
            .animate-modal-book-burn {
              animation: modal-book-burn-effect 1.5s forwards cubic-bezier(0.25, 1, 0.50, 1);
            }
            .animate-ember-fly {
              animation-name: ember-fly;
              animation-fill-mode: forwards;
              animation-timing-function: cubic-bezier(0.25, 1, 0.50, 1);
            }
          `}</style>

          <div 
            className="relative max-w-4xl w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 3D Book Container */}
            <div 
              className={`modal-book-container flex shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] border border-neutral-800/10 rounded-lg overflow-visible ${
                isModalBurning ? "animate-modal-book-burn" : ""
              }`}
              style={{
                width: isFlipped ? "760px" : "380px",
              }}
            >
              {/* Dynamic Ember Particles rising from the burning open book */}
              {isModalBurning && (
                <div className="absolute inset-0 pointer-events-none overflow-visible z-50">
                  {Array.from({ length: 45 }).map((_, idx) => {
                    const size = 4 + Math.random() * 5;
                    const delay = Math.random() * 0.9;
                    const duration = 0.7 + Math.random() * 0.8;
                    const left = 5 + Math.random() * 90;
                    return (
                      <div 
                        key={idx}
                        className="absolute rounded-full bg-gradient-to-t from-yellow-300 via-orange-500 to-red-600 animate-ember-fly"
                        style={{
                          width: `${size}px`,
                          height: `${size}px`,
                          left: `${left}%`,
                          bottom: "0px",
                          animationDelay: `${delay}s`,
                          animationDuration: `${duration}s`,
                          "--dx": `${(Math.random() - 0.5) * 150}px`
                        } as React.CSSProperties}
                      />
                    );
                  })}
                </div>
              )}
              {/* Left Page (WorldView description) */}
              <div 
                className={`modal-book-left p-8 flex flex-col justify-between transition-opacity duration-500 ${
                  isFlipped ? "opacity-100 delay-300" : "opacity-0 pointer-events-none"
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${getGenreTheme(selectedStory.selectedGenre, selectedStory.customGenre).badgeBg}`}>
                      {selectedStory.selectedGenre === "自定义" ? selectedStory.customGenre : selectedStory.selectedGenre}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {new Date(selectedStory.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <h2 className="text-2xl font-bold font-serif text-zinc-950 leading-tight">
                    《{selectedStory.framework.title}》
                  </h2>
                  
                  <div className="h-px bg-zinc-100 my-2"></div>
                  
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-zinc-500 font-sans">小说世界观设定</h4>
                    <div className="max-h-[220px] overflow-y-auto pr-2 text-xs text-zinc-600 leading-relaxed font-serif whitespace-pre-line">
                      {selectedStory.framework.worldView || "暂无世界观描述。"}
                    </div>
                  </div>
                </div>
                
                <div className="text-[10px] text-zinc-400 font-mono">
                  TaleBox Interactive Novel Book
                </div>
              </div>

              {/* Right Page — 4-tab detail view */}
              <div
                className={`modal-book-right p-6 flex flex-col justify-between transition-opacity duration-500 ${
                  isFlipped ? "opacity-100 delay-300" : "opacity-0 pointer-events-none"
                }`}
              >
                {/* Header row */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-800 font-serif">
                      {selectedStory.storyStatus === "completed" ? "故事已抵达终章" : `第 ${selectedStory.currentChapterNumber || 1} 章`}
                    </span>
                    <span className="text-[9px] text-zinc-400 font-mono">
                      {selectedStory.storyStatus === "completed" ? "完结" : "进行中"}
                    </span>
                  </div>
                  <button
                    onClick={handleCloseModal}
                    className="text-zinc-400 hover:text-zinc-600 p-1 rounded-full hover:bg-zinc-100 transition-colors"
                    title="关闭书册"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Tab switcher */}
                <div className="flex gap-0.5 mb-4 bg-zinc-100 rounded-lg p-0.5">
                  {([
                    { key: 'chapters',    label: '章节',  emoji: '📖' },
                    { key: 'characters',  label: '角色',  emoji: '🎭' },
                    { key: 'scenes',      label: '场景',  emoji: '🗺' },
                    { key: 'items',       label: '道具',  emoji: '🎒' },
                  ] as const).map(({ key, label, emoji }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { setDetailTab(key); setSelectedDetail(null); }}
                      className={`flex-1 text-[9px] font-medium rounded-md py-1.5 transition-all ${
                        detailTab === key
                          ? 'bg-white text-zinc-950 shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-600'
                      }`}
                    >
                      {emoji} {label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-2" style={{ maxHeight: '280px' }}>

                  {/* ── CHAPTERS TAB ── */}
                  {detailTab === 'chapters' && (
                    <div className="space-y-2">
                      {selectedStory.storyStatus === "completed" ? (
                        <div className="flex items-center gap-2 p-2.5 bg-amber-950 rounded-xl">
                          <div className="h-5 w-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-amber-100 flex-shrink-0">
                            完
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-amber-50">故事已抵达终章</p>
                            <p className="text-[9px] text-amber-200/60 truncate">{selectedStory.ending?.title || "你的故事，已在这里圆满落笔"}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-2.5 bg-zinc-900 rounded-xl">
                          <div className="h-5 w-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">
                            {selectedStory.currentChapterNumber || 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-white">
                              第 {selectedStory.currentChapterNumber || 1} 章（进行中）
                            </p>
                            <p className="text-[9px] text-zinc-400 truncate">
                              {selectedStory.chatMessages?.length || 0} 条对话记录
                            </p>
                          </div>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0 animate-pulse" />
                        </div>
                      )}

                      {/* Completed chapters */}
                      {(selectedStory.chapters || []).length > 0 ? (
                        [...(selectedStory.chapters || [])].reverse().map((ch: any) => (
                          <button
                            key={ch.number}
                            type="button"
                            onClick={() => setSelectedDetail(selectedDetail?.number === ch.number ? null : ch)}
                            className="w-full text-left p-2.5 bg-zinc-50 border border-zinc-100 rounded-xl hover:border-zinc-300 transition-all group"
                          >
                            <div className="flex items-center gap-2">
                              <div className="h-5 w-5 rounded-full bg-zinc-200 flex items-center justify-center text-[9px] font-bold text-zinc-600 flex-shrink-0">
                                {ch.number}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-zinc-700">第 {ch.number} 章 · 已完结</p>
                                <p className="text-[9px] text-zinc-400 font-mono">
                                  {new Date(ch.completedAt).toLocaleDateString()}
                                </p>
                              </div>
                              <ChevronRight className={`h-3 w-3 text-zinc-400 transition-transform ${selectedDetail?.number === ch.number ? 'rotate-90' : ''}`} />
                            </div>
                            {selectedDetail?.number === ch.number && (
                              <p className="mt-2 text-[9px] text-zinc-500 leading-relaxed border-t border-zinc-200 pt-2">
                                {ch.summary}
                              </p>
                            )}
                          </button>
                        ))
                      ) : (
                        <p className="text-[10px] text-zinc-400 text-center py-6 font-serif italic">
                          完结章节将在此记录
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── CHARACTERS TAB ── */}
                  {detailTab === 'characters' && (
                    <div className="space-y-2">
                      {(selectedStory.framework.characters || []).map((char: any, i: number) => (
                        <button
                          key={`${char.id || 'char'}_${i}`}
                          type="button"
                          onClick={() => setSelectedDetail(selectedDetail?.id === char.id ? null : char)}
                          className={`w-full text-left p-3 rounded-xl border transition-all ${
                            char.status === 'inactive'
                              ? 'bg-zinc-50 border-zinc-100 opacity-50'
                              : 'bg-white border-zinc-200 hover:border-zinc-400'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white font-serif font-bold text-sm flex-shrink-0">
                              {char.name?.[0] || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-zinc-800 font-serif">{char.name}</span>
                                {char.status === 'inactive' && (
                                  <span className="text-[8px] text-zinc-400 font-mono">已退场</span>
                                )}
                                {typeof char.relationship === 'number' && (
                                  <span className="text-[8px] text-amber-600 font-mono ml-auto">❤ {char.relationship}</span>
                                )}
                              </div>
                              <p className="text-[9px] text-zinc-500 truncate">{char.role}</p>
                            </div>
                            <ChevronRight className={`h-3 w-3 text-zinc-300 flex-shrink-0 transition-transform ${selectedDetail?.id === char.id ? 'rotate-90' : ''}`} />
                          </div>
                          {selectedDetail?.id === char.id && (
                            <div className="mt-2.5 pt-2.5 border-t border-zinc-100 space-y-1.5 text-left">
                              {char.age && <p className="text-[9px] text-zinc-500"><span className="text-zinc-400">年龄：</span>{char.age}</p>}
                              {char.appearance && <p className="text-[9px] text-zinc-500"><span className="text-zinc-400">外貌：</span>{char.appearance}</p>}
                              {char.personality && <p className="text-[9px] text-zinc-500 leading-relaxed"><span className="text-zinc-400">性格：</span>{char.personality}</p>}
                              {char.secret && <p className="text-[9px] text-amber-700 leading-relaxed border-t border-amber-100 pt-1.5 mt-1"><span className="text-amber-500">秘密：</span>{char.secret}</p>}
                              {char.speechStyle && <p className="text-[9px] text-zinc-500 italic"><span className="text-zinc-400">口吻：</span>{char.speechStyle}</p>}
                              {char.mood && <p className="text-[9px] text-zinc-500"><span className="text-zinc-400">当前心境：</span>{char.mood}</p>}
                            </div>
                          )}
                        </button>
                      ))}
                      {!(selectedStory.framework.characters?.length) && (
                        <p className="text-[10px] text-zinc-400 text-center py-6 font-serif italic">暂无角色</p>
                      )}
                    </div>
                  )}

                  {/* ── SCENES TAB ── */}
                  {detailTab === 'scenes' && (
                    <div className="space-y-2">
                      {(selectedStory.framework.scenes || []).map((scene: any, i: number) => (
                        <button
                          key={`${scene.id || 'scene'}_${i}`}
                          type="button"
                          onClick={() => setSelectedDetail(selectedDetail?.id === scene.id ? null : scene)}
                          className="w-full text-left p-3 bg-white border border-zinc-200 hover:border-zinc-400 rounded-xl transition-all"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-zinc-100 flex items-center justify-center text-lg flex-shrink-0">
                              📍
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-bold text-zinc-800 font-serif">{scene.title}</p>
                              <p className="text-[9px] text-zinc-500 truncate">{scene.location}</p>
                            </div>
                            <ChevronRight className={`h-3 w-3 text-zinc-300 flex-shrink-0 transition-transform ${selectedDetail?.id === scene.id ? 'rotate-90' : ''}`} />
                          </div>
                          {selectedDetail?.id === scene.id && (
                            <p className="mt-2.5 text-[9px] text-zinc-500 leading-relaxed border-t border-zinc-100 pt-2.5">
                              {scene.summary}
                            </p>
                          )}
                        </button>
                      ))}
                      {!(selectedStory.framework.scenes?.length) && (
                        <p className="text-[10px] text-zinc-400 text-center py-6 font-serif italic">暂无场景</p>
                      )}
                    </div>
                  )}

                  {/* ── ITEMS TAB ── */}
                  {detailTab === 'items' && (
                    <div className="space-y-2">
                      {(selectedStory.framework.items || []).map((item: any, i: number) => (
                        <button
                          key={`${item.id || 'item'}_${i}`}
                          type="button"
                          onClick={() => setSelectedDetail(selectedDetail?.id === item.id ? null : item)}
                          className={`w-full text-left p-3 border rounded-xl transition-all ${
                            item.discovered === false
                              ? 'bg-zinc-50 border-zinc-100 opacity-60'
                              : 'bg-white border-zinc-200 hover:border-zinc-400'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-base flex-shrink-0">
                              {item.type === '线索' ? '🔍' : item.type === '关键钥匙' ? '🗝' : '📦'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-[11px] font-bold text-zinc-800 font-serif">【{item.name}】</p>
                                {item.discovered === false && (
                                  <span className="text-[8px] text-zinc-400 font-mono">未发现</span>
                                )}
                              </div>
                              {item.type && <p className="text-[8px] text-amber-600 font-mono">{item.type}</p>}
                            </div>
                            <ChevronRight className={`h-3 w-3 text-zinc-300 flex-shrink-0 transition-transform ${selectedDetail?.id === item.id ? 'rotate-90' : ''}`} />
                          </div>
                          {selectedDetail?.id === item.id && (
                            <p className="mt-2.5 text-[9px] text-zinc-500 leading-relaxed border-t border-zinc-100 pt-2.5">
                              {item.description}
                            </p>
                          )}
                        </button>
                      ))}
                      {!(selectedStory.framework.items?.length) && (
                        <p className="text-[10px] text-zinc-400 text-center py-6 font-serif italic">暂无道具</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer actions */}
                <div className="flex gap-3 pt-4 border-t border-zinc-100 mt-4">
                  <button
                    onClick={handleDeleteTrigger}
                    className="flex-1 py-2 px-3 border border-red-200 hover:border-red-500 text-red-600 hover:bg-red-50 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>移出书架</span>
                  </button>
                  <button
                    onClick={() => handleOpenSavedStory(selectedStory.id)}
                    className="flex-1 py-2 px-3 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 shadow-sm active:scale-98"
                  >
                    <span>{selectedStory.storyStatus === "completed" ? "查看终章" : "继续探索"}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>



              {/* Cover flipping front cover */}
              <div 
                className={`modal-book-cover-flipper ${isFlipped ? "flipped" : ""}`}
              >
                {/* Front face (closed cover) */}
                <div className={`absolute inset-0 backface-hidden rounded-r-lg shadow-xl bg-gradient-to-br ${getGenreTheme(selectedStory.selectedGenre, selectedStory.customGenre).cover} p-8 flex flex-col justify-between border-y border-r border-white/5`}>
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1.5 items-start">
                      <span className={`text-[8px] uppercase tracking-widest font-bold border px-2 py-0.5 rounded ${getGenreTheme(selectedStory.selectedGenre, selectedStory.customGenre).accent}`}>
                        {selectedStory.selectedGenre === "自定义" ? selectedStory.customGenre : selectedStory.selectedGenre}
                      </span>
                      <span className="text-[8px] text-white/60 bg-white/10 border border-white/10 px-2 py-0.5 rounded font-mono tracking-wider">
                        第 {selectedStory.currentChapterNumber || 1} 章
                      </span>
                    </div>
                    <BookOpen className="h-5 w-5 text-white/30" />
                  </div>

                  <div className="space-y-4 my-auto text-center pr-2">
                    <h2 className="text-3xl font-bold font-serif text-white tracking-wider leading-normal">
                      《{selectedStory.framework.title}》
                    </h2>
                    <div className="h-0.5 w-8 bg-white/20 mx-auto"></div>
                    <p className="text-[9px] text-white/40 tracking-widest uppercase font-mono">TALEBOX DRAFT</p>
                  </div>

                  <div className="flex justify-between items-center text-[9px] text-white/35 border-t border-white/10 pt-4 font-mono">
                    <span>AUTHOR: CREATOR</span>
                    <span>EDITION: 2026</span>
                  </div>
                </div>

                {/* Back face (open page layout) */}
                <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-l-lg bg-[#faf8f4] shadow-xl p-8 border-y border-l border-[#eadecc] flex flex-col justify-between">
                  <div className="h-full border border-[#f0ebde] rounded p-6 flex flex-col justify-between items-center">
                    <div className="text-center space-y-4 my-auto">
                      <div className="h-10 w-10 rounded-full border border-[#eadecc] flex items-center justify-center mx-auto bg-white/40 text-amber-800 shadow-inner">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <h3 className="text-sm font-bold font-serif text-amber-900">引言与前言</h3>
                      <p className="text-[10px] text-amber-800/60 leading-relaxed font-serif max-w-[200px]">
                        打开此本草稿，开启一段超越时间和维度的叙事探险。在这里，每一个设定都是通往新世界的钥匙。
                      </p>
                    </div>
                    <span className="text-[8px] font-mono text-zinc-400">TaleBox Engine</span>
                  </div>
                </div>
              </div>

              {/* Spine edge hinge */}
              <div className="modal-book-spine-hinge" />
            </div>
            
            {/* Esc key tip */}
            <p className="text-white/60 text-[11px] mt-6 flex items-center gap-1.5 animate-pulse-subtle">
              <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
              <span>按 Esc 或点击背景关闭书本</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
