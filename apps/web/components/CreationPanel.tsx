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

  return (
    <div className="space-y-6">
      {/* Genre Selector */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">小说题材类别</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {["奇幻悬疑", "凡人修仙", "赛博朋克", "现代都市"].map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => {
                setSelectedGenre(genre);
                setInspiration(""); // Reset inspiration text on genre change
              }}
              className={`px-3 py-2.5 text-xs font-semibold rounded-xl border text-center transition-all duration-200 ${
                selectedGenre === genre 
                  ? "border-neutral-900 bg-neutral-900 text-white shadow-sm" 
                  : "border-neutral-200/70 bg-white text-zinc-600 hover:border-neutral-400"
              }`}
            >
              {genre === "奇幻悬疑" && "🔮 "}
              {genre === "凡人修仙" && "☯️ "}
              {genre === "赛博朋克" && "🤖 "}
              {genre === "现代都市" && "🌆 "}
              {genre}
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
        {isPolishing ? (
          <div className="relative w-full min-h-[144px] p-4 border border-purple-300 ring-2 ring-purple-500/10 rounded-xl bg-[#fcfbfa] text-sm leading-relaxed overflow-hidden shadow-[0_0_20px_rgba(168,85,247,0.08)] transition-all duration-500 select-none">
            <style>{`
              @keyframes shimmer-scan {
                0% { transform: translateY(-100%); }
                100% { transform: translateY(220%); }
              }
              .animate-scanline {
                animation: shimmer-scan 2.8s linear infinite;
              }
            `}</style>
            
            {/* Sweeping laser scanner line */}
            <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-transparent via-purple-500/15 to-transparent pointer-events-none animate-scanline"></div>
            
            {/* Rich typography streaming text */}
            <p className="text-zinc-800 font-serif leading-relaxed tracking-wide whitespace-pre-wrap">
              {inspiration}
              <span className="inline-block w-1 h-3.5 ml-0.5 bg-purple-500 animate-pulse align-middle" />
            </p>

            {/* Sparkle banner badge */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1 text-[10px] text-purple-600 font-semibold tracking-wider bg-purple-50 px-2 py-0.5 rounded border border-purple-100 animate-pulse">
              <Sparkles className="h-3 w-3 text-purple-500 animate-spin" />
              <span>AI 灵感编织中...</span>
            </div>
          </div>
        ) : (
          <textarea
            rows={6}
            value={inspiration}
            onChange={(e) => setInspiration(e.target.value)}
            placeholder="请输入您的原始大纲或简短想法。例如: 主角在老火车站深处捡到了一个收音机，收音机能播放来自三十年前的广播频段...
如果你没想好，可以先选上方题材，然后直接点击右上角【AI 脑洞填充】随机生成一个精彩开头！"
            className="w-full p-4 border border-neutral-200 rounded-xl text-sm leading-relaxed outline-none focus:border-neutral-900 transition-colors placeholder:text-zinc-400 font-serif"
          />
        )}
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
