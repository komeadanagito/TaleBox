"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, ChevronRight, Feather, Loader2, MapPin, Maximize2, Minus, Plus, Send } from "lucide-react";
import NovelImportHeader from "./NovelImportHeader";
import NovelCharacterPortrait from "./NovelCharacterPortrait";
import NovelStoryBackstage from "./NovelStoryBackstage";
import { chapterSessionId, getChapterSession, getImportedNovel, saveChapterSession } from "../lib/import-novel/store";
import { selectableCharacters } from "../lib/import-novel/roles";
import type { AiChapterTurn, AiNarrativeMode, ChapterSession, ImportedNovel, NovelChoice, NovelStoryBlock, StoryRuntimeSnapshot } from "../lib/import-novel/types";

const AI_WINDOW_SIZE = 6;
const AI_RUNTIME_VERSION = "1.3.0";
type AiTurnResult = { location: string; blocks: NovelStoryBlock[]; choices: NovelChoice[]; runtimeSnapshot: StoryRuntimeSnapshot };
const aiRequests = new Map<string, Promise<AiTurnResult>>();

function requestAiTurn(input: {
  key: string;
  chapterTitle: string;
  roleId: string;
  roleName: string;
  characterNames: string[];
  currentLocation: string;
  sourceParagraphs: Array<{ id: string; text: string }>;
  selectedChoice: string;
  selectedChoiceKind: NovelChoice["kind"] | "enter";
  narrativeMode: AiNarrativeMode;
  previousRuntime?: StoryRuntimeSnapshot;
  recentDecisions: string[];
  isFinal: boolean;
}) {
  const existing = aiRequests.get(input.key);
  if (existing) return existing;
  const request = fetch("/api/import/ai-turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then(async (response) => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "AI叙事暂时无法继续");
    return data.result as AiTurnResult;
  }).finally(() => aiRequests.delete(input.key));
  aiRequests.set(input.key, request);
  return request;
}

function locationAtReveal(turns: AiChapterTurn[], revealedCount: number) {
  let blockEnd = 0;
  for (const turn of turns) {
    blockEnd += turn.blocks.length;
    if (revealedCount <= blockEnd) return turn.location;
  }
  return turns.at(-1)?.location || "";
}

