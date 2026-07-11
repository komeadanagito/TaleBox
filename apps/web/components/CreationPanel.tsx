"use client";

import React from "react";
import { Sparkles, ChevronRight } from "lucide-react";
import { useStory } from "../app/context/StoryContext";

interface CreationPanelProps {
  onGenerate: () => void;
  isPolishing: boolean;
  onAIPolish: () => void;
}

export default function CreationPanel({ onGenerate, isPolishing, onAIPolish }: CreationPanelProps) {
  const {
    selectedGenre,
    setSelectedGenre,
    customGenre,
    setCustomGenre,
    inspiration,
    setInspiration,
    isGeneratingFramework
  } = useStory();

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [oldInspirationText, setOldInspirationText] = React.useState("");
  const [lockMinHeight, setLockMinHeight] = React.useState<number | undefined>(undefined);

  // Auto-resize the textarea
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const nextHeight = Math.max(144, textareaRef.current.scrollHeight);
      textareaRef.current.style.height = `${nextHeight}px`;
    }
  }, [inspiration, isPolishing]);

  // Keep track of the original unpolished text and lock container height to prevent visual jump
  React.useEffect(() => {
    if (isPolishing) {
      if (inspiration && inspiration !== oldInspirationText) {
        setOldInspirationText(inspiration);
      }
      if (containerRef.current) {
        setLockMinHeight(containerRef.current.getBoundingClientRect().height);
      }
    } else {
      setOldInspirationText("");
      setLockMinHeight(undefined);
    }
  }, [isPolishing]);

  // Map novel genres to their corresponding artistic calligraphy/handwriting fonts
  const getGenreFontClass = (genre: string) => {
    switch (genre) {
      case "奇幻悬疑":
      case "凡人修仙":
      case "古风武侠":
      case "克苏鲁":
      case "历史穿越":
        return "font-ma-shan";
      case "校园青春":
      case "现代都市":
      case "末世求生":
        return "font-long-cang";
      default:
        return "font-noto-serif";
    }
  };

  const fontClass = getGenreFontClass(selectedGenre);

  return (
    <div className="space-y-6">
      {/* Genre Selector */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">小说题材类别</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {([
            { label: "奇幻悬疑", emoji: "🔮" },
            { label: "凡人修仙", emoji: "☯️" },
            { label: "赛博朋克", emoji: "🤖" },
            { label: "现代都市", emoji: "🌆" },
            { label: "古风武侠", emoji: "⚔️" },
            { label: "克苏鲁", emoji: "🐙" },
            { label: "末世求生", emoji: "☢️" },
            { label: "星际文明", emoji: "🚀" },
            { label: "校园青春", emoji: "🌸" },
            { label: "历史穿越", emoji: "🏮" },
          ] as { label: string; emoji: string }[]).map(({ label, emoji }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setSelectedGenre(label);
                setInspiration(""); // Reset inspiration text on genre change
              }}
              className={`px-2.5 py-2.5 text-xs font-semibold rounded-xl border text-center transition-all duration-200 flex items-center justify-center gap-1.5 ${
                selectedGenre === label
                  ? "border-neutral-900 bg-neutral-900 text-white shadow-sm"
                  : "border-neutral-200/70 bg-white text-zinc-600 hover:border-neutral-400"
              }`}
            >
              <span>{emoji}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
        
        {/* Custom Genre Input option */}
        <div className="mt-3">
          <button 
            type="button"
            onClick={() => {
              setSelectedGenre("自定义");
              setInspiration("");
            }}
            className={`px-3 py-1.5 text-[11px] rounded-lg border mr-3 transition-colors ${
              selectedGenre === "自定义" 
                ? "border-neutral-900 bg-neutral-900 text-white" 
                : "border-neutral-200 text-zinc-500"
            }`}
          >
            ✍️ 自定义题材
          </button>
          {selectedGenre === "自定义" && (
            <input 
              type="text"
              value={customGenre}
              onChange={(e) => setCustomGenre(e.target.value)}
              placeholder="输入您的自定义题材，例如: 蒸汽朋克悬疑..."
              className="mt-2 w-full px-3 py-2 border border-neutral-200 rounded-lg text-xs outline-none focus:border-neutral-900 transition-colors"
            />
          )}
        </div>
      </div>

      {/* Inspiration Text Area */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">灵感原石 (Inspiration Text)</label>
          <button
            type="button"
            onClick={onAIPolish}
            disabled={isPolishing || !selectedGenre}
            className={`px-3 py-1 text-xs rounded-lg border font-medium flex items-center gap-1.5 transition-all ${
              isPolishing
                ? "bg-zinc-50 border-zinc-200 text-zinc-400 cursor-not-allowed"
                : "bg-white border-neutral-200 text-zinc-800 hover:border-neutral-900 hover:bg-neutral-50"
            }`}
          >
            <Sparkles className={`h-3 w-3 ${isPolishing ? "animate-spin" : "text-yellow-500"}`} />
            <span>{isPolishing ? "润色中..." : inspiration.trim() ? "AI 润色文本" : "AI 脑洞填充"}</span>
          </button>
        </div>
        <div 
          ref={containerRef}
          style={{ minHeight: lockMinHeight }}
          className="relative w-full transition-all duration-500 rounded-xl"
        >
          {/* Parchment Paper Container with hand-ruled manuscript grid lines */}
          <div className={`relative w-full rounded-xl border transition-all duration-500 p-6 parchment-paper ${
            isPolishing 
              ? "border-[#c4b59b] shadow-[0_4px_24px_rgba(196,181,155,0.25)]" 
              : "border-neutral-200 shadow-sm"
          }`}>
            <style>{`
              @import url('https://fonts.googleapis.com/css2?family=Long+Cang&family=Ma+Shan+Zheng&family=Noto+Serif+SC:wght@300;400;700&display=swap');
              
              .font-ma-shan {
                font-family: 'Ma Shan Zheng', cursive, serif !important;
              }
              .font-long-cang {
                font-family: 'Long Cang', cursive, sans-serif !important;
              }
              .font-noto-serif {
                font-family: 'Noto Serif SC', serif !important;
              }
              
              .parchment-paper {
                background-color: #faf7f0;
                background-image: linear-gradient(#ede8db 1px, transparent 1px);
                background-size: 100% 32px;
                background-position: 0 16px;
              }

              @keyframes ink-dissolve {
                0% { filter: blur(0px); opacity: 0.5; transform: translateY(0); }
                100% { filter: blur(3.5px); opacity: 0.08; transform: translateY(-5px); }
              }
              .animate-ink-dissolve {
                animation: ink-dissolve 2.5s forwards cubic-bezier(0.25, 0.46, 0.45, 0.94);
              }

              @keyframes pen-jitter {
                0%, 100% { transform: translate(-3px, -18px) rotate(-15deg) scale(1); }
                25% { transform: translate(-1px, -20px) rotate(-12deg) scale(1.05); }
                75% { transform: translate(-4px, -17px) rotate(-18deg) scale(0.95); }
              }
              .animate-pen-write {
                animation: pen-jitter 0.18s infinite ease-in-out;
              }
            `}</style>
            
            {/* 1. Behind Glow/Ambient light (visible only when polishing) */}
            <div className={`absolute inset-0 pointer-events-none overflow-hidden transition-opacity duration-700 ${
              isPolishing ? "opacity-100" : "opacity-0"
            }`}>
              <div className="absolute top-1/4 left-1/4 w-36 h-36 rounded-full bg-amber-500/5 blur-3xl animate-pulse" />
              <div className="absolute bottom-1/4 right-1/4 w-36 h-36 rounded-full bg-yellow-600/5 blur-3xl animate-pulse" />
            </div>

            {/* 2. Faded Dissolving Original Text (ink dispersion effect) */}
            {isPolishing && oldInspirationText && (
              <div className={`absolute inset-0 p-6 pointer-events-none select-none overflow-hidden whitespace-pre-wrap leading-[32px] text-zinc-400/40 ${fontClass} animate-ink-dissolve`}>
                {oldInspirationText}
              </div>
            )}

            {/* 3. Text Area Render Block */}
            {isPolishing ? (
              /* Polishing State: streaming script text with a custom writing pen nib */
              <p className={`relative z-10 leading-[32px] text-[#2d2d2d] whitespace-pre-wrap min-h-[144px] pb-10 ${fontClass}`}>
                {inspiration}
                {/* Custom SVG Fountain Pen Nib cursor */}
                <span className="inline-block relative w-[2px] h-[16px] ml-1 align-baseline">
                  <span className="absolute left-0 bottom-0 block animate-pen-write">
                    <svg viewBox="0 0 24 24" className="h-6 w-6 text-zinc-700 drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]" style={{ transform: "translate(-2px, 2px)", transformOrigin: "bottom left" }}>
                      <path fill="currentColor" d="M0 24l3.5-8.5L8 19.5 0 24zm4.8-9.7L18.6 1.8c.8-.8 2-.8 2.8 0l.8.8c.8.8.8 2 0 2.8L9.7 18.8 6.3 12.8z"/>
                      <path fill="#fff" d="M12 8l1.5 1.5M7 13l1.5 1.5" stroke="currentColor" strokeWidth="0.5"/>
                    </svg>
                  </span>
                </span>
              </p>
            ) : (
              /* Normal State: editable auto-resizing text-area in calligraphy mode */
              <textarea
                ref={textareaRef}
                value={inspiration}
                onChange={(e) => setInspiration(e.target.value)}
                placeholder="请输入您的原始大纲或简短想法。例如: 主角在老火车站深处捡到了一个收音机，收音机能播放来自三十年前的广播频段...
如果你没想好，可以先选上方题材，然后直接点击右上角【AI 脑洞填充】随机生成一个精彩开头！"
                className={`w-full bg-transparent outline-none transition-all placeholder:text-zinc-400/60 text-zinc-800 resize-none overflow-hidden min-h-[144px] pb-10 leading-[32px] ${fontClass}`}
                style={{ height: "auto" }}
              />
            )}

            {/* Manuscript Weaving Badge (fades out when not polishing) */}
            <div className={`absolute bottom-4 right-6 z-20 flex items-center gap-1.5 text-[10px] text-amber-800 font-semibold tracking-wider bg-amber-50/90 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-amber-200 shadow-sm animate-pulse transition-all duration-700 ${
              isPolishing ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-95 pointer-events-none"
            }`}>
              <Sparkles className="h-3 w-3 text-amber-600 animate-spin" />
              <span>AI 灵感编织中...</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Buttons */}
      <div className="pt-6 border-t border-neutral-100 flex justify-end">
        <button
          type="button"
          onClick={onGenerate}
          disabled={inspiration.trim().length === 0 || isGeneratingFramework}
          className={`px-6 py-2.5 rounded-xl font-medium text-xs flex items-center gap-2 shadow-sm transition-all duration-300 ${
            inspiration.trim().length === 0 || isGeneratingFramework
              ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
              : "bg-neutral-900 text-white hover:bg-neutral-800 hover:shadow-md hover:translate-y-[-1px] active:translate-y-0"
          }`}
        >
          <span>{isGeneratingFramework ? "正在分析并生成世界设定..." : "开始生成世界框架"}</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
