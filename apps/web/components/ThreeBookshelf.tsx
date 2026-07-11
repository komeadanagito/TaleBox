"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Upload } from "lucide-react";

interface ThreeBookshelfProps {
  stories: any[];
  onSelectBook: (story: any) => void;
  onCreateNew: () => void;
  tab: "create" | "upload";
  deletingStoryId: string | null;
  onDeleteComplete: (id: string) => void;
}

const coverThemes = [
  ["#23394a", "#91b3bd", "#1d2631"],
  ["#e7c0b1", "#a65c61", "#432a38"],
  ["#7758a4", "#cfb9f0", "#2b2250"],
  ["#192d43", "#4c7895", "#101827"],
  ["#cb9b37", "#f7d475", "#9a552c"],
  ["#658a6e", "#d9c9a5", "#213d37"],
];

function hash(value: string) {
  return [...value].reduce((result, character) => ((result << 5) - result + character.charCodeAt(0)) | 0, 0);
}

function ShelfBook({ story, index, isDeleting, isDimmed, onHover, onLeave, onSelect }: any) {
  const theme = coverThemes[Math.abs(hash(story.id || String(index))) % coverThemes.length]!;
  const genre = story.selectedGenre === "自定义" ? story.customGenre : story.selectedGenre;
  const title = story.framework?.title || "未命名故事";

  return (
    <button
      type="button"
      aria-label={`打开《${title}》`}
      onMouseEnter={() => onHover(story)}
      onMouseLeave={onLeave}
      onFocus={() => onHover(story)}
      onBlur={onLeave}
      onClick={() => onSelect(story)}
      className={`relative z-20 h-[154px] w-[108px] sm:h-[186px] sm:w-[132px] flex-none cursor-pointer rounded-[2px] text-left shadow-[0_14px_15px_-12px_rgba(0,0,0,0.6)] transition-[transform,box-shadow,filter,opacity] duration-500 ease-[cubic-bezier(.2,.9,.25,1)] hover:z-30 hover:-translate-y-12 hover:scale-[1.62] hover:shadow-[0_34px_42px_-16px_rgba(0,0,0,0.5)] focus-visible:z-30 focus-visible:-translate-y-12 focus-visible:scale-[1.62] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800/50 ${isDimmed ? "scale-[.94] opacity-35 blur-[1px]" : ""} ${isDeleting ? "animate-[shelf-book-fade_1.2s_forwards] pointer-events-none" : ""}`}
      style={{
        background: `linear-gradient(145deg, ${theme[0]}, ${theme[1]} 57%, ${theme[2]})`,
      }}
    >
      <span className="pointer-events-none absolute inset-[5px] border border-white/25" />
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,rgba(255,255,255,.18),transparent_30%,rgba(0,0,0,.22))]" />
      <span className="absolute left-2 right-2 top-3 text-[7px] font-semibold uppercase tracking-[.18em] text-white/75">TaleBox</span>
      <span className="absolute left-3 right-3 top-1/2 -translate-y-1/2 font-serif text-[15px] font-bold leading-tight text-white drop-shadow-sm sm:text-[17px]">{title}</span>
      <span className="absolute bottom-3 left-3 right-3 border-t border-white/30 pt-2 text-[7px] uppercase tracking-[.12em] text-white/70">{genre || "Novel"}</span>
    </button>
  );
}

function Shelf({ children, top = false }: { children: React.ReactNode; top?: boolean }) {
  return (
    <div className={`relative flex min-h-[222px] items-end justify-center gap-3 px-5 sm:min-h-[254px] sm:gap-4 ${top ? "" : ""}`}>
      <div className="relative z-10 flex items-end justify-center gap-3 sm:gap-4">{children}</div>
      <div className="pointer-events-none absolute bottom-5 left-1 right-1 h-[11px] rounded-sm bg-gradient-to-b from-white via-zinc-100 to-zinc-300 shadow-[0_14px_16px_-7px_rgba(0,0,0,0.28),0_29px_24px_-16px_rgba(0,0,0,0.28)]" />
      <div className="pointer-events-none absolute bottom-0 left-[5%] right-[5%] h-8 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,.18),transparent_67%)] blur-md" />
    </div>
  );
}

