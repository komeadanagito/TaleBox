"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, ChevronRight, Feather, Loader2, Maximize2, MapPin, Minus, Plus } from "lucide-react";
import NovelImportHeader from "./NovelImportHeader";
import { chapterSessionId, getChapterSession, getImportedNovel, saveChapterSession } from "../lib/import-novel/store";
import { advanceSourceCursor, calculateProgress, createSourceContext, paragraphIndex, recentHistory } from "../lib/import-novel/runtime";
import type { ChapterSession, ChapterTurnResult, ImportedNovel, NovelCharacter, NovelChoice, NovelStoryBlock } from "../lib/import-novel/types";

function CharacterPortrait({ character, small = false }: { character?: NovelCharacter | undefined; small?: boolean }) {
  const palettes = ["from-stone-300 via-stone-100 to-zinc-300", "from-slate-300 via-zinc-100 to-stone-300", "from-amber-200 via-stone-100 to-zinc-300"];
  const palette = palettes[(character?.name.codePointAt(0) || 0) % palettes.length];
  return <span className={`${small ? "h-8 w-8 text-[10px]" : "h-11 w-11 text-xs"} relative grid flex-none place-items-center overflow-hidden rounded-full border border-white/80 bg-gradient-to-br ${palette} font-serif font-semibold text-stone-700 shadow-sm`}><span className="absolute inset-x-1 top-1 h-1/2 rounded-[50%] bg-black/10" /><span className="relative mt-2">{character?.initials || "?"}</span></span>;
}

