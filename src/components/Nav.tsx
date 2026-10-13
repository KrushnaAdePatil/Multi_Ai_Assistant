"use client";

import { BarChart3, History, Orbit, SlidersHorizontal } from "lucide-react";

export default function Nav({
  armed,
  total,
  runCount,
  onHistory,
  onMetrics,
  onSettings,
}: {
  armed: number;
  total: number;
  runCount: number;
  onHistory: () => void;
  onMetrics: () => void;
  onSettings: () => void;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/[0.06] bg-[#05060a]/72 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-5 sm:px-8">
        <a href="#top" className="group flex items-center gap-3">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-400/10 text-cyan-300 shadow-[0_0_18px_-4px_rgba(34,211,238,0.6)]">
            <Orbit size={18} strokeWidth={1.7} className="transition-transform duration-700 group-hover:rotate-180" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-[0.32em] text-white">
              ORCHESTRA
            </span>
            <span className="font-mono2 mt-1 text-[9px] uppercase tracking-[0.24em] text-slate-500">
              multi-AI orchestration engine
            </span>
          </span>
        </a>

        <div className="mx-auto hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 sm:flex">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="font-mono2 text-[10.5px] uppercase tracking-[0.22em] text-slate-300">
            {armed}<span className="text-slate-600">/{total}</span> agents armed
          </span>
        </div>

        <nav className="flex items-center gap-1.5">
          <button
            onClick={onHistory}
            className="font-mono2 flex items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-slate-400 transition-colors hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
          >
            <History size={14} />
            <span className="hidden md:inline">History</span>
            {runCount > 0 && (
              <span className="rounded-full bg-cyan-400/15 px-1.5 text-[10px] text-cyan-300">
                {runCount}
              </span>
            )}
          </button>
          <button
            onClick={onMetrics}
            className="font-mono2 flex items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-slate-400 transition-colors hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
          >
            <BarChart3 size={14} />
            <span className="hidden md:inline">Telemetry</span>
          </button>
          <button
            onClick={onSettings}
            className="font-mono2 ml-1 flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.05] px-3.5 py-2 text-[11px] uppercase tracking-[0.18em] text-white transition-all hover:border-cyan-300/40 hover:bg-cyan-400/10"
          >
            <SlidersHorizontal size={14} className="text-cyan-300" />
            Settings
          </button>
        </nav>
      </div>
    </header>
  );
}