export default function ThreeBookshelf({ stories, onSelectBook, onCreateNew, tab, deletingStoryId, onDeleteComplete }: ThreeBookshelfProps) {
  const [hoveredStory, setHoveredStory] = useState<any | null>(null);
  const visibleStories = tab === "create" ? stories : [];
  const [topShelf, bottomShelf] = useMemo(() => {
    const splitAt = Math.ceil(visibleStories.length / 2);
    return [visibleStories.slice(0, splitAt), visibleStories.slice(splitAt)];
  }, [visibleStories]);

  useEffect(() => {
    if (!deletingStoryId) return;
    const timer = window.setTimeout(() => onDeleteComplete(deletingStoryId), 1200);
    return () => window.clearTimeout(timer);
  }, [deletingStoryId, onDeleteComplete]);

  const preview = hoveredStory && (
    <div className="pointer-events-none absolute left-0 top-1/2 z-40 hidden w-40 -translate-y-1/2 text-left xl:block">
      <p className="font-serif text-xl font-semibold text-zinc-800">{hoveredStory.framework?.title || "未命名故事"}</p>
      <p className="mt-1 text-[10px] leading-relaxed text-zinc-400 line-clamp-3">{hoveredStory.framework?.worldView || "点击翻开故事，继续你的叙事旅程。"}</p>
      <span className="mt-3 inline-block rounded-full bg-zinc-900 px-3 py-1 text-[9px] font-medium text-white">打开</span>
    </div>
  );

  return (
    <section className="relative flex h-full min-h-[530px] w-full flex-col justify-center overflow-visible px-3 py-6 sm:px-8" aria-label="我的故事书架">
      <style>{`@keyframes shelf-book-fade { 30% { filter: brightness(.25) saturate(.5); transform: translateY(-10px) scale(.94); } 100% { opacity:0; transform: translateY(45px) scaleY(.1); } }`}</style>
      {preview}
      {tab === "upload" ? (
        <div className="mx-auto flex h-[300px] w-full max-w-md flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white/60 text-center">
          <Upload className="mb-3 h-5 w-5 text-zinc-400" />
          <p className="text-sm font-medium text-zinc-700">上传书架还是空的</p>
          <p className="mt-1 text-xs text-zinc-400">导入的小说会陈列在这里。</p>
        </div>
      ) : (
        <>
          <Shelf top>
            {topShelf.map((story, index) => <ShelfBook key={story.id} story={story} index={index} isDeleting={deletingStoryId === story.id} isDimmed={Boolean(hoveredStory && hoveredStory.id !== story.id)} onHover={setHoveredStory} onLeave={() => setHoveredStory(null)} onSelect={onSelectBook} />)}
            <button type="button" onClick={onCreateNew} className="relative z-10 mb-1 flex h-[118px] w-[84px] flex-none flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-zinc-300 bg-white/70 text-zinc-400 transition duration-300 hover:-translate-y-5 hover:border-zinc-500 hover:text-zinc-700" aria-label="新建小说"><Plus className="h-5 w-5" /><span className="text-[10px]">新建故事</span></button>
          </Shelf>
          <Shelf>
            {bottomShelf.map((story, index) => <ShelfBook key={story.id} story={story} index={index + topShelf.length} isDeleting={deletingStoryId === story.id} isDimmed={Boolean(hoveredStory && hoveredStory.id !== story.id)} onHover={setHoveredStory} onLeave={() => setHoveredStory(null)} onSelect={onSelectBook} />)}
            {stories.length === 0 && <p className="relative z-10 mb-14 text-xs text-zinc-400">从一部新小说开始，建立属于你的故事馆。</p>}
          </Shelf>
        </>
      )}
    </section>
  );
}