export default function NovelChapterPlay({ storyId, chapterNumber }: { storyId: string; chapterNumber: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [novel, setNovel] = useState<ImportedNovel | null>(null);
  const [session, setSession] = useState<ChapterSession | null>(null);
  const [blocks, setBlocks] = useState<NovelStoryBlock[]>([]);
  const [choices, setChoices] = useState<NovelChoice[]>([]);
  const [turn, setTurn] = useState(0);
  const [revealedCount, setRevealedCount] = useState(1);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [chapterEnded, setChapterEnded] = useState(false);
  const [chapterSummary, setChapterSummary] = useState("");
  const [completed, setCompleted] = useState(false);
  const [choicesVisible, setChoicesVisible] = useState(false);
  const [error, setError] = useState("");
  const [readingWidth, setReadingWidth] = useState(1120);
  const revealAnchorRef = useRef<HTMLDivElement>(null);
  const choicesAnchorRef = useRef<HTMLElement>(null);
  const previousRevealCountRef = useRef(1);

  const chapter = novel?.chapters.find((item) => item.number === chapterNumber);
  const analysis = chapter?.analysis;
  const roleId = searchParams.get("role");
  const role = analysis?.characters.find((character) => character.id === roleId) ?? analysis?.characters.find((character) => character.playable);
  const allRevealed = blocks.length > 0 && revealedCount >= blocks.length;

  useEffect(() => {
    void getImportedNovel(storyId).then(async (storedNovel) => {
      const storedChapter = storedNovel?.chapters.find((item) => item.number === chapterNumber);
      const storedAnalysis = storedChapter?.analysis;
      const selectedRoleId = searchParams.get("role") || storedAnalysis?.characters.find((character) => character.playable)?.id;
      if (!storedNovel || !storedChapter || !storedAnalysis?.beats?.length || !selectedRoleId) {
        router.replace(`/story/${storyId}/chapter/${chapterNumber}/setup`);
        return;
      }
      const savedSession = await getChapterSession(storyId, chapterNumber, selectedRoleId);
      const firstBeat = storedAnalysis.beats[0]!;
      const activeSession: ChapterSession = savedSession || {
        id: chapterSessionId(storyId, chapterNumber, selectedRoleId), novelId: storyId, chapterNumber, roleId: selectedRoleId,
        currentBeatIndex: 0, sourceCursor: paragraphIndex(storedChapter, firstBeat.startParagraphId), completedBeatIds: [], turns: [],
        currentBlocks: storedAnalysis.blocks, currentChoices: storedAnalysis.choices, revealedBlockCount: 1, choicesVisible: false, progress: 1, status: "playing", updatedAt: new Date().toISOString(),
      };
      if (!savedSession) await saveChapterSession(activeSession);
      const restoredBlocks = [
        ...storedAnalysis.blocks,
        ...activeSession.turns.flatMap((turn) => turn.blocks),
      ];
      setNovel(storedNovel);
      setSession(activeSession);
      setBlocks(restoredBlocks);
      setChoices(activeSession.currentChoices);
      setTurn(activeSession.turns.length);
      const initialRevealCount = Math.min(restoredBlocks.length, savedSession?.revealedBlockCount ?? 1);
      setRevealedCount(initialRevealCount);
      previousRevealCountRef.current = initialRevealCount;
      setChoicesVisible(savedSession?.choicesVisible ?? false);
      setChapterEnded(activeSession.status === "completed");
      setChapterSummary(activeSession.endingSummary || "");
    }).catch((cause) => { console.error("Chapter load failed:", cause); setError("这一页暂时被风吹乱了。"); });
  }, [storyId, chapterNumber, router, searchParams]);

  useEffect(() => {
    const savedWidth = window.localStorage.getItem("talebox_novel_reading_width");
    if (savedWidth) setReadingWidth(Number(savedWidth));
  }, []);
  useEffect(() => { window.localStorage.setItem("talebox_novel_reading_width", String(readingWidth)); }, [readingWidth]);
  useEffect(() => {
    if (revealedCount <= previousRevealCountRef.current) { previousRevealCountRef.current = revealedCount; return; }
    previousRevealCountRef.current = revealedCount;
    const timer = window.setTimeout(() => revealAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 90);
    return () => window.clearTimeout(timer);
  }, [revealedCount, allRevealed]);

  const revealNext = () => {
    if (isAdvancing) return;
    if (!allRevealed) {
      setRevealedCount((count) => {
        const nextCount = Math.min(count + 1, blocks.length);
        if (session) {
          const nextSession = { ...session, revealedBlockCount: nextCount, updatedAt: new Date().toISOString() };
          setSession(nextSession);
          void saveChapterSession(nextSession);
        }
        return nextCount;
      });
      return;
    }
    if (!choicesVisible) {
      setChoicesVisible(true);
      if (session) {
        const nextSession = { ...session, choicesVisible: true, updatedAt: new Date().toISOString() };
        setSession(nextSession);
        void saveChapterSession(nextSession);
      }
      window.setTimeout(() => choicesAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === " " || event.key === "ArrowDown" || event.key === "Enter") {
        const target = event.target as HTMLElement;
        if (target.tagName !== "BUTTON") { event.preventDefault(); revealNext(); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const choose = async (choice: NovelChoice) => {
    if (!novel || !chapter || !analysis || !role || !session || isAdvancing) return;
    setSelectedChoice(choice.id);
    setIsAdvancing(true);
    setError("");
    try {
      const currentBeat = analysis.beats[session.currentBeatIndex]!;
      const sourceContext = createSourceContext(chapter, currentBeat, session.sourceCursor);
      const response = await fetch("/api/import/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novelTitle: novel.title, chapterTitle: chapter.title, sourceContext, roleName: role.name, chapterGoal: analysis.goal, currentBeat: `${currentBeat.title}：${currentBeat.summary}。完成条件：${currentBeat.completionCondition}`, completedBeats: session.completedBeatIds.join("、") || "无", recentHistory: recentHistory(session), selectedChoice: choice.label }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "剧情推进失败");
      const result = data.result as ChapterTurnResult;
      const isLastBeat = session.currentBeatIndex >= analysis.beats.length - 1;
      const completedNow = result.beatCompleted && isLastBeat;
      const nextBeatIndex = result.beatCompleted && !isLastBeat ? session.currentBeatIndex + 1 : session.currentBeatIndex;
      const nextBeat = analysis.beats[nextBeatIndex];
      const nextCursor = advanceSourceCursor(chapter, currentBeat, session.sourceCursor, result.beatCompleted, nextBeatIndex !== session.currentBeatIndex ? nextBeat : undefined);
      const completedBeatIds = result.beatCompleted && !session.completedBeatIds.includes(currentBeat.id) ? [...session.completedBeatIds, currentBeat.id] : session.completedBeatIds;
      const appendedBlocks = [...blocks, ...result.blocks];
      const nextSession: ChapterSession = {
        ...session,
        currentBeatIndex: nextBeatIndex,
        sourceCursor: nextCursor,
        completedBeatIds,
        turns: [...session.turns, { id: crypto.randomUUID(), choice, blocks: result.blocks, createdAt: new Date().toISOString() }],
        currentBlocks: appendedBlocks,
        currentChoices: completedNow ? [] : result.choices,
        revealedBlockCount: blocks.length + 1,
        choicesVisible: false,
        progress: calculateProgress(chapter, nextCursor, completedNow),
        status: completedNow ? "completed" : "playing",
        ...(completedNow ? { endingSummary: result.chapterSummary || analysis.summary } : {}),
        updatedAt: new Date().toISOString(),
      };
      await saveChapterSession(nextSession);
      setSession(nextSession);
      setBlocks(appendedBlocks);
      setChoices(nextSession.currentChoices);
      setChapterEnded(completedNow);
      setChapterSummary(result.chapterSummary || analysis.summary);
      setTurn((value) => value + 1);
      setRevealedCount(blocks.length + 1);
      previousRevealCountRef.current = blocks.length;
      setChoicesVisible(false);
      setSelectedChoice(null);
    } catch (cause) {
      console.error("Chapter turn failed:", cause);
      setError("这一页暂时被风吹乱了，请再试一次。");
      setSelectedChoice(null);
    } finally {
      setIsAdvancing(false);
    }
  };

  if (!novel || !chapter || !analysis || !role || !session || blocks.length === 0) {
    return <div className="grid min-h-screen place-items-center bg-[#e9e4da] px-5"><div className="novel-reading-paper w-full max-w-xl border border-[#d8d0c2] p-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-[#8c7c66]" /><p className="mt-5 font-serif text-lg">正在翻开这一章…</p>{error && <p className="mt-3 text-xs text-red-700">{error}</p>}</div></div>;
  }

  return (
    <div className="min-h-screen bg-[#e9e4da] text-[#312d27] selection:bg-[#d8cdbb]">
      <NovelImportHeader backHref={`/story/${storyId}/chapter/${chapterNumber}/setup`} action={`${novel.title} · 第 ${chapterNumber} 章`} />
      <main style={{ maxWidth: `${readingWidth}px` }} className="mx-auto w-full px-3 py-5 transition-[max-width] duration-200 sm:px-8 sm:py-10">
        <article onClick={revealNext} className={`novel-reading-paper relative min-h-[calc(100dvh-7rem)] overflow-hidden rounded-sm border border-[#d8d0c2] px-6 py-10 shadow-[0_22px_70px_rgba(73,58,38,.13)] sm:px-14 sm:py-14 md:px-20 ${!allRevealed ? "cursor-pointer" : ""}`} aria-label="小说阅读页，点击空白处继续阅读">
          <div className="pointer-events-none absolute inset-y-0 left-8 hidden w-px bg-[#d7cec0]/55 sm:block" />
          <header className="relative border-b border-[#d8d0c2]/80 pb-8 text-center"><p className="text-[9px] font-medium uppercase tracking-[.32em] text-[#9a8f80]">{novel.title} · Chapter {String(chapterNumber).padStart(2, "0")}</p><h1 className="mt-4 font-serif text-3xl font-semibold tracking-[.08em] text-[#2e2923] sm:text-4xl">{chapter.title}</h1><p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-[#9a8f80]"><MapPin className="h-3 w-3" /> {analysis.location}</p></header>
          <div style={{ maxWidth: `${Math.min(1080, Math.max(620, readingWidth - 190))}px` }} className="relative mx-auto mt-10 pb-28 transition-[max-width] duration-200 sm:mt-12">
            <div className="mb-9 flex items-center border-b border-dashed border-[#d8d0c2] pb-5"><div className="flex items-center gap-3"><CharacterPortrait character={role} small /><div><p className="text-[9px] text-[#9a8f80]">本章扮演</p><p className="mt-0.5 font-serif text-sm font-semibold">{role.name}</p></div></div></div>
            <div className="space-y-8">{blocks.slice(0, revealedCount).map((block, index) => {
              if (block.type === "dialogue") { const character = analysis.characters.find((item) => item.name === block.speaker); return <div key={`${turn}-${index}`} className="novel-block-reveal flex gap-4 py-2 sm:gap-5"><CharacterPortrait character={character} /><div className="min-w-0 pt-0.5"><p className="text-[10px] font-medium tracking-[.12em] text-[#8b7d69]">{block.speaker}</p><p className="mt-2 font-serif text-[16px] leading-8 text-[#37312a] sm:text-[17px]">“{block.text}”</p></div></div>; }
              if (block.type === "action") return <p key={`${turn}-${index}`} className="novel-block-reveal border-l-2 border-[#9c8a70] py-1 pl-5 font-serif text-[14px] italic leading-7 text-[#746856]">你选择：{block.text}</p>;
              return <p key={`${turn}-${index}`} className="novel-block-reveal font-serif text-[16px] leading-[2.15] tracking-[.025em] text-[#454038] sm:text-[17px]">{block.text}</p>;
            })}</div>
            <div ref={revealAnchorRef} className="h-px scroll-mt-28" aria-hidden="true" />
            {(!allRevealed || !choicesVisible) && <button type="button" onClick={(event) => { event.stopPropagation(); revealNext(); }} className="novel-continue-mark mx-auto mt-12 flex items-center gap-2 text-[10px] tracking-[.14em] text-[#9a8f80]"><span>{allRevealed ? "点击继续故事" : "点击书页继续"}</span><span className="text-[8px]">▼</span></button>}
            {allRevealed && choicesVisible && <section ref={choicesAnchorRef} onClick={(event) => event.stopPropagation()} className="novel-block-reveal mt-14 scroll-mb-24 border-t border-[#d8d0c2] pt-8">
              {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50/70 px-4 py-3 text-xs text-red-700">{error}</div>}
              {chapterEnded ? <div className="text-center"><Feather className="mx-auto h-4 w-4 text-[#8c7c66]" /><p className="mt-4 font-serif text-sm text-[#746856]">这一章已经抵达句点。</p><button onClick={() => setCompleted(true)} className="mt-5 border-b border-[#6f6251] pb-1 font-serif text-sm font-semibold">翻开章末</button></div> : <><div className="mb-6 flex items-center gap-3"><Feather className="h-3.5 w-3.5 text-[#8c7c66]" /><p className="font-serif text-sm font-semibold tracking-[.08em]">此刻，{role.name}决定——</p></div><div className="space-y-2">{choices.map((choice, index) => <button key={`${turn}-${choice.id}`} disabled={isAdvancing} onClick={() => void choose(choice)} className={`group flex w-full items-start gap-4 border-b border-[#ddd4c6] px-2 py-4 text-left transition last:border-b-0 ${selectedChoice === choice.id ? "bg-[#ded5c7]/55" : "hover:bg-white/45"}`}><span className="mt-0.5 font-serif text-xs text-[#9a8f80]">{String.fromCharCode(65 + index)}.</span><span className="min-w-0 flex-1"><span className="block font-serif text-[15px] leading-6 text-[#3d372f]">{choice.label}</span><span className="mt-1 block text-[9px] leading-4 text-[#9a8f80]">{choice.hint}</span></span>{selectedChoice === choice.id ? <Loader2 className="mt-1 h-3.5 w-3.5 animate-spin" /> : <ChevronRight className="mt-1 h-3.5 w-3.5 text-[#aaa092]" />}</button>)}</div><p className="mt-6 text-center text-[9px] tracking-[.08em] text-[#aaa092]">选择将改变故事经过，但不会脱离本章原著脉络</p></>}
            </section>}
          </div>
          <footer className="absolute inset-x-0 bottom-5 flex items-center justify-center gap-4 text-[9px] text-[#aaa092]"><span className="h-px w-10 bg-[#d6ccbd]" /><span>第 {String(chapterNumber).padStart(2, "0")} 章</span><span className="h-px w-10 bg-[#d6ccbd]" /></footer>
        </article>
      </main>
      <div className="fixed bottom-5 left-1/2 z-40 h-[3px] w-[min(320px,58vw)] -translate-x-1/2 overflow-hidden rounded-full bg-[#cfc4b4]/90 shadow-[0_1px_5px_rgba(73,58,38,.15)] backdrop-blur" title={`本章进度 ${session.progress ?? 1}%`} aria-label={`本章进度 ${session.progress ?? 1}%`}><span className="block h-full min-w-[10px] rounded-full bg-[#625746] transition-[width] duration-700 ease-out" style={{ width: `${session.progress ?? 1}%` }} /></div>
      <aside className="fixed bottom-5 right-5 z-40 hidden items-center gap-2 rounded-full border border-[#d4cabb] bg-[#f8f3e9]/95 px-3 py-2 text-[#776b5d] shadow-[0_10px_35px_rgba(73,58,38,.14)] backdrop-blur sm:flex"><button onClick={() => setReadingWidth((width) => Math.max(760, width - 80))} className="grid h-7 w-7 place-items-center rounded-full hover:bg-[#e9e0d3]"><Minus className="h-3.5 w-3.5" /></button><Maximize2 className="h-3.5 w-3.5 text-[#9b8f80]" /><input type="range" min="760" max="1380" step="10" value={readingWidth} onChange={(event) => setReadingWidth(Number(event.target.value))} className="novel-width-slider w-28" aria-label="阅读区域宽度" /><button onClick={() => setReadingWidth((width) => Math.min(1380, width + 80))} className="grid h-7 w-7 place-items-center rounded-full hover:bg-[#e9e0d3]"><Plus className="h-3.5 w-3.5" /></button></aside>
      {completed && <div className="fixed inset-0 z-50 grid place-items-center bg-[#e9e4da]/92 p-5 backdrop-blur-sm"><div className="novel-reading-paper w-full max-w-xl border border-[#d8d0c2] p-8 text-center shadow-[0_30px_100px_rgba(73,58,38,.2)] sm:p-11"><span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#3a342c] text-[#f7f2e8]"><BookOpen className="h-4 w-4" /></span><p className="mt-7 text-[9px] uppercase tracking-[.28em] text-[#9a8f80]">Chapter {String(chapterNumber).padStart(2, "0")} · Complete</p><h2 className="mt-3 font-serif text-3xl font-semibold">本章已落幕</h2><p className="mx-auto mt-4 max-w-md font-serif text-sm leading-7 text-[#746856]">{chapterSummary || analysis.summary}</p><div className="mx-auto mt-7 h-px w-16 bg-[#c9bdab]" />{chapterNumber < novel.chapters.length ? <button onClick={() => router.push(`/story/${storyId}/chapter/${chapterNumber + 1}/setup`)} className="mx-auto mt-7 flex items-center gap-2 border-b border-[#6f6251] pb-1 font-serif text-sm font-semibold">翻开下一章 <ArrowRight className="h-3.5 w-3.5" /></button> : <button onClick={() => router.push("/bookshelf")} className="mx-auto mt-7 flex items-center gap-2 border-b border-[#6f6251] pb-1 font-serif text-sm font-semibold">合上书页 <ArrowRight className="h-3.5 w-3.5" /></button>}</div></div>}
    </div>
  );
}
