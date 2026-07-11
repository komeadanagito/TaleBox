"use client";

import { ArrowLeft, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";

export default function NovelImportHeader({ backHref = "/", action }: { backHref?: string; action?: string }) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-zinc-100/80 bg-white/90 px-5 backdrop-blur-xl sm:px-8">
      <button onClick={() => router.push(backHref)} className="group flex items-center gap-3 text-left">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-zinc-950 font-serif text-sm font-bold text-white shadow-sm">T</span>
        <span>
          <span className="block font-serif text-sm font-semibold tracking-tight text-zinc-950">TaleBox</span>
          <span className="block text-[9px] uppercase tracking-[.18em] text-zinc-400">Novel Editions</span>
        </span>
      </button>
      <div className="flex items-center gap-3">
        {action && <span className="hidden text-[11px] text-zinc-400 sm:block">{action}</span>}
        <button onClick={() => router.push(backHref)} className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-2 text-[11px] font-medium text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-950">
          <ArrowLeft className="h-3.5 w-3.5" /> 返回
        </button>
        <button onClick={() => router.push("/bookshelf")} aria-label="打开书架" className="grid h-8 w-8 place-items-center rounded-full bg-zinc-950 text-white transition hover:bg-zinc-700">
          <BookOpen className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}

