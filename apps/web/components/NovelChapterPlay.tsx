"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, ChevronRight, Feather, Loader2, Maximize2, Minus, Plus } from "lucide-react";
import NovelImportHeader from "./NovelImportHeader";
import NovelChapterAiPlay from "./NovelChapterAiPlay";
import NovelCharacterPortrait from "./NovelCharacterPortrait";
import { chapterSessionId, getChapterSession, getImportedNovel, saveChapterSession } from "../lib/import-novel/store";
import { selectableCharacters } from "../lib/import-novel/roles";
import { calculateProgress, choicesForRole, hasReachedCheckpoint, readNextSourceBlocks, sourceBlocks } from "../lib/import-novel/runtime";
import type { ChapterAnalysis, ChapterSession, ImportedChapter, ImportedNovel, NovelChoice, NovelStoryBlock } from "../lib/import-novel/types";

function OriginalNovelChapterPlay({ storyId, chapterNumber }: { storyId: string; chapterNumber: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [novel, setNovel] = useState<ImportedNovel | null>(null);
  const [session, setSession] = useState<ChapterSession | null>(null);
  const [blocks, setBlocks] = useState<NovelStoryBlock[]>([]);
  const [choices, setChoices] = useState<NovelChoice[]>([]);
  const [revealedCount, setRevealedCount] = useState(1);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [chapterEnded, setChapterEnded] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [choicesVisible, setChoicesVisible] = useState(false);
  const [error, setError] = useState("");
  const [readingWidth, setReadingWidth] = useState(1120);
  const revealAnchorRef = useRef<HTMLDivElement>(null);
  const choicesAnchorRef = useRef<HTMLElement>(null);
  const previousRevealCountRef = useRef(1);
  const sessionRef = useRef<ChapterSession | null>(null);
  const blocksRef = useRef<NovelStoryBlock[]>([]);
  const revealedCountRef = useRef(1);
  const choicesVisibleRef = useRef(false);
  const advancingRef = useRef(false);

  const chapter = novel?.chapters.find((item) => item.number === chapterNumber);
  const analysis = chapter?.analysis;
  const requestedRoleId = searchParams.get("role");
  const roleId = session?.roleId || requestedRoleId;
  const role = analysis ? selectableCharacters(analysis).find((character) => character.id === roleId)
    ?? selectableCharacters(analysis).find((character) => character.playable) : undefined;
  const allRevealed = blocks.length > 0 && revealedCount >= blocks.length;

  const queueSessionSave = (nextSession: ChapterSession) => {
    sessionRef.current = nextSession;
    setSession(nextSession);
    void saveChapterSession(nextSession).catch(() => setError("阅读进度暂时无法保存。"));
  };

  const compatibleSession = (candidate: ChapterSession | null, storedChapter: ImportedChapter, storedAnalysis: ChapterAnalysis, selectedRoleId: string) => {
    if (!candidate || candidate.sourceMode !== "faithful-v3" || candidate.roleId !== selectedRoleId) return false;
    if (candidate.compilerVersion !== storedAnalysis.compilerVersion || candidate.sourceHash !== storedAnalysis.sourceHash) return false;
    if (!Number.isInteger(candidate.sourceCursor) || candidate.sourceCursor < 1 || candidate.sourceCursor > storedChapter.paragraphs.length) return false;
    if (!Number.isInteger(candidate.revealedBlockCount) || candidate.revealedBlockCount < 1 || candidate.revealedBlockCount > candidate.sourceCursor) return false;
    return Number.isInteger(candidate.currentBeatIndex) && candidate.currentBeatIndex >= 0 && candidate.currentBeatIndex <= storedAnalysis.beats.length;
  };

  useEffect(() => {
    let cancelled = false;
    void getImportedNovel(storyId).then(async (storedNovel) => {
      const storedChapter = storedNovel?.chapters.find((item) => item.number === chapterNumber);
      const storedAnalysis = storedChapter?.analysis;
      const availableCharacters = storedAnalysis ? selectableCharacters(storedAnalysis) : [];
      const selectedRole = availableCharacters.find((character) => character.id === requestedRoleId && character.playable)
        ?? availableCharacters.find((character) => character.playable);
      if (!storedNovel || !storedChapter || storedAnalysis?.sourceMode !== "faithful-v3" || !storedAnalysis.beats?.length || !selectedRole || storedChapter.paragraphs.length === 0) {
        router.replace(`/story/${storyId}/chapter/${chapterNumber}/setup`);
        return;
      }
      const selectedRoleId = selectedRole.id;
      const storedSession = await getChapterSession(storyId, chapterNumber, selectedRoleId);
      const savedSession = compatibleSession(storedSession, storedChapter, storedAnalysis, selectedRoleId) ? storedSession : null;
      const firstBeat = storedAnalysis.beats[0]!;
      const opening = readNextSourceBlocks(storedChapter, firstBeat, 0);
      const initialFinalBeatReached = storedAnalysis.beats.length === 1 && hasReachedCheckpoint(storedChapter, firstBeat, 1);
      const initialCompleted = initialFinalBeatReached && storedChapter.paragraphs.length === 1;
      const activeSession: ChapterSession = savedSession || {
        id: chapterSessionId(storyId, chapterNumber, selectedRoleId), sourceMode: "faithful-v3",
        ...(storedAnalysis.compilerVersion ? { compilerVersion: storedAnalysis.compilerVersion } : {}),
        ...(storedAnalysis.sourceHash ? { sourceHash: storedAnalysis.sourceHash } : {}),
        novelId: storyId, chapterNumber, roleId: selectedRoleId, currentBeatIndex: initialFinalBeatReached ? 1 : 0, sourceCursor: opening.nextCursor,
        completedBeatIds: initialFinalBeatReached ? [firstBeat.id] : [], decisions: [],
        revealedBlockCount: 1, choicesVisible: false,
        progress: calculateProgress(storedChapter, 1, initialCompleted), status: initialCompleted ? "completed" : "playing",
        updatedAt: new Date().toISOString(),
      };
      if (!savedSession) await saveChapterSession(activeSession);
      if (cancelled) return;
      const restoredBlocks = sourceBlocks(storedChapter, 0, activeSession.sourceCursor);
      const restoredRevealCount = Math.max(1, Math.min(restoredBlocks.length, activeSession.revealedBlockCount));
      const restoredBeat = storedAnalysis.beats[activeSession.currentBeatIndex];
      const restoredChoices = restoredBeat && activeSession.currentBeatIndex < storedAnalysis.beats.length - 1
        ? choicesForRole(restoredBeat, selectedRoleId, storedAnalysis.characters)
        : [];
      const restoredCompleted = activeSession.status === "completed" && restoredRevealCount >= storedChapter.paragraphs.length;
      const restoredAtChoice = Boolean(
        restoredBeat
        && activeSession.currentBeatIndex < storedAnalysis.beats.length - 1
        && restoredRevealCount >= restoredBlocks.length
        && hasReachedCheckpoint(storedChapter, restoredBeat, activeSession.sourceCursor),
      );
      const repairedSession: ChapterSession = {
        ...activeSession,
        revealedBlockCount: restoredRevealCount,
        choicesVisible: Boolean(activeSession.choicesVisible && (restoredCompleted || restoredAtChoice)),
        progress: calculateProgress(storedChapter, restoredRevealCount, restoredCompleted),
        status: restoredCompleted ? "completed" : "playing",
      };
      setNovel(storedNovel);
      sessionRef.current = repairedSession;
      setSession(repairedSession);
      blocksRef.current = restoredBlocks;
      setBlocks(restoredBlocks);
      setChoices(restoredChoices);
      revealedCountRef.current = restoredRevealCount;
      setRevealedCount(restoredRevealCount);
      previousRevealCountRef.current = restoredRevealCount;
      choicesVisibleRef.current = repairedSession.choicesVisible;
      setChoicesVisible(repairedSession.choicesVisible);
      setChapterEnded(restoredCompleted);
      if (savedSession && JSON.stringify(repairedSession) !== JSON.stringify(activeSession)) queueSessionSave(repairedSession);
    }).catch((cause) => { console.error("Chapter load failed:", cause); setError("这一页暂时被风吹乱了。"); });
    return () => { cancelled = true; };
  }, [storyId, chapterNumber, router, requestedRoleId]);

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
    const activeSession = sessionRef.current;
    if (!chapter || !analysis || !activeSession || advancingRef.current) return;
    const loadedBlocks = blocksRef.current;
    const visibleCount = revealedCountRef.current;

    if (visibleCount < loadedBlocks.length) {
      const nextCount = visibleCount + 1;
      let nextBeatIndex = activeSession.currentBeatIndex;
      let completedBeatIds = activeSession.completedBeatIds;
      const currentBeat = analysis.beats[nextBeatIndex];
      if (currentBeat && nextBeatIndex === analysis.beats.length - 1 && hasReachedCheckpoint(chapter, currentBeat, nextCount)) {
        nextBeatIndex = analysis.beats.length;
        if (!completedBeatIds.includes(currentBeat.id)) completedBeatIds = [...completedBeatIds, currentBeat.id];
      }
      const completedNow = nextBeatIndex >= analysis.beats.length && nextCount >= chapter.paragraphs.length;
      const nextSession: ChapterSession = {
        ...activeSession,
        currentBeatIndex: nextBeatIndex,
        completedBeatIds,
        revealedBlockCount: nextCount,
        choicesVisible: completedNow,
        progress: calculateProgress(chapter, nextCount, completedNow),
        status: completedNow ? "completed" : "playing",
        updatedAt: new Date().toISOString(),
      };
      revealedCountRef.current = nextCount;
      setRevealedCount(nextCount);
      setChoicesVisible(completedNow);
      setChapterEnded(completedNow);
      queueSessionSave(nextSession);
      return;
    }

    if (activeSession.status === "completed") {
      choicesVisibleRef.current = true;
      setChoicesVisible(true);
      queueSessionSave({ ...activeSession, choicesVisible: true, updatedAt: new Date().toISOString() });
      window.setTimeout(() => choicesAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
      return;
    }

    const currentBeat = analysis.beats[activeSession.currentBeatIndex];
    if (currentBeat && activeSession.currentBeatIndex < analysis.beats.length - 1 && hasReachedCheckpoint(chapter, currentBeat, activeSession.sourceCursor)) {
      let nextBeatIndex = activeSession.currentBeatIndex + 1;
      const nextBeat = analysis.beats[nextBeatIndex];
      const nextWindow = readNextSourceBlocks(chapter, nextBeat, activeSession.sourceCursor);
      const appendedBlocks = [...loadedBlocks, ...nextWindow.blocks];
      const nextRevealCount = nextWindow.blocks.length > 0 ? loadedBlocks.length + 1 : loadedBlocks.length;
      let completedBeatIds = activeSession.completedBeatIds.includes(currentBeat.id) ? activeSession.completedBeatIds : [...activeSession.completedBeatIds, currentBeat.id];
      if (nextBeat && nextBeatIndex === analysis.beats.length - 1 && hasReachedCheckpoint(chapter, nextBeat, nextRevealCount)) {
        nextBeatIndex = analysis.beats.length;
        if (!completedBeatIds.includes(nextBeat.id)) completedBeatIds = [...completedBeatIds, nextBeat.id];
      }
      const completedNow = nextBeatIndex >= analysis.beats.length && nextRevealCount >= chapter.paragraphs.length;
      const nextSession: ChapterSession = {
        ...activeSession,
        currentBeatIndex: nextBeatIndex,
        sourceCursor: nextWindow.nextCursor,
        completedBeatIds,
        revealedBlockCount: nextRevealCount,
        choicesVisible: completedNow,
        progress: calculateProgress(chapter, nextRevealCount, completedNow),
        status: completedNow ? "completed" : "playing",
        updatedAt: new Date().toISOString(),
      };
      blocksRef.current = appendedBlocks;
      setBlocks(appendedBlocks);
      revealedCountRef.current = nextRevealCount;
      setRevealedCount(nextRevealCount);
      choicesVisibleRef.current = completedNow;
      setChoicesVisible(completedNow);
      setChapterEnded(completedNow);
      queueSessionSave(nextSession);
      return;
    }

    let nextBeatIndex = activeSession.currentBeatIndex;
    let completedBeatIds = activeSession.completedBeatIds;
    if (currentBeat && nextBeatIndex === analysis.beats.length - 1 && hasReachedCheckpoint(chapter, currentBeat, activeSession.sourceCursor)) {
      nextBeatIndex = analysis.beats.length;
      if (!completedBeatIds.includes(currentBeat.id)) completedBeatIds = [...completedBeatIds, currentBeat.id];
    }
    const nextBeat = analysis.beats[nextBeatIndex];
    const nextWindow = readNextSourceBlocks(chapter, nextBeat, activeSession.sourceCursor);
    const appendedBlocks = [...loadedBlocks, ...nextWindow.blocks];
    const nextCount = nextWindow.blocks.length > 0 ? visibleCount + 1 : visibleCount;
    if (nextBeat && nextBeatIndex === analysis.beats.length - 1 && hasReachedCheckpoint(chapter, nextBeat, nextCount)) {
      nextBeatIndex = analysis.beats.length;
      if (!completedBeatIds.includes(nextBeat.id)) completedBeatIds = [...completedBeatIds, nextBeat.id];
    }
    const completedNow = nextBeatIndex >= analysis.beats.length && nextCount >= chapter.paragraphs.length;
    const nextChoices = nextBeatIndex < analysis.beats.length - 1 && nextBeat
      ? choicesForRole(nextBeat, activeSession.roleId, analysis.characters)
      : [];
    const nextSession: ChapterSession = {
      ...activeSession,
      currentBeatIndex: nextBeatIndex,
      sourceCursor: nextWindow.nextCursor,
      completedBeatIds,
      revealedBlockCount: nextCount,
      choicesVisible: completedNow,
      progress: calculateProgress(chapter, nextCount, completedNow),
      status: completedNow ? "completed" : "playing",
      updatedAt: new Date().toISOString(),
    };
    blocksRef.current = appendedBlocks;
    setBlocks(appendedBlocks);
    revealedCountRef.current = nextCount;
    setRevealedCount(nextCount);
    choicesVisibleRef.current = completedNow;
    setChoicesVisible(completedNow);
    setChoices(nextChoices);
    setChapterEnded(completedNow);
    queueSessionSave(nextSession);
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

  const choose = (choice: NovelChoice) => {
    const activeSession = sessionRef.current;
    if (!chapter || !analysis || !role || !activeSession || advancingRef.current || !choicesVisibleRef.current) return;
    const currentBeat = analysis.beats[activeSession.currentBeatIndex];
    if (!currentBeat || activeSession.currentBeatIndex >= analysis.beats.length - 1 || !hasReachedCheckpoint(chapter, currentBeat, revealedCountRef.current)) return;
    const availableChoices = choicesForRole(currentBeat, activeSession.roleId, analysis.characters);
    if (!availableChoices.some((item) => item.id === choice.id)) return;
    advancingRef.current = true;
    setSelectedChoice(choice.id);
    setIsAdvancing(true);
    setError("");
    let nextBeatIndex = activeSession.currentBeatIndex + 1;
    const nextBeat = analysis.beats[nextBeatIndex];
    const nextWindow = readNextSourceBlocks(chapter, nextBeat, activeSession.sourceCursor);
    const loadedBlocks = blocksRef.current;
    const appendedBlocks = [...loadedBlocks, ...nextWindow.blocks];
    const nextRevealCount = nextWindow.blocks.length > 0 ? loadedBlocks.length + 1 : loadedBlocks.length;
    let completedBeatIds = activeSession.completedBeatIds.includes(currentBeat.id) ? activeSession.completedBeatIds : [...activeSession.completedBeatIds, currentBeat.id];
    if (nextBeat && nextBeatIndex === analysis.beats.length - 1 && hasReachedCheckpoint(chapter, nextBeat, nextRevealCount)) {
      nextBeatIndex = analysis.beats.length;
      if (!completedBeatIds.includes(nextBeat.id)) completedBeatIds = [...completedBeatIds, nextBeat.id];
    }
    const completedNow = nextBeatIndex >= analysis.beats.length && nextRevealCount >= chapter.paragraphs.length;
    const nextChoices = nextBeatIndex < analysis.beats.length - 1 && nextBeat
      ? choicesForRole(nextBeat, activeSession.roleId, analysis.characters)
      : [];
    const nextSession: ChapterSession = {
      ...activeSession,
      currentBeatIndex: nextBeatIndex,
      sourceCursor: nextWindow.nextCursor,
      completedBeatIds,
      decisions: [...(activeSession.decisions || []), { id: crypto.randomUUID(), beatId: currentBeat.id, choiceId: choice.id, createdAt: new Date().toISOString() }],
      revealedBlockCount: nextRevealCount,
      choicesVisible: false,
      progress: calculateProgress(chapter, nextRevealCount, completedNow),
      status: completedNow ? "completed" : "playing",
      updatedAt: new Date().toISOString(),
    };
    blocksRef.current = appendedBlocks;
    setBlocks(appendedBlocks);
    revealedCountRef.current = nextRevealCount;
    setRevealedCount(nextRevealCount);
    previousRevealCountRef.current = loadedBlocks.length;
    choicesVisibleRef.current = false;
    setChoicesVisible(false);
    setChoices(nextChoices);
    setChapterEnded(completedNow);
    queueSessionSave(nextSession);
    setSelectedChoice(null);
    setIsAdvancing(false);
    advancingRef.current = false;
  };

  if (!novel || !chapter || !analysis || !role || !session || blocks.length === 0) {
    return <div className="grid min-h-screen place-items-center bg-[#e9e4da] px-5"><div className="novel-reading-paper w-full max-w-xl border border-[#d8d0c2] p-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-[#8c7c66]" /><p className="mt-5 font-serif text-lg">正在翻开这一章…</p>{error && <p className="mt-3 text-xs text-red-700">{error}</p>}</div></div>;
  }

  return (
    <div className="min-h-screen bg-[#e9e4da] text-[#312d27] selection:bg-[#d8cdbb]">
      <NovelImportHeader backHref={`/story/${storyId}/chapter/${chapterNumber}/setup`} action={`${novel.title} · 第 ${chapterNumber} 章`} />
      <main style={{ maxWidth: `${readingWidth}px` }} className="mx-auto w-full px-3 py-5 transition-[max-width] duration-200 sm:px-8 sm:py-10">
        <article onClick={revealNext} className={`novel-reading-paper relative min-h-[calc(100dvh-7rem)] overflow-hidden rounded-sm border border-[#d8d0c2] px-6 py-10 shadow-[0_22px_70px_rgba(73,58,38,.13)] sm:px-14 sm:py-14 md:px-20 ${!choicesVisible ? "cursor-pointer" : ""}`} aria-label="小说阅读页，点击空白处继续阅读">
          <div className="pointer-events-none absolute inset-y-0 left-8 hidden w-px bg-[#d7cec0]/55 sm:block" />
          <header className="relative border-b border-[#d8d0c2]/80 pb-8 text-center"><p className="text-[9px] font-medium uppercase tracking-[.32em] text-[#9a8f80]">{novel.title} · Chapter {String(chapterNumber).padStart(2, "0")}</p><h1 className="mt-4 font-serif text-3xl font-semibold tracking-[.08em] text-[#2e2923] sm:text-4xl">{chapter.title}</h1></header>
          <div style={{ maxWidth: `${Math.min(1080, Math.max(620, readingWidth - 190))}px` }} className="relative mx-auto mt-10 pb-28 transition-[max-width] duration-200 sm:mt-12">
            <div className="mb-9 flex items-center border-b border-dashed border-[#d8d0c2] pb-5"><div className="flex items-center gap-3"><NovelCharacterPortrait character={role} small /><div><p className="text-[9px] text-[#9a8f80]">本章扮演</p><p className="mt-0.5 font-serif text-sm font-semibold">{role.name}</p></div></div></div>
            <div className="space-y-8">{blocks.slice(0, revealedCount).map((block, index) => {
              if (block.type === "dialogue") { const character = analysis.characters.find((item) => item.name === block.speaker); return <div key={`source-${index}`} className="novel-block-reveal flex gap-4 py-2 sm:gap-5"><NovelCharacterPortrait character={character} /><div className="min-w-0 pt-0.5"><p className="text-[10px] font-medium tracking-[.12em] text-[#8b7d69]">{block.speaker}</p><p className="mt-2 font-serif text-[16px] leading-8 text-[#37312a] sm:text-[17px]">“{block.text}”</p></div></div>; }
              if (block.type === "action") return <p key={`source-${index}`} className="novel-block-reveal border-l-2 border-[#9c8a70] py-1 pl-5 font-serif text-[14px] italic leading-7 text-[#746856]">你选择：{block.text}</p>;
              return <p key={`source-${index}`} className="novel-block-reveal font-serif text-[16px] leading-[2.15] tracking-[.025em] text-[#454038] sm:text-[17px]">{block.text}</p>;
            })}</div>
            <div ref={revealAnchorRef} className="h-px scroll-mt-28" aria-hidden="true" />
            {(!allRevealed || !choicesVisible) && <button type="button" onClick={(event) => { event.stopPropagation(); revealNext(); }} className="novel-continue-mark mx-auto mt-12 flex items-center gap-2 text-[10px] tracking-[.14em] text-[#9a8f80]"><span>{allRevealed ? "点击继续故事" : "点击书页继续"}</span><span className="text-[8px]">▼</span></button>}
            {allRevealed && choicesVisible && <section ref={choicesAnchorRef} onClick={(event) => event.stopPropagation()} className="novel-block-reveal mt-14 scroll-mb-24 border-t border-[#d8d0c2] pt-8">
              {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50/70 px-4 py-3 text-xs text-red-700">{error}</div>}
              {chapterEnded ? <div className="text-center"><Feather className="mx-auto h-4 w-4 text-[#8c7c66]" /><p className="mt-4 font-serif text-sm text-[#746856]">这一章已经抵达句点。</p><button onClick={() => setCompleted(true)} className="mt-5 border-b border-[#6f6251] pb-1 font-serif text-sm font-semibold">翻开章末</button></div> : <><div className="mb-6 flex items-center gap-3"><Feather className="h-3.5 w-3.5 text-[#8c7c66]" /><p className="font-serif text-sm font-semibold tracking-[.08em]">此刻，{role.name}决定——</p></div><div className="space-y-2">{choices.map((choice, index) => <button key={choice.id} disabled={isAdvancing} onClick={() => choose(choice)} className={`group flex w-full items-start gap-4 border-b border-[#ddd4c6] px-2 py-4 text-left transition last:border-b-0 ${selectedChoice === choice.id ? "bg-[#ded5c7]/55" : "hover:bg-white/45"}`}><span className="mt-0.5 font-serif text-xs text-[#9a8f80]">{String.fromCharCode(65 + index)}.</span><span className="min-w-0 flex-1"><span className="block font-serif text-[15px] leading-6 text-[#3d372f]">{choice.label}</span><span className="mt-1 block text-[9px] leading-4 text-[#9a8f80]">{choice.hint}</span></span>{selectedChoice === choice.id ? <Loader2 className="mt-1 h-3.5 w-3.5 animate-spin" /> : <ChevronRight className="mt-1 h-3.5 w-3.5 text-[#aaa092]" />}</button>)}</div><p className="mt-6 text-center text-[9px] tracking-[.08em] text-[#aaa092]">选择只改变阅读关注点，原著内容与顺序保持不变</p></>}
            </section>}
          </div>
          <footer className="absolute inset-x-0 bottom-5 flex items-center justify-center gap-4 text-[9px] text-[#aaa092]"><span className="h-px w-10 bg-[#d6ccbd]" /><span>第 {String(chapterNumber).padStart(2, "0")} 章</span><span className="h-px w-10 bg-[#d6ccbd]" /></footer>
        </article>
      </main>
      <div className="fixed bottom-5 left-1/2 z-40 h-[3px] w-[min(320px,58vw)] -translate-x-1/2 overflow-hidden rounded-full bg-[#cfc4b4]/90 shadow-[0_1px_5px_rgba(73,58,38,.15)] backdrop-blur" title={`本章进度 ${session.progress ?? 1}%`} aria-label={`本章进度 ${session.progress ?? 1}%`}><span className="block h-full min-w-[10px] rounded-full bg-[#625746] transition-[width] duration-700 ease-out" style={{ width: `${session.progress ?? 1}%` }} /></div>
      <aside className="fixed bottom-5 right-5 z-40 hidden items-center gap-2 rounded-full border border-[#d4cabb] bg-[#f8f3e9]/95 px-3 py-2 text-[#776b5d] shadow-[0_10px_35px_rgba(73,58,38,.14)] backdrop-blur sm:flex"><button onClick={() => setReadingWidth((width) => Math.max(760, width - 80))} className="grid h-7 w-7 place-items-center rounded-full hover:bg-[#e9e0d3]"><Minus className="h-3.5 w-3.5" /></button><Maximize2 className="h-3.5 w-3.5 text-[#9b8f80]" /><input type="range" min="760" max="1380" step="10" value={readingWidth} onChange={(event) => setReadingWidth(Number(event.target.value))} className="novel-width-slider w-28" aria-label="阅读区域宽度" /><button onClick={() => setReadingWidth((width) => Math.min(1380, width + 80))} className="grid h-7 w-7 place-items-center rounded-full hover:bg-[#e9e0d3]"><Plus className="h-3.5 w-3.5" /></button></aside>
      {completed && <div className="fixed inset-0 z-50 grid place-items-center bg-[#e9e4da]/92 p-5 backdrop-blur-sm"><div className="novel-reading-paper w-full max-w-xl border border-[#d8d0c2] p-8 text-center shadow-[0_30px_100px_rgba(73,58,38,.2)] sm:p-11"><span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#3a342c] text-[#f7f2e8]"><BookOpen className="h-4 w-4" /></span><p className="mt-7 text-[9px] uppercase tracking-[.28em] text-[#9a8f80]">Chapter {String(chapterNumber).padStart(2, "0")} · Complete</p><h2 className="mt-3 font-serif text-3xl font-semibold">本章已落幕</h2><div className="mx-auto mt-7 h-px w-16 bg-[#c9bdab]" />{chapterNumber < novel.chapters.length ? <button onClick={() => router.push(`/story/${storyId}/chapter/${chapterNumber + 1}/setup`)} className="mx-auto mt-7 flex items-center gap-2 border-b border-[#6f6251] pb-1 font-serif text-sm font-semibold">翻开下一章 <ArrowRight className="h-3.5 w-3.5" /></button> : <button onClick={() => router.push("/bookshelf")} className="mx-auto mt-7 flex items-center gap-2 border-b border-[#6f6251] pb-1 font-serif text-sm font-semibold">合上书页 <ArrowRight className="h-3.5 w-3.5" /></button>}</div></div>}
    </div>
  );
}

export default function NovelChapterPlay(props: { storyId: string; chapterNumber: number }) {
  const searchParams = useSearchParams();
  return searchParams.get("mode") === "ai" ? <NovelChapterAiPlay {...props} /> : <OriginalNovelChapterPlay {...props} />;
}
