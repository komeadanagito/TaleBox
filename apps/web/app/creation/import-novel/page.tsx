"use client";

import { DragEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, FileText, Loader2, RotateCcw, Upload } from "lucide-react";
import NovelImportHeader from "../../../components/NovelImportHeader";
import { parseNovelFile } from "../../../lib/import-novel/parser";
import { saveImportedNovel } from "../../../lib/import-novel/store";
import type { ImportedNovel } from "../../../lib/import-novel/types";

export default function ImportNovelPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [novel, setNovel] = useState<ImportedNovel | null>(null);
  const [selectedChapter, setSelectedChapter] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError("");
    setIsParsing(true);
    try {
      setNovel(await parseNovelFile(file));
      setSelectedChapter(0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "文件解析失败");
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    void handleFile(event.dataTransfer.files[0]);
  };

  const confirmImport = async () => {
    if (!novel || isSaving) return;
    setIsSaving(true);
    setError("");
    try {
      await saveImportedNovel(novel);
      router.push(`/story/${novel.id}/chapter/1/setup`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存小说失败");
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#fbfbfa] text-zinc-950">
      <NovelImportHeader action="导入小说 · 步骤 1 / 3" />
      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden px-5 py-6 sm:px-8 sm:py-8">
        <div className="mb-6 max-w-2xl flex-none sm:mb-8">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.24em] text-zinc-400">Import a novel</p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">把熟悉的故事，重新走一遍。</h1>
          <p className="mt-4 text-sm leading-7 text-zinc-500">上传 TXT 或 EPUB 文件，确认章节目录后，即可选择故事中的角色重新走进这一章。</p>
        </div>

        {error && <div className="mb-4 flex-none rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>}

        {!novel ? (
          <button onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop} className="group flex min-h-0 w-full flex-1 flex-col items-center justify-center rounded-[28px] border border-dashed border-zinc-300 bg-white px-8 text-center shadow-[0_20px_70px_rgba(0,0,0,.035)] transition hover:border-zinc-500">
            <input ref={inputRef} type="file" accept=".txt,.epub,text/plain,application/epub+zip" className="hidden" onChange={(event) => void handleFile(event.target.files?.[0])} />
            <span className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-zinc-950 text-white shadow-lg shadow-zinc-200 transition group-hover:-translate-y-1">{isParsing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}</span>
            <span className="font-serif text-xl font-semibold">{isParsing ? "正在识别小说结构…" : "选择或拖入 TXT / EPUB 小说"}</span>
            <span className="mt-3 max-w-sm text-xs leading-6 text-zinc-400">TXT 支持 UTF-8 与 GB18030，EPUB 自动读取书名、作者及章节顺序。小说原文保存在当前浏览器中。</span>
            <span className="mt-8 rounded-full bg-zinc-100 px-4 py-2 text-[11px] font-medium text-zinc-600">选择文件</span>
          </button>
        ) : (
          <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-1 lg:gap-6">
            <section className="flex min-h-0 flex-col rounded-[24px] border border-zinc-200/80 bg-white p-5 shadow-[0_18px_55px_rgba(0,0,0,.035)] lg:h-full">
              <div className="flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-zinc-100 text-zinc-700"><FileText className="h-5 w-5" /></span><span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700"><Check className="h-3 w-3" /> 识别完成</span></div>
              <h2 className="mt-5 break-words font-serif text-2xl font-semibold lg:mt-7">{novel.title}</h2>
              <p className="mt-1 break-all text-xs text-zinc-400">{novel.fileName} · {novel.fileType.toUpperCase()} · {novel.author}</p>
              <dl className="mt-5 grid grid-cols-2 gap-3 border-y border-zinc-100 py-4 text-center lg:mt-7"><div><dt className="text-[10px] text-zinc-400">识别章节</dt><dd className="mt-1 font-serif text-xl">{novel.chapters.length}</dd></div><div><dt className="text-[10px] text-zinc-400">全书字数</dt><dd className="mt-1 font-serif text-xl">{novel.wordCount > 9999 ? `${(novel.wordCount / 10000).toFixed(1)}万` : novel.wordCount.toLocaleString()}</dd></div></dl>
              <button onClick={() => { setNovel(null); setError(""); }} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs text-zinc-400 transition hover:bg-zinc-50 hover:text-zinc-800"><RotateCcw className="h-3.5 w-3.5" /> 重新选择</button>
            </section>

            <section className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-zinc-200/80 bg-white shadow-[0_18px_55px_rgba(0,0,0,.035)]">
              <div className="flex flex-none items-center justify-between border-b border-zinc-100 px-6 py-4"><div><h2 className="font-serif text-lg font-semibold">确认章节目录</h2><p className="mt-1 text-[11px] text-zinc-400">点击章节查看原文开头</p></div><span className="text-[10px] text-zinc-400">本地规则识别</span></div>
              <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden sm:grid-cols-[minmax(220px,40%)_1fr]">
                <div className="min-h-0 overflow-y-auto overscroll-contain border-r border-zinc-100 p-3">
                  {novel.chapters.map((chapter, index) => <button key={chapter.id} onClick={() => setSelectedChapter(index)} className={`flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-left transition ${selectedChapter === index ? "bg-zinc-950 text-white" : "hover:bg-zinc-50"}`}><span className={`text-[10px] font-medium ${selectedChapter === index ? "text-zinc-400" : "text-zinc-300"}`}>{String(chapter.number).padStart(2, "0")}</span><span className="min-w-0 flex-1 truncate font-serif text-sm font-medium">{chapter.title}</span><span className="text-[10px] text-zinc-400">{chapter.wordCount.toLocaleString()}</span></button>)}
                </div>
                <div className="hidden min-h-0 overflow-y-auto overscroll-contain p-6 sm:block"><p className="text-[10px] uppercase tracking-[.18em] text-zinc-400">正文预览</p><h3 className="mt-3 font-serif text-lg font-semibold">{novel.chapters[selectedChapter]?.title}</h3><p className="mt-5 whitespace-pre-line font-serif text-xs leading-7 text-zinc-500">{novel.chapters[selectedChapter]?.content.slice(0, 3000)}{(novel.chapters[selectedChapter]?.content.length || 0) > 3000 ? "…" : ""}</p></div>
              </div>
              <div className="flex flex-none flex-col gap-3 border-t border-zinc-100 bg-zinc-50/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-[11px] leading-5 text-zinc-400">确认后保存原文，并开始解析第一章。</p><button onClick={() => void confirmImport()} disabled={isSaving} className="flex items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 py-3 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50">{isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{isSaving ? "正在保存" : "确认并解析第一章"}<ArrowRight className="h-3.5 w-3.5" /></button></div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
