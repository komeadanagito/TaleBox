"use client";

import { useEffect, useRef } from "react";
import { BookHeart, BookOpen, Library, Quote, Users } from "lucide-react";
import type { StoryEnding, StoryFramework } from "../app/context/StoryContext";

interface StoryEndingOverlayProps {
  framework: StoryFramework;
  ending: StoryEnding;
  completedChapterCount: number;
  onBackToBookshelf: () => void;
}

export default function StoryEndingOverlay({
  framework,
  ending,
  completedChapterCount,
  onBackToBookshelf,
}: StoryEndingOverlayProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const companions = framework.characters.filter((character) => character.id !== "char_1");
  const discoveredItems = framework.items.filter((item) => item.discovered);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div
      className="story-ending-overlay fixed inset-0 z-50 overflow-y-auto bg-[#e9e0d0] text-[#2e2922]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-ending-title"
    >
      <div className="story-ending-paper relative mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 py-8 sm:px-10 sm:py-12">
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#b99b64] to-transparent" />

        <header className="story-ending-reveal mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#b99b64]/60 bg-[#f7f0e3] text-[#8a612a] shadow-[0_12px_35px_-24px_rgba(75,48,17,0.75)]">
            <BookHeart className="h-7 w-7" strokeWidth={1.35} />
          </div>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.35em] text-[#98703a]">
            Story Complete
          </p>
          <h2
            id="story-ending-title"
            ref={headingRef}
            tabIndex={-1}
            className="mt-4 font-serif text-4xl font-semibold tracking-tight text-[#28231d] outline-none sm:text-6xl"
          >
            故事已抵达终章
          </h2>
          <div className="mt-5 flex items-center justify-center gap-4" aria-hidden="true">
            <span className="h-px w-20 bg-gradient-to-r from-transparent to-[#b99b64]" />
            <span className="rounded-full border border-[#a77b3f] px-3 py-1 font-serif text-sm tracking-[0.35em] text-[#875e28]">完结</span>
            <span className="h-px w-20 bg-gradient-to-l from-transparent to-[#b99b64]" />
          </div>
          <p className="mt-6 font-serif text-xl font-semibold text-[#494035]">《{framework.title}》</p>
          <p className="mt-2 text-sm text-[#7c7061]">{ending.title || "你的故事，已在这里圆满落笔"}</p>
        </header>

        <main className="mx-auto mt-10 w-full max-w-3xl flex-1 space-y-5 pb-8">
          <section className="story-ending-card rounded-[1.5rem] border border-[#d2c4ae] bg-[#fbf7ef]/90 p-6 shadow-[0_24px_70px_-48px_rgba(67,45,20,0.7)] sm:p-9">
            <div className="flex items-center gap-2 text-[#8a612a]">
              <Quote className="h-4 w-4" strokeWidth={1.5} />
              <h3 className="text-xs font-semibold tracking-[0.2em]">终章余韵</h3>
            </div>
            <p className="mt-5 font-serif text-base leading-8 text-[#51483c] sm:text-lg sm:leading-9">
              {ending.summary}
            </p>
          </section>

          <section className="story-ending-card grid grid-cols-3 overflow-hidden rounded-[1.25rem] border border-[#d2c4ae] bg-[#f5eee2]/85">
            <div className="flex min-h-24 flex-col items-center justify-center border-r border-[#d8ccb9] px-3 text-center">
              <BookOpen className="h-4 w-4 text-[#94703e]" strokeWidth={1.5} />
              <strong className="mt-2 font-serif text-xl text-[#40382e]">{Math.max(completedChapterCount, ending.chapterNumber)}</strong>
              <span className="mt-1 text-[10px] tracking-wider text-[#847869]">写成章节</span>
            </div>
            <div className="flex min-h-24 flex-col items-center justify-center border-r border-[#d8ccb9] px-3 text-center">
              <Users className="h-4 w-4 text-[#94703e]" strokeWidth={1.5} />
              <strong className="mt-2 font-serif text-xl text-[#40382e]">{companions.length}</strong>
              <span className="mt-1 text-[10px] tracking-wider text-[#847869]">同行人物</span>
            </div>
            <div className="flex min-h-24 flex-col items-center justify-center px-3 text-center">
              <BookHeart className="h-4 w-4 text-[#94703e]" strokeWidth={1.5} />
              <strong className="mt-2 font-serif text-xl text-[#40382e]">{discoveredItems.length}</strong>
              <span className="mt-1 text-[10px] tracking-wider text-[#847869]">留下线索</span>
            </div>
          </section>

          {companions.length > 0 && (
            <section className="story-ending-card rounded-[1.25rem] border border-[#d2c4ae] bg-[#f7f0e5]/75 p-6">
              <h3 className="text-xs font-semibold tracking-[0.2em] text-[#7b6952]">人物余响</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {companions.slice(0, 4).map((character) => (
                  <div key={character.id} className="rounded-xl border border-[#ddd2c1] bg-white/45 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-serif text-sm font-semibold text-[#4a4238]">{character.name}</span>
                      <span className="text-[10px] text-[#918676]">{character.role}</span>
                    </div>
                    {character.mood && <p className="mt-2 text-xs leading-6 text-[#7c7163]">{character.mood}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>

        <footer className="story-ending-card mx-auto flex w-full max-w-3xl flex-col items-center border-t border-[#d2c4ae] pt-6 text-center">
          <p className="font-serif text-sm text-[#756a5b]">谢谢你陪它走到最后一页。</p>
          <button
            type="button"
            onClick={onBackToBookshelf}
            className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#2d2822] px-8 text-sm font-semibold text-[#fffaf0] shadow-[0_12px_28px_-16px_rgba(45,40,34,0.9)] transition hover:bg-[#443c32] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9a6f36] focus-visible:ring-offset-2"
          >
            <Library className="h-4 w-4" />
            珍藏故事，回到书架
          </button>
        </footer>
      </div>
    </div>
  );
}
