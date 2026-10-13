"use client";

import { motion } from "framer-motion";
import { CornerDownLeft, Loader2, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatLatency } from "@/lib/format";

const SAMPLES = [
  "Explain quantum entanglement to a 10-year-old.",
  "Design a rate-limiter for a billion-user API — architecture + tradeoffs.",
  "Write a haiku about distributed consensus, then explain Raft in 4 bullets.",
  "What questions should I ask before investing in an AI startup?",
  "Compare vector databases vs. knowledge graphs for LLM memory.",
];

export default function QueryConsole({
  busy,
  elapsedMs,
  onSubmit,
}: {
  busy: boolean;
  elapsedMs: number;
  onSubmit: (query: string) => void;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  const submit = () => {
    const q = value.trim();
    if (!q || busy) return;
    onSubmit(q);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="w-full"
    >
      <div className="glass relative rounded-2xl p-2 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
        <div className="pointer-events-none absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          rows={3}
          spellCheck={false}
          placeholder="Pose one question to every armed model at once…"
          className="min-h-[84px] w-full resize-none bg-transparent px-4 pb-2 pt-3 text-[15.5px] leading-relaxed text-slate-100 placeholder:text-slate-600 focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.06] px-3 pb-1.5 pt-2.5">
          <span className="font-mono2 hidden items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-500 sm:flex">
            <CornerDownLeft size={12} className="text-slate-600" />
            ⌘ / Ctrl + Enter to dispatch
          </span>
          {busy && (
            <span className="font-mono2 text-[10px] uppercase tracking-[0.2em] text-cyan-300">
              T+{formatLatency(elapsedMs)}
            </span>
          )}
          <span className="font-mono2 ml-auto text-[10px] text-slate-600">
            {value.length}/8000
          </span>
          <motion.button
            onClick={submit}
            disabled={busy || !value.trim()}
            whileTap={{ scale: 0.96 }}
            className="group relative overflow-hidden rounded-xl px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.22em] text-[#03222b] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: "linear-gradient(100deg,#67e8f9,#22d3ee 45%,#a78bfa)",
            }}
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            <span className="relative flex items-center gap-2">
              {busy ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Orchestrating
                </>
              ) : (
                <>
                  <Zap size={14} />
                  Orchestrate
                </>
              )}
            </span>
          </motion.button>
        </div>
      </div>

      {/* sample prompts */}
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <span className="font-mono2 text-[9.5px] uppercase tracking-[0.26em] text-slate-600">
          Try —
        </span>
        {SAMPLES.slice(0, 3).map((s) => (
          <button
            key={s}
            onClick={() => setValue(s)}
            className="max-w-full truncate rounded-full border border-white/[0.08] bg-white/[0.025] px-3.5 py-1.5 text-[11.5px] text-slate-400 transition-all hover:border-cyan-300/30 hover:text-cyan-200 sm:max-w-[280px]"
          >
            {s}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
