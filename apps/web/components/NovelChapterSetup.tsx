"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, LockKeyhole, RefreshCw, Sparkles, Users } from "lucide-react";
import NovelImportHeader from "./NovelImportHeader";
import { getImportedNovel, saveChapterAnalysis } from "../lib/import-novel/store";
import { serializeChapterSource, sha256 } from "../lib/import-novel/compiler/hash";
import { assertChapterPlan } from "../lib/import-novel/compiler/validator";
import { READER_ROLE_ID, selectableCharacters } from "../lib/import-novel/roles";
import type { ChapterAnalysis, ImportedChapter, ImportedNovel, NovelDriveMode } from "../lib/import-novel/types";

const compileRequests = new Map<string, Promise<ChapterAnalysis>>();

function sourceHashFor(chapter: ImportedChapter) {
  return sha256(serializeChapterSource(chapter.title, chapter.paragraphs));
}

function isCurrentPlan(analysis: ChapterAnalysis | undefined, chapter: ImportedChapter, sourceHash: string) {
  if (!analysis) return false;
  try {
    assertChapterPlan(analysis, chapter.paragraphs, sourceHash);
    return true;
  } catch {
    return false;
  }
}

export default function NovelChapterSetup({ storyId, chapterNumber }: { storyId: string; chapterNumber: number }) {
  const router = useRouter();
  const [novel, setNovel] = useState<ImportedNovel | null>(null);
  const [analysis, setAnalysis] = useState<ChapterAnalysis | null>(null);
  const [selected, setSelected] = useState("");
  const [driveMode, setDriveMode] = useState<NovelDriveMode>("ai");
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
      const sourceHash = await sourceHashFor(chapter);
      if (isCurrentPlan(chapter.analysis, chapter, sourceHash)) {
        const currentAnalysis = chapter.analysis!;
        setAnalysis(currentAnalysis);
        setSelected(selectableCharacters(currentAnalysis).find((character) => character.playable)?.id || READER_ROLE_ID);
        return;
      }
      setStatus("正在整理本章人物…");
      const compileKey = `${storyId}:${chapterNumber}:${sourceHash}`;
      let compilation = compileRequests.get(compileKey);
      if (!compilation) {
        compilation = (async () => {
          const response = await fetch("/api/import/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chapterTitle: chapter.title,
              paragraphs: chapter.paragraphs.map(({ id, text }) => ({ id, text })),
            }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "章节分析失败");
          const compiled = data.result as ChapterAnalysis;
          if (!isCurrentPlan(compiled, chapter, sourceHash)) throw new Error("章节计划版本、原文指纹或结构不匹配");
          await saveChapterAnalysis(storyId, chapterNumber, compiled);
          return compiled;
        })();
        compileRequests.set(compileKey, compilation);
      }
      let result: ChapterAnalysis;
      try {
        result = await compilation;
      } finally {
        if (compileRequests.get(compileKey) === compilation) compileRequests.delete(compileKey);
      }
      setAnalysis(result);
      setSelected(selectableCharacters(result).find((character) => character.playable)?.id || READER_ROLE_ID);
    } catch (cause) {
      console.warn("Chapter preparation failed:", cause instanceof Error ? cause.message : cause);
      setError(cause instanceof Error ? cause.message : "章节索引暂时无法完成，请重新翻开。");
    }
  }, [storyId, chapterNumber]);

  useEffect(() => { void loadAndAnalyze(); }, [loadAndAnalyze]);

  const chapter = novel?.chapters.find((item) => item.number === chapterNumber);
  const displayCharacters = analysis ? selectableCharacters(analysis) : [];
  const selectedCharacter = displayCharacters.find((character) => character.id === selected);
  const backHref = chapterNumber === 1 ? "/creation/import-novel" : `/story/${storyId}/chapter/${chapterNumber - 1}/play`;

  if (!novel || !chapter || !analysis) {
    return <div className="min-h-screen bg-[#fbfbfa] text-zinc-950"><NovelImportHeader backHref={backHref} action="章节准备" /><main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-3xl place-items-center px-5"><div className="w-full rounded-[28px] border border-zinc-200 bg-white p-10 text-center shadow-sm"><span className={`mx-auto grid h-12 w-12 place-items-center rounded-full ${error ? "bg-red-50 text-red-600" : "bg-zinc-950 text-white"}`}><Sparkles className={`h-4 w-4 ${error ? "" : "animate-pulse"}`} /></span><h1 className="mt-6 font-serif text-2xl font-semibold">{error ? "这一章暂时没有展开" : status}</h1><p className="mx-auto mt-3 max-w-md text-xs leading-6 text-zinc-400">{error || "人物与故事正在书页间渐渐清晰。"}</p>{error && (
      <div className="mt-6 flex items-center justify-center gap-3">
        <button onClick={() => void loadAndAnalyze()} className="flex items-center gap-2 rounded-full bg-zinc-100 px-5 py-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-200">
          <RefreshCw className="h-3.5 w-3.5" /> 重新翻开
        </button>
        {error.includes("前置信息") && (
          <button onClick={() => {
            if (novel && chapterNumber < novel.chapters.length) {
              router.push(`/story/${storyId}/chapter/${chapterNumber + 1}/setup`);
            } else {
              router.push("/bookshelf");
            }
          }} className="flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-3 text-xs font-semibold text-white hover:bg-zinc-800">
            跳过此章 <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )}</div></main></div>;
  }

  return (
    <div className="min-h-screen bg-[#fbfbfa] text-zinc-950">
      <NovelImportHeader backHref={backHref} action={`章节准备 · ${chapterNumber} / ${novel.chapters.length}`} />
      <main className="mx-auto w-full max-w-6xl px-5 py-9 sm:px-8 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
          <section>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-zinc-400"><span>{novel.title}</span><span className="h-px w-5 bg-zinc-300" /><span>Chapter {String(chapter.number).padStart(2, "0")}</span></div>
            <h1 className="mt-5 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">{chapter.title}</h1>
            <div className="mt-5 flex flex-wrap gap-2"><span className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[10px] text-zinc-500"><Users className="h-3 w-3" /> {displayCharacters.filter((character) => character.playable).length} 位可选身份</span></div>
            <div className="mt-10"><div className="flex items-end justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-zinc-400">Choose your role</p><h2 className="mt-2 font-serif text-xl font-semibold">本章，你想成为谁？</h2></div><span className="text-[10px] text-zinc-400">每章可重新选择</span></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">{displayCharacters.map((character) => <button key={character.id} disabled={!character.playable} onClick={() => setSelected(character.id)} className={`relative min-h-[136px] rounded-2xl border p-5 text-left transition ${!character.playable ? "cursor-not-allowed border-zinc-100 bg-zinc-50 opacity-55" : selected === character.id ? "border-zinc-950 bg-zinc-950 text-white shadow-xl shadow-zinc-200" : "border-zinc-200 bg-white hover:-translate-y-0.5 hover:border-zinc-400"}`}><div className="flex items-start justify-between"><span className={`grid h-9 w-9 place-items-center rounded-full font-serif text-xs ${selected === character.id && character.playable ? "bg-white text-zinc-950" : "bg-zinc-100 text-zinc-600"}`}>{[...character.name][0]}</span>{!character.playable && <span className="flex items-center gap-1 text-[9px] text-zinc-400"><LockKeyhole className="h-3 w-3" /> 剧情角色</span>}</div><h3 className="mt-4 font-serif text-base font-semibold">{character.name}</h3>{character.role && <p className="mt-1 text-[10px] text-zinc-400">{character.role}</p>}{selected === character.id && character.playable && <Check className="absolute bottom-4 right-4 h-4 w-4 text-white" />}</button>)}</div>
            </div>
          </section>
          <aside className="lg:sticky lg:top-24 lg:self-start"><div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-[0_24px_70px_rgba(0,0,0,.045)]"><div className="flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-zinc-400">Reading mode</p><Sparkles className="h-3.5 w-3.5 text-amber-500" /></div><h2 className="mt-6 font-serif text-lg font-semibold">{driveMode === "ai" ? "AI 驱动叙事" : "沿原著阅读"}</h2><p className="mt-3 text-sm leading-7 text-zinc-600">{driveMode === "ai" ? "AI 将依据当前原文窗口接管叙事呈现，并尽量保持原作事实与顺序。" : "正文将严格按照导入文本的段落顺序展开。"}</p><div className="mt-5 grid grid-cols-2 rounded-full bg-zinc-100 p-1" role="radiogroup" aria-label="阅读驱动模式">{([{"id":"original","label":"原作驱动"},{"id":"ai","label":"AI 驱动"}] as const).map((mode) => <button key={mode.id} type="button" role="radio" aria-checked={driveMode === mode.id} onClick={() => setDriveMode(mode.id)} className={`rounded-full px-3 py-2 text-[11px] font-medium transition-all ${driveMode === mode.id ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-400 hover:text-zinc-700"}`}>{mode.label}</button>)}</div><div className="my-6 h-px bg-zinc-100" /><p className="text-[10px] text-zinc-400">当前身份</p><div className="mt-3 flex items-center gap-3 rounded-xl bg-zinc-50 p-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-white font-serif text-xs shadow-sm">{selectedCharacter ? [...selectedCharacter.name][0] : ""}</span><div><p className="text-sm font-medium">{selectedCharacter?.name}</p>{selectedCharacter?.role && <p className="mt-0.5 text-[10px] text-zinc-400">{selectedCharacter.role}</p>}</div></div><p className="mt-5 rounded-xl border border-zinc-100 px-4 py-3 text-[10px] leading-5 text-zinc-400">{driveMode === "ai" ? "AI 模式会生成有限选项与叙事变化，不提供自由输入。" : "原作模式仅通过剧情选项推进，不提供自由输入。"}</p><button disabled={!selectedCharacter} onClick={() => router.push(`/story/${storyId}/chapter/${chapter.number}/play?role=${selected}&mode=${driveMode}`)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 py-3.5 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-40">以 {selectedCharacter?.name || "所选角色"} 进入本章 <ArrowRight className="h-3.5 w-3.5" /></button></div></aside>
        </div>
      </main>
    </div>
  );
}
