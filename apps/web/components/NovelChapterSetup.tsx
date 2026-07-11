"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, LockKeyhole, MapPin, RefreshCw, Sparkles, UserPlus, Users } from "lucide-react";
import NovelImportHeader from "./NovelImportHeader";
import { getImportedNovel, saveChapterAnalysis } from "../lib/import-novel/store";
import type { ChapterAnalysis, ImportedNovel } from "../lib/import-novel/types";

export default function NovelChapterSetup({ storyId, chapterNumber }: { storyId: string; chapterNumber: number }) {
  const router = useRouter();
  const [novel, setNovel] = useState<ImportedNovel | null>(null);
  const [analysis, setAnalysis] = useState<ChapterAnalysis | null>(null);
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState("正在翻阅这一章…");
  const [error, setError] = useState("");

  const loadAndAnalyze = useCallback(async () => {
    setError("");
    setStatus("正在翻阅这一章…");
    try {
      const storedNovel = await getImportedNovel(storyId);
      if (!storedNovel) throw new Error("没有找到这本小说，请重新导入 TXT 文件");
      const chapter = storedNovel.chapters.find((item) => item.number === chapterNumber);
      if (!chapter) throw new Error("没有找到这一章");
      setNovel(storedNovel);
      if (chapter.analysis?.beats?.length) {
        setAnalysis(chapter.analysis);
        setSelected(chapter.analysis.characters.find((character) => character.playable)?.id || "");
        return;
      }
      setStatus("正在整理本章人物…");
      const previousChapter = storedNovel.chapters.find((item) => item.number === chapterNumber - 1);
      const response = await fetch("/api/import/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novelTitle: storedNovel.title, chapterTitle: chapter.title, chapterContent: chapter.content, previousSummary: previousChapter?.analysis?.summary || "无" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "章节分析失败");
      const result = data.result as ChapterAnalysis;
      await saveChapterAnalysis(storyId, chapterNumber, result);
      setAnalysis(result);
      setSelected(result.characters.find((character) => character.playable)?.id || "");
    } catch (cause) {
      console.error("Chapter preparation failed:", cause);
      setError("这一页暂时被风吹乱了，请重新翻开。");
    }
  }, [storyId, chapterNumber]);

  useEffect(() => { void loadAndAnalyze(); }, [loadAndAnalyze]);

  const chapter = novel?.chapters.find((item) => item.number === chapterNumber);
  const selectedCharacter = analysis?.characters.find((character) => character.id === selected);
  const backHref = chapterNumber === 1 ? "/creation/import-novel" : `/story/${storyId}/chapter/${chapterNumber - 1}/play`;

  if (!novel || !chapter || !analysis) {
    return <div className="min-h-screen bg-[#fbfbfa] text-zinc-950"><NovelImportHeader backHref={backHref} action="章节准备" /><main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-3xl place-items-center px-5"><div className="w-full rounded-[28px] border border-zinc-200 bg-white p-10 text-center shadow-sm"><span className={`mx-auto grid h-12 w-12 place-items-center rounded-full ${error ? "bg-red-50 text-red-600" : "bg-zinc-950 text-white"}`}><Sparkles className={`h-4 w-4 ${error ? "" : "animate-pulse"}`} /></span><h1 className="mt-6 font-serif text-2xl font-semibold">{error ? "这一章暂时没有展开" : status}</h1><p className="mx-auto mt-3 max-w-md text-xs leading-6 text-zinc-400">{error || "人物与故事正在书页间渐渐清晰。"}</p>{error && <button onClick={() => void loadAndAnalyze()} className="mx-auto mt-6 flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-3 text-xs font-semibold text-white"><RefreshCw className="h-3.5 w-3.5" /> 重新翻开</button>}</div></main></div>;
  }

  return (
    <div className="min-h-screen bg-[#fbfbfa] text-zinc-950">
      <NovelImportHeader backHref={backHref} action={`章节准备 · ${chapterNumber} / ${novel.chapters.length}`} />
      <main className="mx-auto w-full max-w-6xl px-5 py-9 sm:px-8 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
          <section>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-zinc-400"><span>{novel.title}</span><span className="h-px w-5 bg-zinc-300" /><span>Chapter {String(chapter.number).padStart(2, "0")}</span></div>
            <h1 className="mt-5 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">{chapter.title}</h1>
            <div className="mt-5 flex flex-wrap gap-2"><span className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[10px] text-zinc-500"><MapPin className="h-3 w-3" /> {analysis.location}</span><span className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[10px] text-zinc-500"><Users className="h-3 w-3" /> {analysis.characters.filter((character) => character.playable).length} 位可扮演角色</span></div>
            {chapterNumber > 1 && <div className="mt-8 rounded-2xl border border-zinc-200/80 bg-white p-5"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-zinc-400">Chapter context</p><p className="mt-3 text-sm leading-7 text-zinc-600">{analysis.summary}</p></div>}
            <div className="mt-10"><div className="flex items-end justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-zinc-400">Choose your role</p><h2 className="mt-2 font-serif text-xl font-semibold">本章，你想成为谁？</h2></div><span className="text-[10px] text-zinc-400">每章可重新选择</span></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">{analysis.characters.map((character) => <button key={character.id} disabled={!character.playable} onClick={() => setSelected(character.id)} className={`relative min-h-[150px] rounded-2xl border p-5 text-left transition ${!character.playable ? "cursor-not-allowed border-zinc-100 bg-zinc-50 opacity-55" : selected === character.id ? "border-zinc-950 bg-zinc-950 text-white shadow-xl shadow-zinc-200" : "border-zinc-200 bg-white hover:-translate-y-0.5 hover:border-zinc-400"}`}><div className="flex items-start justify-between"><span className={`grid h-9 w-9 place-items-center rounded-full font-serif text-xs ${selected === character.id && character.playable ? "bg-white text-zinc-950" : "bg-zinc-100 text-zinc-600"}`}>{character.initials}</span>{character.status === "entering" && <span className="flex items-center gap-1 text-[9px] text-zinc-400"><UserPlus className="h-3 w-3" /> 本章登场</span>}{!character.playable && <span className="flex items-center gap-1 text-[9px] text-zinc-400"><LockKeyhole className="h-3 w-3" /> 剧情角色</span>}</div><h3 className="mt-4 font-serif text-base font-semibold">{character.name}</h3><p className="mt-1 text-[10px] text-zinc-400">{character.role}</p><p className={`mt-3 text-xs leading-5 ${selected === character.id && character.playable ? "text-zinc-300" : "text-zinc-500"}`}>{character.description}</p>{selected === character.id && character.playable && <Check className="absolute bottom-4 right-4 h-4 w-4 text-white" />}</button>)}</div>
            </div>
          </section>
          <aside className="lg:sticky lg:top-24 lg:self-start"><div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-[0_24px_70px_rgba(0,0,0,.045)]"><div className="flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-zinc-400">Chapter briefing</p><Sparkles className="h-3.5 w-3.5 text-amber-500" /></div><h2 className="mt-6 font-serif text-lg font-semibold">本章任务</h2><p className="mt-3 text-sm leading-7 text-zinc-600">{analysis.goal}</p><div className="my-6 h-px bg-zinc-100" /><p className="text-[10px] text-zinc-400">当前身份</p><div className="mt-3 flex items-center gap-3 rounded-xl bg-zinc-50 p-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-white font-serif text-xs shadow-sm">{selectedCharacter?.initials}</span><div><p className="text-sm font-medium">{selectedCharacter?.name}</p><p className="mt-0.5 text-[10px] text-zinc-400">{selectedCharacter?.role}</p></div></div><p className="mt-5 rounded-xl border border-zinc-100 px-4 py-3 text-[10px] leading-5 text-zinc-400">小说扮演模式仅通过剧情选项推进，不提供自由输入。</p><button disabled={!selectedCharacter} onClick={() => router.push(`/story/${storyId}/chapter/${chapter.number}/play?role=${selected}`)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 py-3.5 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-40">以 {selectedCharacter?.name || "所选角色"} 进入本章 <ArrowRight className="h-3.5 w-3.5" /></button></div></aside>
        </div>
      </main>
    </div>
  );
}
