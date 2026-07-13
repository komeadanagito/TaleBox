"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Upload, Sparkles, ChevronRight, Laptop } from "lucide-react";
import { useStory } from "./context/StoryContext";
import HeroRevealBackground from "../components/HeroRevealBackground";

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
    <div className="flex h-dvh flex-col overflow-hidden bg-[#fcfcfc] font-sans text-[#18181b] selection:bg-neutral-100 selection:text-neutral-900">
      {/* Upper Navigation Bar */}
      <header className="z-50 flex h-16 shrink-0 items-center justify-between border-b border-neutral-100/80 bg-white/70 px-4 backdrop-blur-md sm:px-8">
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
      <main className="relative isolate flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden px-4 py-4 sm:px-6 md:py-8">
        <HeroRevealBackground baseImageSrc="/images/hero/book-draft.png" revealImageSrc="/images/hero/book-universe.png" size={480} />
        <div className="relative z-10 flex w-full max-w-3xl flex-col items-center space-y-6 text-center md:space-y-10">
          
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

          <div className="grid w-full grid-cols-1 gap-3 md:mt-2 md:grid-cols-2 md:gap-6">
            
            {/* Option A: Creation */}
            <button 
              onClick={handleStartNewCreation}
              className="group flex h-36 flex-col justify-between rounded-2xl border border-neutral-200/70 bg-white p-5 text-left subtle-shadow transition-all duration-300 hover:border-neutral-900 hover:shadow-md focus:outline-none md:h-64 md:p-8"
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
            <button onClick={handleImportNovel} className="relative group flex h-36 flex-col justify-between rounded-2xl border border-neutral-200/70 bg-white p-5 text-left subtle-shadow transition-all duration-300 hover:border-neutral-900 hover:shadow-md focus:outline-none md:h-64 md:p-8">
              <div className="h-12 w-12 rounded-xl bg-zinc-100 text-zinc-700 flex items-center justify-center group-hover:bg-neutral-900 group-hover:text-white transition-colors">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-medium text-zinc-950 font-serif flex items-center gap-1">
                    导入小说文本
                    <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </h3>
                  <span className="text-[10px] bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full font-sans font-normal">TXT · EPUB</span>
                </div>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  导入 TXT 或 EPUB 小说，选择原著角色走进故事，在一次次抉择中亲历熟悉的世界与命运。
                </p>
              </div>
            </button>

          </div>
        </div>
      </main>

      <footer className="hidden shrink-0 border-t border-neutral-100 bg-white py-3 text-center text-[10px] text-zinc-400 sm:block">
        TaleBox Interactive Novel Lab © 2026. Made with Premium Minimalism.
      </footer>
    </div>
  );
}
