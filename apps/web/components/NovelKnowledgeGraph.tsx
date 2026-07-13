"use client";

import { Network } from "lucide-react";
import type { StoryRuntimeSnapshot } from "../lib/import-novel/types";
import NovelCharacterPortrait from "./NovelCharacterPortrait";

export default function NovelKnowledgeGraph({ graph, location }: { graph: StoryRuntimeSnapshot["graph"] | undefined; location: string }) {
  const characters = (graph?.nodes || []).filter((node) => node.type === "character").slice(0, 5);
  const locationNode = (graph?.nodes || []).find((node) => node.type === "location");
  if (!graph?.nodes.length) return <div className="mt-7 rounded-3xl border border-dashed border-[#d8d0c2] px-6 py-14 text-center text-[#8e8170]"><span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-white/60"><Network className="h-5 w-5" /></span><p className="mt-4 font-serif text-sm font-semibold text-[#554c41]">当前还没有图谱事实</p><p className="mx-auto mt-2 max-w-64 text-[9px] leading-5">完成 AI 回合后，带原文来源的节点和关系会保存在本地故事快照中。</p></div>;

  const positions = ["left-5 top-7", "right-5 top-7", "left-5 bottom-7", "right-5 bottom-7", "left-1/2 bottom-4 -translate-x-1/2"];
  return <div className="mt-6"><div className="relative min-h-[360px] overflow-hidden rounded-3xl border border-[#ddd4c6] bg-white/35 p-5"><div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#bfae94] bg-[#f3eadb] px-4 py-3 text-center shadow-sm"><p className="max-w-28 truncate font-serif text-xs font-semibold">{locationNode?.label || location || "当前场景"}</p><p className="mt-1 text-[8px] text-[#9a8f80]">地点</p></div>{characters.map((node, index) => <div key={node.id} className={`absolute z-10 flex items-center gap-2 rounded-full border border-[#d8d0c2] bg-[#fbf7ef] py-1.5 pl-1.5 pr-3 shadow-sm ${positions[index]}`}><NovelCharacterPortrait character={{ name: node.label }} small /><div><p className="max-w-20 truncate font-serif text-[11px] font-semibold">{node.label}</p><p className="text-[7px] text-[#aaa092]">{node.sourceParagraphIds.length} 个来源</p></div></div>)}<svg className="pointer-events-none absolute inset-0 h-full w-full text-[#c8baa5]" aria-hidden="true">{characters.slice(0, 4).map((node, index) => { const ends = [[18,18],[82,18],[18,82],[82,82]][index]; return <line key={node.id} x1="50%" y1="50%" x2={`${ends![0]}%`} y2={`${ends![1]}%`} stroke="currentColor" strokeDasharray="4 5" />; })}</svg></div><p className="mt-3 text-center text-[8px] text-[#aaa092]">{graph.edges.length} 条关系 · 数据保存在本地阅读会话</p></div>;
}
