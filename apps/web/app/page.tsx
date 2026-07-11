"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Upload, Sparkles, ChevronRight, Laptop } from "lucide-react";
import { useStory } from "./context/StoryContext";

export default function RootWelcomePage() {
  const router = useRouter();
  const { createNewStory } = useStory();

  const handleStartNewCreation = () => {
    createNewStory();
    router.push("/creation/create-story");
  };

  const handleImportNovel = () => {
    router.push("/creation/import-novel");
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-[#18181b] flex flex-col font-sans selection:bg-neutral-100 selection:text-neutral-900">
      {/* Upper Navigation Bar */}
      <header className="h-16 px-8 border-b border-neutral-100/80 bg-white/70 backdrop-blur-md flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <span className="h-8 w-8 rounded-lg bg-neutral-900 flex items-center justify-center text-white font-serif font-bold text-sm tracking-tight shadow-sm">T</span>
          <h1 className="text-base font-medium tracking-tight font-serif text-[#09090b]">
            TaleBox <span className="text-xs font-normal text-zinc-400 font-sans ml-1">Draft Workshop</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-zinc-500">
          {/* Bookshelf Corner Button */}
          <button
            onClick={() => router.push("/bookshelf")}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200 hover:border-neutral-900 bg-white rounded-xl text-xs font-semibold text-zinc-700 hover:text-zinc-950 transition-all duration-200 shadow-sm active:scale-95"
          >
            <BookOpen className="h-3.5 w-3.5 text-zinc-500" />
            <span>我的书架</span>
          </button>
          
          <div className="h-4 w-px bg-zinc-200 my-auto mx-1"></div>
          
          <span className="hover:text-zinc-900 transition-colors flex items-center gap-1.5 font-medium cursor-pointer text-xs">
            <Laptop className="h-3.5 w-3.5" />
            <span>极简白色版</span>
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-12 flex flex-col items-center justify-center">
        <div className="w-full max-w-3xl flex flex-col items-center text-center space-y-12">
          
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-neutral-100 bg-white text-xs text-zinc-500 font-medium shadow-sm">
              <Sparkles className="h-3 w-3 text-yellow-500 animate-pulse-subtle" />
              <span>AI 互动小说叙事实验</span>
            </div>
            <h2 className="text-4xl font-semibold tracking-tight font-serif text-zinc-950 md:text-5xl">
              编织你的平行宇宙
            </h2>
            <p className="text-zinc-500 max-w-lg mx-auto text-sm leading-relaxed">
              无论是从零灵感随性编织，还是导入你珍藏的小说本，TaleBox 都能将其升华为如同身临其境的交互世界。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-4">
            
            {/* Option A: Creation */}
            <button 
              onClick={handleStartNewCreation}
              className="group p-8 text-left bg-white rounded-2xl border border-neutral-200/70 hover:border-neutral-900 subtle-shadow hover:shadow-md transition-all duration-300 flex flex-col justify-between h-64 focus:outline-none"
            >
              <div className="h-12 w-12 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-zinc-950 font-serif mb-2 flex items-center gap-1">
                  <span>自由创作流</span>
                  <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </h3>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  只需选择题材并提供几句话的碎片灵感，AI 助手将自动帮您铺设核心大纲、背景场景、人物档案和精彩开局。
                </p>
              </div>
            </button>

            {/* Option B: Import */}
            <button onClick={handleImportNovel} className="relative group p-8 text-left bg-white rounded-2xl border border-neutral-200/70 hover:border-neutral-900 subtle-shadow hover:shadow-md transition-all duration-300 flex flex-col justify-between h-64 focus:outline-none">
              <div className="h-12 w-12 rounded-xl bg-zinc-100 text-zinc-700 flex items-center justify-center group-hover:bg-neutral-900 group-hover:text-white transition-colors">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-medium text-zinc-950 font-serif flex items-center gap-1">
                    导入小说文本
                    <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </h3>
                  <span className="text-[10px] bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full font-sans font-normal">体验版</span>
                </div>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  上传本地 TXT 小说，逐章选择原著角色，通过剧情选项重新经历故事中的关键时刻。
                </p>
              </div>
            </button>

          </div>
        </div>
      </main>

      <footer className="py-8 border-t border-neutral-100 bg-white text-center text-[10px] text-zinc-400">
        TaleBox Interactive Novel Lab © 2026. Made with Premium Minimalism.
      </footer>
    </div>
  );
}