export default function NovelChapterAiPlay({ storyId, chapterNumber }: { storyId: string; chapterNumber: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRoleId = searchParams.get("role");
  const narrativeMode: AiNarrativeMode = searchParams.get("narrative") === "free" ? "free" : "faithful";
  const [novel, setNovel] = useState<ImportedNovel | null>(null);
  const [session, setSession] = useState<ChapterSession | null>(null);
  const [blocks, setBlocks] = useState<NovelStoryBlock[]>([]);
  const [choices, setChoices] = useState<NovelChoice[]>([]);
  const [revealedCount, setRevealedCount] = useState(1);
  const [choicesVisible, setChoicesVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState("");
  const [backstageOpen, setBackstageOpen] = useState(false);
  const [error, setError] = useState("");
  const [completedOverlay, setCompletedOverlay] = useState(false);
  const [readingWidth, setReadingWidth] = useState(1120);
  const sessionRef = useRef<ChapterSession | null>(null);
  const revealAnchorRef = useRef<HTMLDivElement>(null);
  const advancingRef = useRef(false);

  const chapter = novel?.chapters.find((item) => item.number === chapterNumber);
  const analysis = chapter?.analysis;
  const role = analysis ? selectableCharacters(analysis).find((item) => item.id === (session?.roleId || requestedRoleId)) ?? selectableCharacters(analysis).find((item) => item.playable) : undefined;
  const allRevealed = blocks.length > 0 && revealedCount >= blocks.length;
  const completed = session?.status === "completed";
  const currentLocation = locationAtReveal(session?.aiTurns || [], revealedCount);

  const persist = (next: ChapterSession) => {
    sessionRef.current = next;
    setSession(next);
    void saveChapterSession(next).catch(() => setError("AI阅读进度暂时无法保存。"));
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const storedNovel = await getImportedNovel(storyId);
        const storedChapter = storedNovel?.chapters.find((item) => item.number === chapterNumber);
        const storedAnalysis = storedChapter?.analysis;
        const available = storedAnalysis ? selectableCharacters(storedAnalysis) : [];
        const selectedRole = available.find((item) => item.id === requestedRoleId && item.playable) ?? available.find((item) => item.playable);
        if (!storedNovel || !storedChapter || !storedAnalysis || !selectedRole || storedChapter.paragraphs.length === 0) {
          router.replace(`/story/${storyId}/chapter/${chapterNumber}/setup`);
          return;
        }
        const saved = await getChapterSession(storyId, chapterNumber, selectedRole.id, "ai", narrativeMode);
        const compatible = saved?.driveMode === "ai" && saved.aiNarrativeMode === narrativeMode && saved.aiRuntimeVersion === AI_RUNTIME_VERSION && saved.sourceHash === storedAnalysis.sourceHash && saved.compilerVersion === storedAnalysis.compilerVersion && (saved.aiTurns?.length || 0) > 0;
        if (compatible && saved) {
          if (cancelled) return;
          const restoredBlocks = saved.aiTurns!.flatMap((turn) => turn.blocks);
          const lastTurn = saved.aiTurns!.at(-1)!;
          setNovel(storedNovel);
          sessionRef.current = saved;
          setSession(saved);
          setBlocks(restoredBlocks);
          setChoices(lastTurn.selectedChoiceId ? [] : lastTurn.choices);
          setRevealedCount(Math.min(saved.revealedBlockCount, restoredBlocks.length));
          setChoicesVisible(saved.choicesVisible);
          setLoading(false);
          return;
        }
        const end = Math.min(AI_WINDOW_SIZE, storedChapter.paragraphs.length);
        const result = await requestAiTurn({
          key: `${storyId}:${chapterNumber}:${selectedRole.id}:0`,
          chapterTitle: storedChapter.title,
          roleId: selectedRole.id,
          roleName: selectedRole.name,
          characterNames: available.map((character) => character.name),
          currentLocation: "",
          sourceParagraphs: storedChapter.paragraphs.slice(0, end).map(({ id, text }) => ({ id, text })),
          selectedChoice: "进入本章",
          selectedChoiceKind: "enter",
          narrativeMode,
          recentDecisions: [],
          isFinal: end >= storedChapter.paragraphs.length,
        });
        const turn: AiChapterTurn = { id: crypto.randomUUID(), sourceStart: 0, sourceEnd: end, location: result.location, blocks: result.blocks, choices: result.choices, runtimeSnapshot: result.runtimeSnapshot, createdAt: new Date().toISOString() };
        const next: ChapterSession = {
          id: chapterSessionId(storyId, chapterNumber, selectedRole.id, "ai", narrativeMode), sourceMode: "faithful-v3", driveMode: "ai", aiNarrativeMode: narrativeMode, aiRuntimeVersion: AI_RUNTIME_VERSION,
          ...(storedAnalysis.compilerVersion ? { compilerVersion: storedAnalysis.compilerVersion } : {}),
          ...(storedAnalysis.sourceHash ? { sourceHash: storedAnalysis.sourceHash } : {}),
          novelId: storyId, chapterNumber, roleId: selectedRole.id,
          currentBeatIndex: 0, sourceCursor: end, completedBeatIds: [], decisions: [], aiTurns: [turn], revealedBlockCount: 1,
          storyRuntime: result.runtimeSnapshot, choicesVisible: false, progress: Math.max(1, Math.round((1 / result.blocks.length) * (end / storedChapter.paragraphs.length) * 100)), status: "playing", updatedAt: new Date().toISOString(),
        };
        await saveChapterSession(next);
        if (cancelled) return;
        setNovel(storedNovel); sessionRef.current = next; setSession(next); setBlocks(result.blocks); setChoices(result.choices); setRevealedCount(1); setLoading(false);
      } catch (cause) {
        if (!cancelled) { setError(cause instanceof Error ? cause.message : "AI叙事暂时无法开始"); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [storyId, chapterNumber, requestedRoleId, narrativeMode, router]);

  useEffect(() => {
    const savedWidth = window.localStorage.getItem("talebox_novel_reading_width");
    if (savedWidth) setReadingWidth(Number(savedWidth));
  }, []);

  useEffect(() => {
    window.localStorage.setItem("talebox_novel_reading_width", String(readingWidth));
  }, [readingWidth]);

  useEffect(() => {
    const timer = window.setTimeout(() => revealAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    return () => window.clearTimeout(timer);
  }, [revealedCount, blocks.length]);

  const revealNext = () => {
    const active = sessionRef.current;
    if (!active || loading) return;
    if (revealedCount < blocks.length) {
      const nextCount = revealedCount + 1;
      const finishedTurn = nextCount >= blocks.length;
      const finishedChapter = finishedTurn && active.sourceCursor >= (chapter?.paragraphs.length || Infinity);
      const next = { ...active, revealedBlockCount: nextCount, progress: finishedTurn ? Math.round((active.sourceCursor / chapter!.paragraphs.length) * 100) : active.progress, status: finishedChapter ? "completed" as const : active.status, updatedAt: new Date().toISOString() };
      setRevealedCount(nextCount); persist(next); return;
    }
    if (active.sourceCursor >= (chapter?.paragraphs.length || Infinity) && active.status !== "completed") {
      const next = { ...active, progress: 100, status: "completed" as const, choicesVisible: true, updatedAt: new Date().toISOString() };
      setChoicesVisible(true);
      persist(next);
      return;
    }
    if (!choicesVisible) { setChoicesVisible(true); persist({ ...active, choicesVisible: true, updatedAt: new Date().toISOString() }); }
  };

  const choose = async (choice: NovelChoice) => {
    const active = sessionRef.current;
    if (!chapter || !role || !active || loading || advancingRef.current || active.sourceCursor >= chapter.paragraphs.length) return;
    setLoading(true); setError("");
    setSelectedChoice(choice.id);
    advancingRef.current = true;
    try {
      const start = active.sourceCursor;
      const end = Math.min(start + AI_WINDOW_SIZE, chapter.paragraphs.length);
      const previousTurns = active.aiTurns || [];
      const updatedTurns = previousTurns.map((turn, index) => index === previousTurns.length - 1 ? { ...turn, selectedChoiceId: choice.id } : turn);
      const result = await requestAiTurn({ key: `${storyId}:${chapterNumber}:${role.id}:${narrativeMode}:${start}:${choice.id}`, chapterTitle: chapter.title, roleId: role.id, roleName: role.name, characterNames: selectableCharacters(analysis!).map((character) => character.name), currentLocation: active.aiTurns?.at(-1)?.location || "", sourceParagraphs: chapter.paragraphs.slice(start, end).map(({ id, text }) => ({ id, text })), selectedChoice: choice.label, selectedChoiceKind: choice.kind, narrativeMode, ...(active.storyRuntime ? { previousRuntime: active.storyRuntime } : {}), recentDecisions: (active.decisions || []).slice(-2).map((decision) => decision.choiceId), isFinal: end >= chapter.paragraphs.length });
      
      const localActionBlock: NovelStoryBlock = { type: "action", speaker: role.name, text: choice.label };
      const filteredBlocks = result.blocks.filter((block) => block.type !== "action");
      const turnBlocks = [localActionBlock, ...filteredBlocks];
      
      const turn: AiChapterTurn = { id: crypto.randomUUID(), sourceStart: start, sourceEnd: end, location: result.location, blocks: turnBlocks, choices: result.choices, runtimeSnapshot: result.runtimeSnapshot, createdAt: new Date().toISOString() };
      const nextBlocks = [...blocks, ...turnBlocks];
      const nextCount = blocks.length + 1;
      const next: ChapterSession = { ...active, sourceCursor: end, aiTurns: [...updatedTurns, turn], storyRuntime: result.runtimeSnapshot, decisions: [...(active.decisions || []), { id: crypto.randomUUID(), beatId: `ai-window-${start}`, choiceId: choice.label, createdAt: new Date().toISOString() }], revealedBlockCount: nextCount, choicesVisible: false, progress: active.progress, status: "playing", updatedAt: new Date().toISOString() };
      setBlocks(nextBlocks); setChoices(result.choices); setRevealedCount(nextCount); setChoicesVisible(false); persist(next);
      if (choice.id.startsWith("custom-")) setCustomInput("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "AI叙事暂时无法继续"); }
    finally { setLoading(false); setSelectedChoice(null); advancingRef.current = false; }
  };

  const submitCustomAction = () => {
    const text = customInput.trim();
    if (!text || loading || narrativeMode !== "free") return;
    void choose({ id: `custom-${Date.now()}`, kind: "explore", label: text, hint: "由你决定的行动", doesNotChangeCanon: false });
  };

  if (!novel || !chapter || !analysis || !role || !session || blocks.length === 0) return <div className="grid min-h-screen place-items-center bg-[#e9e4da] px-5"><div className="novel-reading-paper w-full max-w-xl border border-[#d8d0c2] p-10 text-center">{loading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-[#8c7c66]" />}<p className="mt-5 font-serif text-lg">{error || "AI 正在重读这一页…"}</p>{error && <button onClick={() => router.refresh()} className="mt-6 rounded-full bg-zinc-950 px-5 py-3 text-xs text-white">重新尝试</button>}</div></div>;

  return (
    <div className="min-h-screen bg-[#e9e4da] text-[#312d27] selection:bg-[#d8cdbb]">
      <NovelImportHeader backHref={`/story/${storyId}/chapter/${chapterNumber}/setup`} action={`${novel.title} · 第 ${chapterNumber} 章`} />
      <main style={{ maxWidth: `${readingWidth}px` }} className="mx-auto w-full px-3 py-5 transition-[max-width] duration-200 sm:px-8 sm:py-10">
        <article onClick={revealNext} className={`novel-reading-paper relative min-h-[calc(100dvh-7rem)] overflow-hidden rounded-sm border border-[#d8d0c2] px-6 py-10 shadow-[0_22px_70px_rgba(73,58,38,.13)] sm:px-14 sm:py-14 md:px-20 ${!choicesVisible ? "cursor-pointer" : ""}`}>
          <div className="pointer-events-none absolute inset-y-0 left-8 hidden w-px bg-[#d7cec0]/55 sm:block" />
          <header className="relative border-b border-[#d8d0c2]/80 pb-8 text-center">
            <p className="text-[9px] font-medium uppercase tracking-[.32em] text-[#9a8f80]">{novel.title} · Chapter {String(chapterNumber).padStart(2, "0")}</p>
            <h1 className="mt-4 font-serif text-3xl font-semibold tracking-[.08em] text-[#2e2923] sm:text-4xl">{chapter.title}</h1>
            {currentLocation && <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-[#9a8f80]"><MapPin className="h-3 w-3" /> {currentLocation}</p>}
          </header>

          <div style={{ maxWidth: `${Math.min(1080, Math.max(620, readingWidth - 190))}px` }} className="relative mx-auto mt-10 pb-28 transition-[max-width] duration-200 sm:mt-12">
            <div className="mb-9 flex items-center border-b border-dashed border-[#d8d0c2] pb-5">
              <div className="flex items-center gap-3">
                <NovelCharacterPortrait character={role} small />
                <div><p className="text-[9px] text-[#9a8f80]">本章扮演</p><p className="mt-0.5 font-serif text-sm font-semibold">{role.name}</p></div>
              </div>
            </div>

            <div className="space-y-8">
              {blocks.slice(0, revealedCount).map((block, index) => {
                if (block.type === "dialogue") {
                  const character = analysis.characters.find((item) => item.name === block.speaker);
                  return <div key={`ai-source-${index}`} className="novel-block-reveal flex gap-4 py-2 sm:gap-5"><NovelCharacterPortrait character={character} /><div className="min-w-0 pt-0.5"><p className="text-[10px] font-medium tracking-[.12em] text-[#8b7d69]">{block.speaker}</p><p className="mt-2 font-serif text-[16px] leading-8 text-[#37312a] sm:text-[17px]">“{block.text}”</p></div></div>;
                }
                if (block.type === "action") return <p key={`ai-source-${index}`} className="novel-block-reveal border-l-2 border-[#9c8a70] py-1 pl-5 font-serif text-[14px] italic leading-7 text-[#746856]">你选择：{block.text}</p>;
                return <p key={`ai-source-${index}`} className="novel-block-reveal font-serif text-[16px] leading-[2.15] tracking-[.025em] text-[#454038] sm:text-[17px]">{block.text}</p>;
              })}
            </div>
            <div ref={revealAnchorRef} className="h-px scroll-mt-28" />
            {error && <p className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">{error}</p>}
            {(!allRevealed || !choicesVisible) && <button onClick={(event) => { event.stopPropagation(); revealNext(); }} className="novel-continue-mark mx-auto mt-12 flex items-center gap-2 text-[10px] tracking-[.14em] text-[#9a8f80]">{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><span>{allRevealed ? "点击继续故事" : "点击书页继续"}</span><span className="text-[8px]">▼</span></>}</button>}
            {allRevealed && choicesVisible && <section onClick={(event) => event.stopPropagation()} className="novel-block-reveal mt-14 border-t border-[#d8d0c2] pt-8">
              {completed ? <div className="text-center"><Feather className="mx-auto h-4 w-4 text-[#8c7c66]" /><p className="mt-4 font-serif text-sm text-[#746856]">这一章已经抵达句点。</p><button onClick={() => setCompletedOverlay(true)} className="mt-5 border-b border-[#6f6251] pb-1 font-serif text-sm font-semibold">翻开章末</button></div> : <><div className="mb-6 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><Feather className="h-3.5 w-3.5 text-[#8c7c66]" /><p className="font-serif text-sm font-semibold tracking-[.08em]">此刻，{role.name}决定——</p></div><span className="text-[9px] tracking-[.12em] text-[#aaa092]">{narrativeMode === "free" ? "自由探索" : "遵循原作"}</span></div><div className="space-y-2">{choices.map((choice, index) => <button key={choice.id} disabled={loading} onClick={() => void choose(choice)} className={`group flex w-full items-start gap-4 border-b border-[#ddd4c6] px-2 py-4 text-left transition last:border-b-0 ${selectedChoice === choice.id ? "bg-[#ded5c7]/70" : "hover:bg-white/45"}`}><span className="mt-0.5 font-serif text-xs text-[#9a8f80]">{String.fromCharCode(65 + index)}.</span><span className="min-w-0 flex-1"><span className="block font-serif text-[15px] leading-6 text-[#3d372f]">{choice.label}</span><span className="mt-1 block text-[9px] leading-4 text-[#9a8f80]">{choice.hint}</span></span>{selectedChoice === choice.id ? <Loader2 className="mt-1 h-3.5 w-3.5 animate-spin" /> : <ChevronRight className="mt-1 h-3.5 w-3.5 text-[#aaa092]" />}</button>)}</div>{narrativeMode === "free" && <div className="mt-7 rounded-2xl border border-[#d8d0c2] bg-white/35 p-3 sm:p-4"><label htmlFor="custom-story-action" className="font-serif text-xs font-semibold text-[#5f5548]">或者，写下你真正想做的事</label><div className="mt-3 flex items-end gap-2"><textarea id="custom-story-action" value={customInput} maxLength={120} rows={2} disabled={loading} onChange={(event) => setCustomInput(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); submitCustomAction(); } }} placeholder="例如：先不回答他，悄悄观察桌上的信。" className="min-h-[64px] flex-1 resize-none bg-transparent px-2 py-1 font-serif text-sm leading-6 text-[#3d372f] outline-none placeholder:text-[#aaa092] disabled:opacity-60" /><button type="button" disabled={!customInput.trim() || loading} onClick={submitCustomAction} aria-label="提交自定义行动" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#3c352c] text-[#f8f1e5] transition hover:bg-[#211d18] disabled:cursor-not-allowed disabled:opacity-30">{selectedChoice?.startsWith("custom-") ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}</button></div><div className="mt-2 flex items-center justify-between px-2 text-[8px] text-[#aaa092]"><span>⌘ / Ctrl + Enter 发送</span><span>{customInput.length} / 120</span></div></div>}<p className="mt-6 text-center text-[9px] tracking-[.06em] text-[#aaa092]">{narrativeMode === "free" ? "保留原作世界与人物基础，你的行动可以改变故事走向" : "选择围绕原文展开，主要人物、因果与剧情保持原作走向"}</p></>}
            </section>}
          </div>
          <footer className="absolute inset-x-0 bottom-5 flex items-center justify-center gap-4 text-[9px] text-[#aaa092]"><span className="h-px w-10 bg-[#d6ccbd]" /><span>第 {String(chapterNumber).padStart(2, "0")} 章</span><span className="h-px w-10 bg-[#d6ccbd]" /></footer>
        </article>
      </main>

      <div className="fixed bottom-5 left-1/2 z-40 h-[3px] w-[min(320px,58vw)] -translate-x-1/2 overflow-hidden rounded-full bg-[#cfc4b4]/90"><span className="block h-full rounded-full bg-[#625746] transition-all" style={{ width: `${session.progress}%` }} /></div>
      <aside className="fixed bottom-5 right-5 z-40 hidden items-center gap-2 rounded-full border border-[#d4cabb] bg-[#f8f3e9]/95 px-3 py-2 text-[#776b5d] shadow-[0_10px_35px_rgba(73,58,38,.14)] backdrop-blur sm:flex"><button onClick={() => setReadingWidth((width) => Math.max(760, width - 80))} className="grid h-7 w-7 place-items-center rounded-full hover:bg-[#e9e0d3]"><Minus className="h-3.5 w-3.5" /></button><Maximize2 className="h-3.5 w-3.5 text-[#9b8f80]" /><input type="range" min="760" max="1380" step="10" value={readingWidth} onChange={(event) => setReadingWidth(Number(event.target.value))} className="novel-width-slider w-28" aria-label="阅读区域宽度" /><button onClick={() => setReadingWidth((width) => Math.min(1380, width + 80))} className="grid h-7 w-7 place-items-center rounded-full hover:bg-[#e9e0d3]"><Plus className="h-3.5 w-3.5" /></button></aside>

      <NovelStoryBackstage open={backstageOpen} onOpenChange={setBackstageOpen} role={role} session={session} chapterTitle={chapter.title} location={currentLocation} narrativeMode={narrativeMode} />

      {completedOverlay && <div className="fixed inset-0 z-50 grid place-items-center bg-[#e9e4da]/92 p-5 backdrop-blur"><div className="novel-reading-paper w-full max-w-xl p-10 text-center"><BookOpen className="mx-auto h-5 w-5" /><h2 className="mt-5 font-serif text-3xl">本章已落幕</h2><button onClick={() => chapterNumber < novel.chapters.length ? router.push(`/story/${storyId}/chapter/${chapterNumber + 1}/setup`) : router.push("/bookshelf")} className="mx-auto mt-7 flex items-center gap-2 border-b border-zinc-700 font-serif text-sm">{chapterNumber < novel.chapters.length ? "翻开下一章" : "合上书页"}<ArrowRight className="h-3.5 w-3.5" /></button></div></div>}
    </div>
  );
}
