"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, Laptop } from "lucide-react";
import { useStory } from "../../context/StoryContext";
import { TEMPLATES } from "../../context/storyTemplates";
import CreationPanel from "../../../components/CreationPanel";
import StoryStatePanel from "../../../components/StoryStatePanel";

export default function CreateStoryPage() {
  const router = useRouter();
  const {
    selectedGenre,
    customGenre,
    inspiration,
    setInspiration,
    isGeneratingFramework,
    setIsGeneratingFramework,
    generatedFramework,
    setGeneratedFramework,
    generatedChapter1,
    setGeneratedChapter1,
    setDialogueSuggestions,
    setChatMessages
  } = useStory();

  const [step, setStep] = useState<"config" | "framework" | "loading">("config");
  const [isPolishing, setIsPolishing] = useState<boolean>(false);
  const [loaderProgress, setLoaderProgress] = useState<number>(0);
  const [loaderStatusText, setLoaderStatusText] = useState<string>("建立星轨沙箱...");

  // Auto-generate helper based on Genre
  const getGenreKey = () => {
    if (TEMPLATES[selectedGenre]) return selectedGenre;
    return "奇幻悬疑"; // Default fallback
  };

  // Perform AI Polish calling Server API with stream rendering
  const handleAIPolish = async () => {
    if (isPolishing) return;
    const originalText = inspiration.trim();
    setIsPolishing(true);
    setInspiration(""); // Clear and start typewriter effect

    try {
      const response = await fetch("/api/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre: selectedGenre === "自定义" ? customGenre : selectedGenre,
          text: originalText
        })
      });

      if (!response.ok) {
        throw new Error("Polish request failed");
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
        setInspiration(fullText);
      }

    } catch (err: any) {
      alert("AI 润色失败: " + err.message);
      const genreKey = getGenreKey();
      setInspiration(originalText || TEMPLATES[genreKey]!.polished);
    } finally {
      setIsPolishing(false);
    }
  };

  // Generate world framework calling Server API
  const handleGenerateFramework = async () => {
    if (isGeneratingFramework) return;
    setIsGeneratingFramework(true);
    try {
      const response = await fetch("/api/generate-framework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre: selectedGenre === "自定义" ? customGenre : selectedGenre,
          inspiration: inspiration.trim()
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Generate framework failed");
      }
      
      const res = data.result;
      setGeneratedFramework({
        title: res.title,
        worldView: res.worldView,
        characters: res.characters,
        scenes: res.scenes,
        items: res.items
      });
      setGeneratedChapter1(res.chapter1);
      setDialogueSuggestions(res.suggestions);
      setStep("framework");
    } catch (err: any) {
      alert("AI 生成设定失败: " + err.message + "，已为您加载本地备用模板。");
      // Fallback to local templates
      const genreKey = getGenreKey();
      const template = TEMPLATES[genreKey]!;
      const finalFramework = JSON.parse(JSON.stringify(template.framework));
      if (selectedGenre === "自定义" && customGenre.trim()) {
        finalFramework.title = `${customGenre.trim()}之密`;
      }
      setGeneratedFramework(finalFramework);
      setGeneratedChapter1(template.chapter1);
      setDialogueSuggestions(template.suggestions);
      setStep("framework");
    } finally {
      setIsGeneratingFramework(false);
    }
  };

  // Confirm framework and proceed to load Chapter 1
  const handleConfirmFramework = () => {
    setStep("loading");
    setLoaderProgress(0);
    setLoaderStatusText("建立沙箱世界...");
  };

  // Loading Screen Progress Simulation Effect
  useEffect(() => {
    if (step !== "loading") return;

    const interval = setInterval(() => {
      setLoaderProgress((prev) => {
        const next = prev + 5;
        if (next >= 100) {
          clearInterval(interval);
          return 100;
        }

        // Simulate status updates
        if (next === 25) {
          setLoaderStatusText("提炼核心角色群契约...");
        } else if (next === 50) {
          setLoaderStatusText("渲染多元场景画布...");
        } else if (next === 75) {
          setLoaderStatusText("编织第一章大体背景...");
        } else if (next === 90) {
          setLoaderStatusText("注入世界剧情节点...");
        }
        
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [step]);

  // Loading Screen Completion Side-Effects Effect
  useEffect(() => {
    if (step !== "loading" || loaderProgress < 100) return;

    // Set initial messages for chat page
    const characterName = generatedFramework?.characters[0]?.name || "店主";
    const genreKey = getGenreKey();
    const defaultName = TEMPLATES[genreKey]?.framework.characters[0]?.name || "墨言";
    const finalChapter1 = generatedChapter1.replace(new RegExp(defaultName, "g"), characterName);

    setChatMessages([
      {
        id: "msg_init_narrator",
        role: "narrator",
        content: finalChapter1
      }
    ]);

    const timer = setTimeout(() => {
      router.push("/dialogue");
    }, 800);

    return () => clearTimeout(timer);
  }, [loaderProgress, step, generatedChapter1, generatedFramework, router, setChatMessages]);

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
        <div className="flex items-center gap-6 text-sm text-zinc-500">
          <span className="hover:text-zinc-900 transition-colors flex items-center gap-1.5 font-medium cursor-pointer">
            <Laptop className="h-4 w-4" />
            <span>极简白色版</span>
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-8 flex flex-col items-center justify-center">
        
        {/* Step: Configuration Form */}
        {step === "config" && (
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-neutral-200/60 subtle-shadow p-8 space-y-8">
            <div className="flex items-center justify-between pb-6 border-b border-neutral-100">
              <button 
                onClick={() => router.push("/")}
                className="text-zinc-400 hover:text-zinc-900 transition-colors flex items-center gap-1.5 text-xs font-medium"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>返回上一页</span>
              </button>
              <span className="text-xs text-zinc-400">步骤 1 / 2：设定世界基准</span>
            </div>

            <CreationPanel 
              onGenerate={handleGenerateFramework}
              isPolishing={isPolishing}
              onAIPolish={handleAIPolish}
            />
          </div>
        )}

        {/* Step: Framework sandbox editor */}
        {step === "framework" && generatedFramework && (
          <div className="w-full max-w-5xl bg-white rounded-2xl border border-neutral-200/60 subtle-shadow p-8 space-y-6 animate-float-subtle">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <button 
                onClick={() => setStep("config")}
                className="text-zinc-400 hover:text-zinc-900 transition-colors flex items-center gap-1.5 text-xs font-medium"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>返回修改</span>
              </button>
              <div className="text-right">
                <span className="text-xs text-zinc-400 block">步骤 2 / 2：AI 编织沙盒预览</span>
                <span className="text-xs font-serif font-semibold text-zinc-900 mt-1 block">《{generatedFramework.title}》</span>
              </div>
            </div>

            <StoryStatePanel onConfirm={handleConfirmFramework} />
          </div>
        )}

        {/* Step: Loading Screen */}
        {step === "loading" && (
          <div className="w-full max-w-xl bg-white rounded-2xl border border-neutral-200/60 subtle-shadow p-8 flex flex-col items-center text-center space-y-8 py-16">
            
            {/* Spinning Weaving Loom Animation */}
            <div className="relative h-20 w-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-dashed border-neutral-200 animate-spin-slow"></div>
              <div className="h-10 w-10 rounded-full bg-neutral-900 flex items-center justify-center text-white shadow">
                <Sparkles className="h-5 w-5 text-white animate-pulse-subtle" />
              </div>
            </div>

            {/* Status indicators */}
            <div className="space-y-2 w-full">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-widest">{loaderStatusText}</h3>
              <h2 className="text-xl font-medium font-serif text-zinc-950">正在编织第一章大体背景...</h2>
            </div>

            {/* Custom progress bar */}
            <div className="w-full max-w-sm h-1 bg-zinc-100 rounded-full overflow-hidden relative">
              <div 
                className="absolute top-0 left-0 h-full bg-neutral-900 rounded-full transition-all duration-100" 
                style={{ width: `${loaderProgress}%` }}
              ></div>
            </div>

            {/* Background card */}
            <div className="w-full p-6 rounded-xl border border-neutral-100 bg-[#fafafa]/50 text-left space-y-3">
              <span className="text-[10px] bg-neutral-100 text-zinc-500 font-medium px-2 py-0.5 rounded border border-neutral-200">背景摘要 (不锁走向)</span>
              <p className="text-xs text-zinc-500 leading-relaxed font-serif">
                第一章主要搭建世界最初切面。主角置言于环境重托的险地中，面临第一个抉择。在不锁定未来走向的前提下，由您的后续对话和行为来解锁并编织故事剧情。
              </p>
            </div>
          </div>
        )}

      </main>

      {/* Subtle Footer */}
      <footer className="py-8 border-t border-neutral-100 bg-white text-center text-[10px] text-zinc-400">
        TaleBox Interactive Novel Lab © 2026. Made with Premium Minimalism.
      </footer>
    </div>
  );
}
