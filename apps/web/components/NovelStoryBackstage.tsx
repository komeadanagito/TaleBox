"use client";

import { useEffect, useState } from "react";
import { Brain, ChevronRight, Map, Network, Sparkles, UserRound, X } from "lucide-react";
import type { AiNarrativeMode, ChapterSession } from "../lib/import-novel/types";
import type { SelectableCharacter } from "../lib/import-novel/roles";
import NovelCharacterPortrait from "./NovelCharacterPortrait";
import NovelKnowledgeGraph from "./NovelKnowledgeGraph";

type PanelTab = "agent" | "memory" | "state" | "graph";

interface NovelStoryBackstageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: SelectableCharacter;
  session: ChapterSession;
  chapterTitle: string;
  location: string;
  narrativeMode: AiNarrativeMode;
}

const tabs = [
  { id: "agent", label: "角色 Agent", icon: UserRound },
  { id: "memory", label: "记忆", icon: Brain },
  { id: "state", label: "故事状态", icon: Map },
  { id: "graph", label: "知识图谱", icon: Network },
] as const;

export default function NovelStoryBackstage({ open, onOpenChange, role, session, chapterTitle, location, narrativeMode }: NovelStoryBackstageProps) {
  const [tab, setTab] = useState<PanelTab>("agent");
  const runtime = session.storyRuntime;
  const memories = (runtime?.memories || []).slice(-8).reverse();
  const runtimeLocation = runtime?.state.location || location;
  const recentChoice = runtime?.agent.activeGoal;

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onOpenChange(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, onOpenChange]);

  return (
    <>
      <button type="button" onClick={() => onOpenChange(true)} className="fixed right-0 top-1/2 z-40 hidden -translate-y-1/2 rounded-l-2xl border border-r-0 border-[#d4cabb] bg-[#f8f3e9]/95 px-2.5 py-4 text-[#6f6251] shadow-[0_12px_40px_rgba(73,58,38,.13)] backdrop-blur transition hover:bg-white md:block" aria-label="打开故事幕后">
        <Sparkles className="mx-auto h-4 w-4" /><span className="mt-2 block [writing-mode:vertical-rl] text-[9px] tracking-[.18em]">故事幕后</span>
      </button>
      <button type="button" onClick={() => onOpenChange(true)} className="fixed bottom-16 right-4 z-40 grid h-11 w-11 place-items-center rounded-full border border-[#d4cabb] bg-[#f8f3e9]/95 text-[#6f6251] shadow-lg backdrop-blur md:hidden" aria-label="打开故事幕后"><Sparkles className="h-4 w-4" /></button>

      <div className={`fixed inset-0 z-50 transition ${open ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!open}>
        <button type="button" onClick={() => onOpenChange(false)} className={`absolute inset-0 bg-[#29241e]/20 backdrop-blur-[2px] transition-opacity ${open ? "opacity-100" : "opacity-0"}`} aria-label="关闭故事幕后" />
        <aside role="dialog" aria-modal="true" aria-label="故事幕后" className={`novel-reading-paper absolute inset-y-0 right-0 flex w-full max-w-[520px] flex-col border-l border-[#d4cabb] shadow-[-24px_0_70px_rgba(73,58,38,.16)] transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}>
          <header className="flex items-center justify-between border-b border-[#ded5c7] px-6 py-5 sm:px-8">
            <div><p className="text-[9px] font-semibold uppercase tracking-[.24em] text-[#9a8f80]">Story backstage</p><h2 className="mt-1 font-serif text-xl font-semibold text-[#312d27]">故事幕后</h2></div>
            <button type="button" onClick={() => onOpenChange(false)} className="grid h-9 w-9 place-items-center rounded-full border border-[#ddd4c6] text-[#746856] hover:bg-white" aria-label="关闭"><X className="h-4 w-4" /></button>
          </header>

          <nav className="grid grid-cols-4 border-b border-[#ded5c7] px-3 sm:px-6" aria-label="幕后信息分类">
            {tabs.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex min-w-0 flex-col items-center gap-1.5 border-b-2 px-1 py-4 text-[9px] transition ${tab === item.id ? "border-[#625746] text-[#3d372f]" : "border-transparent text-[#9a8f80] hover:text-[#625746]"}`}><Icon className="h-3.5 w-3.5" /><span className="truncate">{item.label}</span></button>; })}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-7 sm:px-8">
            {tab === "agent" && <section className="novel-block-reveal">
              <div className="flex items-center gap-4"><NovelCharacterPortrait character={role} /><div><p className="font-serif text-lg font-semibold">{role.name}</p><p className="mt-1 text-[10px] text-[#9a8f80]">{role.role || "本章角色"} · {narrativeMode === "free" ? "自由探索" : "遵循原作"}</p></div><span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />运行中</span></div>
              <div className="mt-7 space-y-3"><InfoCard label="当前目标" value={recentChoice ? `延续你的选择：${recentChoice}` : "等待真实运行快照"} /><InfoCard label="行为边界" value={narrativeMode === "free" ? "遵守原作世界观与人物性格，允许改变行动和局部结果" : "人物、因果与主要剧情保持原作走向"} /><InfoCard label="决策依据" value={runtime ? `${runtime.agent.sourceParagraphIds.length} 段当前原文 · ${memories.length} 条角色记忆 · 运行状态 v${runtime.version}` : "尚未生成运行快照"} /></div>
              <p className="mt-6 text-[9px] leading-5 text-[#aaa092]">这里展示当前会话实际使用的信息边界，不展示模型隐藏推理。</p>
            </section>}

            {tab === "memory" && <section className="novel-block-reveal"><SectionTitle eyebrow="Session memory" title="你的故事记忆" description="来自回合引擎保存的真实记忆事件，越新的记忆越靠前。" />{memories.length ? <div className="mt-7 space-y-0">{memories.map((memory, index) => <div key={memory.id} className="relative border-l border-[#d8d0c2] pb-6 pl-6 last:pb-0"><span className="absolute -left-1 top-1 h-2 w-2 rounded-full bg-[#8c7c66]" /><p className="text-[9px] text-[#aaa092]">{index === 0 ? "刚刚" : `前 ${index + 1} 条记忆`} · {memory.sourceParagraphIds.length} 个原文来源</p><p className="mt-2 font-serif text-sm leading-6 text-[#454038]">{memory.kind === "decision" ? "你选择：" : "事件："}{memory.content}</p></div>)}</div> : <EmptyState icon={Brain} text="运行引擎还没有保存任何记忆。" />}</section>}

            {tab === "state" && <section className="novel-block-reveal"><SectionTitle eyebrow="Story state" title="此刻的故事" description="来自版本化 StoryRuntimeSnapshot，不由前端推测。" /><div className="mt-7 grid grid-cols-2 gap-3"><StateCard label="当前章节" value={chapterTitle} /><StateCard label="当前位置" value={runtimeLocation || "原文尚未说明"} /><StateCard label="状态版本" value={runtime ? `v${runtime.version}` : "未建立"} /><StateCard label="叙事路径" value={narrativeMode === "free" ? "自由探索" : "遵循原作"} /></div><div className="mt-5 rounded-2xl border border-[#ddd4c6] bg-white/40 p-5"><p className="text-[9px] tracking-[.12em] text-[#9a8f80]">当前在场</p><div className="mt-4 flex flex-wrap gap-3">{runtime?.state.presentCharacterNames.length ? runtime.state.presentCharacterNames.map((name) => <div key={name} className="flex items-center gap-2"><NovelCharacterPortrait character={{ name }} small /><p className="font-serif text-xs font-semibold">{name}</p></div>) : <p className="text-[10px] text-[#aaa092]">尚无已确认角色</p>}</div></div></section>}

            {tab === "graph" && <section className="novel-block-reveal"><SectionTitle eyebrow="Local knowledge graph" title="当前已知图谱" description="来自本地版本化故事快照，并保留原文段落来源。" /><NovelKnowledgeGraph graph={runtime?.graph} location={runtimeLocation} /></section>}
          </div>
        </aside>
      </div>
    </>
  );
}

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <div><p className="text-[9px] font-semibold uppercase tracking-[.2em] text-[#9a8f80]">{eyebrow}</p><h3 className="mt-2 font-serif text-xl font-semibold">{title}</h3><p className="mt-2 text-[10px] leading-5 text-[#8e8375]">{description}</p></div>; }
function InfoCard({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-[#ddd4c6] bg-white/35 p-4"><p className="text-[9px] tracking-[.1em] text-[#9a8f80]">{label}</p><p className="mt-2 font-serif text-sm leading-6 text-[#454038]">{value}</p></div>; }
function StateCard({ label, value }: { label: string; value: string }) { return <div className="min-h-28 rounded-2xl border border-[#ddd4c6] bg-white/35 p-4"><p className="text-[9px] text-[#9a8f80]">{label}</p><p className="mt-3 font-serif text-sm font-semibold leading-6 text-[#454038]">{value}</p></div>; }
function EmptyState({ icon: Icon, text }: { icon: typeof Brain; text: string }) { return <div className="mt-8 rounded-2xl border border-dashed border-[#d8d0c2] py-12 text-center text-[#9a8f80]"><Icon className="mx-auto h-5 w-5" /><p className="mx-auto mt-3 max-w-52 text-[10px] leading-5">{text}</p><ChevronRight className="mx-auto mt-3 h-3 w-3 rotate-90" /></div>; }
