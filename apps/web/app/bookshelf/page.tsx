"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Plus, Trash2, Box, Users, MapPin, MessageSquare, ChevronRight, Upload, Sparkles, Laptop } from "lucide-react";
import { useStory } from "../context/StoryContext";

export default function BookshelfPage() {
  const router = useRouter();
  const { stories, loadStory, createNewStory, deleteStory } = useStory();
  const [shelfTab, setShelfTab] = useState<"create" | "upload">("create");

  // Mock upload novels list for the library
  const mockUploadedNovels: any[] = [];

  const handleStartNewCreation = () => {
    createNewStory();
    router.push("/creation");
  };

  const handleOpenSavedStory = (id: string) => {
    loadStory(id);
    router.push("/dialogue");
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-[#18181b] flex flex-col font-sans selection:bg-neutral-100 selection:text-neutral-900">
      {/* Navigation */}
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
        
        <div className="flex items-center gap-4 text-sm text-zinc-500">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200 hover:border-neutral-900 bg-white rounded-xl text-xs font-semibold text-zinc-700 hover:text-zinc-950 transition-all duration-200 shadow-sm active:scale-95"
          >
            <span>返回主页</span>
          </button>
          
          <div className="h-4 w-px bg-zinc-200 my-auto mx-1"></div>
          
          <span className="hover:text-zinc-900 transition-colors flex items-center gap-1.5 font-medium cursor-pointer text-xs">
            <Laptop className="h-3.5 w-3.5" />
            <span>极简白色版</span>
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-12 space-y-10">
        
        {/* Banner header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-neutral-100 bg-white text-xs text-zinc-500 font-medium shadow-sm">
            <Sparkles className="h-3 w-3 text-yellow-500 animate-pulse-subtle" />
            <span>欢迎来到 TaleBox 创作工坊</span>
          </div>
          <h2 className="text-3xl font-semibold tracking-tight font-serif text-zinc-950 md:text-4xl">
            我的小说书架
          </h2>
          <p className="text-zinc-400 text-xs">
            探索并唤醒您曾经构筑的任何平行宇宙，或开启一个全新的小说冒险。
          </p>
        </div>

        {/* Shelf Tabs switcher */}
        <div className="flex border-b border-neutral-100/80">
          <button
            type="button"
            onClick={() => setShelfTab("create")}
            className={`pb-3 text-xs font-bold border-b-2 px-6 transition-all duration-200 -mb-px ${
              shelfTab === "create"
                ? "border-neutral-900 text-zinc-950"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
            }`}
          >
            🔮 创作书架 ({stories.length})
          </button>
          <button
            type="button"
            onClick={() => setShelfTab("upload")}
            className={`pb-3 text-xs font-bold border-b-2 px-6 transition-all duration-200 -mb-px ${
              shelfTab === "upload"
                ? "border-neutral-900 text-zinc-950"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
            }`}
          >
            📂 上传书架 ({mockUploadedNovels.length})
          </button>
        </div>

        {/* Tab content */}
        <div>
          
          {/* Tab: Creation shelf */}
          {shelfTab === "create" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Card A: Create New story card trigger */}
              <button
                type="button"
                onClick={handleStartNewCreation}
                className="group p-8 border border-dashed border-neutral-200 hover:border-neutral-900 bg-white hover:bg-neutral-50/20 rounded-2xl flex flex-col items-center justify-center text-center space-y-4 h-64 shadow-sm hover:shadow-md transition-all duration-300"
              >
                <div className="h-10 w-10 rounded-full border border-neutral-200 group-hover:border-neutral-900 group-hover:scale-105 flex items-center justify-center text-zinc-400 group-hover:text-zinc-900 transition-all shadow-inner bg-[#fafafa]">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-zinc-900">编织新小说宇宙</h4>
                  <p className="text-[11px] text-zinc-400 mt-1 max-w-[200px]">
                    输入你的极简原始灵感，AI 助手将自动帮您铺设框架开局。
                  </p>
                </div>
              </button>

              {/* Loop Saved Stories */}
              {stories.map((story) => (
                <div
                  key={story.id}
                  className="bg-white border border-neutral-200/70 hover:border-neutral-900 rounded-2xl p-6 h-64 flex flex-col justify-between relative group subtle-shadow hover:shadow-md transition-all duration-300"
                >
                  
                  {/* Delete button top right */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`确定要从书架上移出《${story.framework.title}》吗？`)) {
                        deleteStory(story.id);
                      }
                    }}
                    className="absolute top-4 right-4 p-1.5 bg-white hover:bg-red-50 text-zinc-400 hover:text-red-500 rounded-lg border border-neutral-200 hover:border-red-100 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                    title="删除小说"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-neutral-900 text-white font-medium px-2 py-0.5 rounded-full">
                        {story.selectedGenre === "自定义" ? story.customGenre : story.selectedGenre}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {new Date(story.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold font-serif text-zinc-950 line-clamp-1">
                      《{story.framework.title}》
                    </h3>

                    <p className="text-xs text-zinc-400 leading-relaxed font-serif line-clamp-3">
                      {story.framework.worldView}
                    </p>
                  </div>

                  {/* Story summary numbers and open actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                    <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-medium">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {story.framework.characters.length}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {story.framework.scenes.length}
                      </span>
                      <span className="flex items-center gap-1">
                        <Box className="h-3 w-3" />
                        {story.framework.items.length}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {story.chatMessages.length}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenSavedStory(story.id)}
                      className="px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-[10px] font-medium flex items-center gap-1 hover:bg-neutral-800 transition-colors shadow-sm"
                    >
                      <span>继续探索</span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>

                </div>
              ))}

            </div>
          )}

          {/* Tab: Uploaded/Imported Library */}
          {shelfTab === "upload" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Disabled upload trigger */}
              <div className="p-8 border border-dashed border-neutral-200 bg-zinc-50/50 rounded-2xl flex flex-col items-center justify-center text-center space-y-4 h-64 opacity-50 cursor-not-allowed">
                <div className="h-10 w-10 rounded-full border border-neutral-200 flex items-center justify-center text-zinc-400 bg-zinc-100">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 justify-center">
                    <h4 className="text-sm font-semibold text-zinc-600">导入外部小说文本</h4>
                    <span className="text-[9px] bg-zinc-200 text-zinc-500 px-1.5 py-0.5 rounded">未开放</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 max-w-[200px]">
                    导入本地 TXT 或 EPUB 小说文本，AI 将自动解析势力关系并供您切入体验。
                  </p>
                </div>
              </div>

              {/* Loop mock library */}
              {mockUploadedNovels.map((novel) => (
                <div
                  key={novel.id}
                  className="bg-white border border-neutral-200/70 rounded-2xl p-6 h-64 flex flex-col justify-between relative group subtle-shadow opacity-75"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-zinc-100 border border-neutral-200 text-zinc-600 font-medium px-2 py-0.5 rounded-full">
                        {novel.genre}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {novel.wordCount}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold font-serif text-zinc-800 line-clamp-1">
                      {novel.title}
                    </h3>

                    <p className="text-xs text-zinc-400 leading-relaxed font-serif line-clamp-3">
                      {novel.summary}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                    <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-medium">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {novel.charactersCount} 角色
                      </span>
                    </div>
                    
                    <span className="text-[10px] bg-zinc-100 text-zinc-400 px-2.5 py-1 rounded-lg font-medium border border-neutral-200">
                      暂缓对话接入
                    </span>
                  </div>
                </div>
              ))}

            </div>
          )}

        </div>

      </main>

      <footer className="py-8 border-t border-neutral-100 bg-white text-center text-[10px] text-zinc-400">
        TaleBox Interactive Novel Lab © 2026. Made with Premium Minimalism.
      </footer>
    </div>
  );
}
