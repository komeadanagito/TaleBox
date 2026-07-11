"use client";

import { useEffect, useRef } from "react";
import {
  ArrowRight,
  BookOpen,
  Compass,
  Library,
  PackageOpen,
  Users,
} from "lucide-react";
import type { StoryFramework } from "../app/context/StoryContext";

interface ChapterCompleteOverlayProps {
  chapterNumber: number;
  summary: string;
  framework: StoryFramework;
  transitions: any;
  nextChapterData: any;
  isGeneratingNextChapter: boolean;
  onContinue: () => void;
  onBackToBookshelf: () => void;
}

export default function ChapterCompleteOverlay({
  chapterNumber,
  summary,
  framework,
  transitions,
  nextChapterData,
  isGeneratingNextChapter,
  onContinue,
  onBackToBookshelf,
}: ChapterCompleteOverlayProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const leaving = transitions?.leave || [];
  const entering = transitions?.enter || [];

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div
      className="chapter-complete-overlay fixed inset-0 z-50 overflow-y-auto bg-[#eee7d9] text-[#29251f]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chapter-complete-title"
      aria-busy={isGeneratingNextChapter}
    >
      <div className="chapter-complete-paper mx-auto min-h-dvh w-full max-w-5xl px-5 py-8 sm:px-10 sm:py-12">
        <header className="settle-card-1 mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#9a6f36]">
            Chapter {chapterNumber} · Written
          </p>
          <h2
            id="chapter-complete-title"
            ref={headingRef}
            tabIndex={-1}
            className="mt-4 font-serif text-4xl font-semibold tracking-tight text-[#242019] outline-none sm:text-5xl"
          >
            第 {chapterNumber} 章 · 已写成
          </h2>
          <p className="mt-3 font-serif text-sm leading-7 text-[#766c5e]">
            这一章的故事，在此暂告一段落
          </p>
          <div className="mx-auto mt-6 flex w-44 items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#bca982]" />
            <span className="h-1.5 w-1.5 rotate-45 bg-[#9a6f36]" />
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#bca982]" />
          </div>
        </header>

        <main className="mx-auto mt-8 max-w-3xl space-y-4 pb-32">
          <section className="settle-card-2 rounded-[1.35rem] border border-[#d7ccb9] bg-[#fbf8f1]/90 p-6 shadow-[0_18px_50px_-38px_rgba(71,52,26,0.55)] sm:p-8">
            <div className="flex items-center gap-2 text-[#8b642f]">
              <BookOpen className="h-4 w-4" strokeWidth={1.6} />
              <h3 className="text-xs font-semibold tracking-[0.18em]">本章回声</h3>
            </div>
            <p className="mt-4 border-l-2 border-[#c6ad7d] pl-4 font-serif text-[15px] leading-8 text-[#514a40] sm:text-base">
              {summary || "这一章的故事，在此留下了句点。"}
            </p>
          </section>

          {(leaving.length > 0 || entering.length > 0) && (
            <section className="settle-card-3 rounded-[1.35rem] border border-[#d7ccb9] bg-[#f8f3e9]/80 p-6">
              <div className="flex items-center gap-2 text-[#75644e]">
                <Users className="h-4 w-4" strokeWidth={1.6} />
                <h3 className="text-xs font-semibold tracking-[0.18em]">人物来去</h3>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {leaving.map((characterId: string) => {
                  const character = framework.characters.find((item) => item.id === characterId);
                  if (!character) return null;
                  return (
                    <div key={characterId} className="rounded-xl border border-[#ddd3c2] bg-white/55 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-serif text-sm font-semibold text-[#514a40]">{character.name}</span>
                        <span className="rounded-full bg-[#e9e1d5] px-2 py-0.5 text-[10px] text-[#796f62]">暂别</span>
                      </div>
                      <p className="mt-1 text-xs text-[#8a8073]">{character.role}</p>
                    </div>
                  );
                })}
                {entering.map((character: any) => (
                  <div key={character.id} className="rounded-xl border border-[#d7c59d] bg-[#fffaf0] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-serif text-sm font-semibold text-[#4d4438]">{character.name}</span>
                      <span className="rounded-full bg-[#eadcbc] px-2 py-0.5 text-[10px] text-[#7d5d2d]">初遇</span>
                    </div>
                    <p className="mt-1 text-xs text-[#8a7454]">{character.role}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="settle-card-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.35rem] border border-[#d7ccb9] bg-[#f8f3e9]/80 p-6">
              <div className="flex items-center gap-2 text-[#75644e]">
                <Compass className="h-4 w-4" strokeWidth={1.6} />
                <h3 className="text-xs font-semibold tracking-[0.18em]">故事将去往</h3>
              </div>
              {isGeneratingNextChapter ? (
                <div className="mt-5 space-y-2" aria-label="正在准备下一处场景">
                  <div className="h-2.5 w-3/4 animate-pulse rounded-full bg-[#ddd3c2]" />
                  <div className="h-2.5 w-1/2 animate-pulse rounded-full bg-[#e6ddcf]" />
                </div>
              ) : (
                <div className="mt-4">
                  <p className="font-serif text-sm font-semibold text-[#4d463d]">
                    {nextChapterData?.newScene?.title || framework.scenes[0]?.title || "故事仍在原处延续"}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-[#82786b]">
                    {nextChapterData?.newScene?.summary || "未尽的情节会在下一章继续生长。"}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-[1.35rem] border border-[#d7ccb9] bg-[#f8f3e9]/80 p-6">
              <div className="flex items-center gap-2 text-[#75644e]">
                <PackageOpen className="h-4 w-4" strokeWidth={1.6} />
                <h3 className="text-xs font-semibold tracking-[0.18em]">带往下一页</h3>
              </div>
              {isGeneratingNextChapter ? (
                <div className="mt-5 space-y-2" aria-label="正在整理下一章线索">
                  <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-[#ddd3c2]" />
                  <div className="h-2.5 w-1/2 animate-pulse rounded-full bg-[#e6ddcf]" />
                </div>
              ) : nextChapterData?.newItems?.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {nextChapterData.newItems.map((item: any) => (
                    <li key={item.id} className="text-xs leading-6 text-[#766c5e]">
                      <span className="font-serif font-semibold text-[#4d463d]">{item.name}</span>
                      <span className="mx-2 text-[#b6a58a]">·</span>
                      {item.description}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-xs leading-6 text-[#82786b]">已有的线索与选择会继续同行。</p>
              )}
            </div>
          </section>

          {(nextChapterData?.openingNarrative || isGeneratingNextChapter) && (
            <section className="settle-card-5 rounded-[1.35rem] border border-[#d7ccb9] bg-[#f4ecdc]/75 p-6">
              <p className="text-xs font-semibold tracking-[0.18em] text-[#8b642f]">下一页，一线微光</p>
              {isGeneratingNextChapter && !nextChapterData?.openingNarrative ? (
                <div className="mt-4 space-y-2">
                  <div className="h-2.5 animate-pulse rounded-full bg-[#ddd3c2]" />
                  <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-[#e2d8c8]" />
                </div>
              ) : (
                <p className="mt-4 font-serif text-sm leading-7 text-[#655b4e]">
                  {nextChapterData?.openingNarrative?.split("\n\n")[0] || ""}
                </p>
              )}
            </section>
          )}
        </main>

        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-[#d9cfbd] bg-[#eee7d9]/95 px-5 py-4 backdrop-blur-md">
          <div className="mx-auto flex max-w-3xl flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onBackToBookshelf}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-[#766c5e] transition-colors hover:bg-white/50 hover:text-[#342f28] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9a6f36]"
            >
              <Library className="h-4 w-4" />
              先回书架
            </button>
            <button
              type="button"
              onClick={onContinue}
              disabled={isGeneratingNextChapter}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#27231e] px-7 text-sm font-semibold text-[#fffaf0] shadow-[0_12px_28px_-16px_rgba(39,35,30,0.9)] transition hover:bg-[#3a342c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9a6f36] focus-visible:ring-offset-2 disabled:cursor-wait disabled:bg-[#b8ac9a]"
            >
              {isGeneratingNextChapter ? "正在铺开下一页…" : `翻开第 ${chapterNumber + 1} 章`}
              {!isGeneratingNextChapter && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
