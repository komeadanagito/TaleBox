"use client";

import type { AnimationEvent } from "react";
import { Feather } from "lucide-react";

export type PageTurnDestination = "chapter" | "story";

interface PageTurnTransitionProps {
  chapterNumber: number;
  destination: PageTurnDestination;
  onComplete: () => void;
}

export default function PageTurnTransition({
  chapterNumber,
  destination,
  onComplete,
}: PageTurnTransitionProps) {
  const isStoryEnding = destination === "story";

  const handleAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.currentTarget === event.target) {
      onComplete();
    }
  };

  return (
    <div
      className="page-turn-overlay"
      role="status"
      aria-live="polite"
      aria-label={isStoryEnding ? "故事正在落笔完结" : "正在翻向下一章"}
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="page-turn-frame" aria-hidden="true">
        <div className="page-turn-next-page">
          <div className="page-turn-reveal-mark">
            <span className="page-turn-kicker">
              {isStoryEnding ? "The End" : `Chapter ${chapterNumber}`}
            </span>
            <strong>
              {isStoryEnding ? "故事已抵达终章" : `第 ${chapterNumber} 章 · 已写成`}
            </strong>
            <span className="page-turn-subtitle">
              {isStoryEnding ? "完结" : "下一页，正在展开"}
            </span>
          </div>
        </div>

        <div className="page-turn-left-page">
          <span className="page-turn-running-title">TALEBOX · STORY EDITION</span>
          <span className="page-turn-page-number">{chapterNumber}</span>
        </div>

        <div className="page-turn-leaf">
          <div className="page-turn-leaf-front">
            <div className="page-turn-writing-lines">
              <span />
              <span />
              <span />
              <span className="page-turn-last-line" />
            </div>
            <div className="page-turn-ink-mark">
              <Feather className="h-4 w-4" strokeWidth={1.5} />
              <span />
            </div>
          </div>
          <div className="page-turn-leaf-back" />
        </div>

        <div className="page-turn-spine" />
      </div>
    </div>
  );
}
