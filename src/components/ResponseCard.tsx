"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Coins,
  Hash,
} from "lucide-react";
import { useState } from "react";
import AgentGlyph from "@/components/AgentGlyph";
import Markdown from "@/components/Markdown";
import type { AgentLive } from "@/lib/client/api";
import { formatCost, formatLatency, formatTokens } from "@/lib/format";

function Chip({
  icon,
  children,
  tone = "text-slate-400",
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span
      className={`font-mono2 inline-flex items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[10.5px] ${tone}`}
    >
      {icon}
      {children}
    </span>
  );
}

export default function ResponseCard({
  agent,
  index,
  elapsedMs,
}: {
  agent: AgentLive;
  index: number;
  elapsedMs: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const { slot, status, result } = agent;
  const failed = status === "error";
  const long = (result?.content.length ?? 0) > 900;

  return (
    <motion.article
      initial={{ opacity: 0, y: 26, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.06 * index, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className={`glass group relative flex flex-col overflow-hidden rounded-2xl ${
        failed ? "opacity-90" : ""
      }`}
      style={{
        boxShadow:
          status === "success"
            ? `0 0 0 1px ${slot.accent}14, 0 24px 60px -30px ${slot.accent}30`
            : undefined,
      }}
    >
      {/* accent edge */}
      <div
        className="absolute inset-y-0 left-0 w-[2.5px]"
        style={{
          background: failed
            ? "linear-gradient(#fb7185,#fb718500)"
            : `linear-gradient(${slot.accent}, ${slot.accent}00)`,
          opacity: status === "pending" ? 0.4 : 1,
        }}
      />

      {/* header */}
      <header className="flex items-center gap-3 px-5 pb-3 pt-4">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
            status === "pending" ? "pulse-ring" : ""
          }`}
          style={{
            borderColor: failed ? "rgba(251,113,133,0.35)" : `${slot.accent}45`,
            background: failed ? "rgba(251,113,133,0.06)" : `${slot.accent}12`,
            color: failed ? "#fb7185" : slot.accent,
          }}
        >
          <AgentGlyph glyph={slot.glyph} size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14.5px] font-semibold tracking-wide text-white">
            {slot.displayName}
          </h3>
          <p className="font-mono2 truncate text-[10px] uppercase tracking-[0.16em] text-slate-500">
            {slot.model}
          </p>
        </div>
        {status === "pending" && (
          <span className="font-mono2 blink flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-cyan-300">
            reasoning… {formatLatency(elapsedMs)}
          </span>
        )}
        {status === "success" && (
          <CheckCircle2 size={16} style={{ color: slot.accent }} />
        )}
        {failed && <AlertTriangle size={16} className="text-rose-400" />}
      </header>

      {/* body */}
      <div className="flex-1 px-5 pb-3">
        {status === "pending" ? (
          <div className="space-y-2.5 py-1">
            <div className="skel h-3 w-[96%]" />
            <div className="skel h-3 w-[88%]" />
            <div className="skel h-3 w-[92%]" />
            <div className="skel h-3 w-[70%]" />
            <div className="skel h-3 w-[60%]" />
          </div>
        ) : failed ? (
          <div className="rounded-xl border border-rose-400/15 bg-rose-400/[0.045] px-4 py-3.5">
            <p className="font-mono2 text-[12px] leading-relaxed text-rose-300">
              {result?.error ?? "Unknown failure"}
            </p>
            <p className="font-mono2 mt-2 text-[10px] uppercase tracking-[0.18em] text-rose-400/60">
              graceful failure — ensemble continues
            </p>
          </div>
        ) : (
          <div
            className={`relative ${!expanded && long ? "max-h-[300px] overflow-hidden" : ""}`}
          >
            <Markdown content={result?.content ?? ""} />
            {!expanded && long && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0a0c13] to-transparent" />
            )}
          </div>
        )}
      </div>

      {/* footer */}
      <footer className="mt-auto border-t border-white/[0.06] px-5 py-3">
        {status === "success" && result ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip icon={<Clock3 size={11} />} tone="text-cyan-200/90">
              {formatLatency(result.latencyMs)}
            </Chip>
            <Chip icon={<Hash size={11} />}>
              {formatTokens(result.usage.promptTokens)}↑ ·{" "}
              {formatTokens(result.usage.completionTokens)}↓ tok
            </Chip>
            <Chip icon={<Coins size={11} />} tone="text-emerald-300/90">
              {formatCost(result.costUsd)}
            </Chip>
            {long && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="font-mono2 ml-auto inline-flex items-center gap-1 text-[10.5px] uppercase tracking-[0.16em] text-slate-400 transition-colors hover:text-white"
              >
                {expanded ? "Collapse" : "Expand"}
                <ChevronDown
                  size={12}
                  className={`transition-transform ${expanded ? "rotate-180" : ""}`}
                />
              </button>
            )}
          </div>
        ) : status === "pending" ? (
          <div className="flex gap-1.5">
            <div className="skel h-[22px] w-16" />
            <div className="skel h-[22px] w-24" />
            <div className="skel h-[22px] w-14" />
          </div>
        ) : (
          <span className="font-mono2 text-[10px] uppercase tracking-[0.2em] text-slate-600">
            no contribution to the verdict
          </span>
        )}
      </footer>
    </motion.article>
  );
}
