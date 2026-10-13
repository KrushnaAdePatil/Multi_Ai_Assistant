"use client";

import { motion } from "framer-motion";
import { Copy, Crown, Sigma, Timer, Hash, Coins, Users, Gauge, Info, ShieldAlert } from "lucide-react";
import { useState } from "react";
import Markdown from "@/components/Markdown";
import type { LiveRun } from "@/lib/client/api";
import { formatCost, formatLatency, formatTokens } from "@/lib/format";

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
      <span className="font-mono2 flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.22em] text-slate-500">
        {icon}
        {label}
      </span>
      <span className={`font-mono2 text-[15px] font-medium ${tone ?? "text-slate-100"}`}>
        {value}
      </span>
    </div>
  );
}

export default function SynthesisPanel({ run }: { run: LiveRun }) {
  const [copied, setCopied] = useState(false);
  const synthesizing = run.phase === "synthesizing";
  const synthesis = run.synthesis;
  const totals = run.totals;
  const succeeded = run.agents.filter((a) => a.status === "success");

  const copyVerdict = async () => {
    if (!synthesis?.content) return;
    try {
      await navigator.clipboard.writeText(synthesis.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  const maxTokens = Math.max(
    1,
    ...succeeded.map((a) => a.result?.usage.totalTokens ?? 0),
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 34 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="verdict-frame mt-10"
    >
      <div className="glass-deep relative overflow-hidden rounded-[23px]">
        {/* scan sweep while synthesizing */}
        {synthesizing && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 overflow-hidden">
            <div
              className="h-24 w-full bg-gradient-to-b from-transparent via-cyan-300/10 to-transparent"
              style={{ animation: "scan 2.4s linear infinite" }}
            />
          </div>
        )}

        {/* header */}
        <header className="flex flex-wrap items-center gap-4 border-b border-white/[0.07] px-6 py-5 sm:px-8">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/40 bg-cyan-400/10 text-cyan-200 shadow-[0_0_26px_-6px_rgba(34,211,238,0.8)]">
            <Sigma size={20} strokeWidth={1.7} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="flex flex-wrap items-center gap-3 text-lg font-semibold tracking-[0.14em] text-white">
              THE VERDICT
              <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-0.5 font-mono2 text-[9.5px] uppercase tracking-[0.2em] text-cyan-200">
                synthesized
              </span>
            </h2>
            <p className="font-mono2 mt-0.5 text-[10.5px] uppercase tracking-[0.18em] text-slate-500">
              {synthesizing
                ? `fusing ${run.synthMeta?.basedOn.length ?? succeeded.length} answers via ${run.synthMeta?.agentName ?? "synthesizer"}…`
                : synthesis
                  ? `arbitrated by ${synthesis.agentName} · from ${run.synthMeta?.basedOn.length ?? succeeded.length} model${(run.synthMeta?.basedOn.length ?? succeeded.length) === 1 ? "" : "s"}`
                  : "standing by for the ensemble"}
            </p>
          </div>
          {synthesis && (
            <button
              onClick={copyVerdict}
              className="font-mono2 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[10.5px] uppercase tracking-[0.18em] text-slate-300 transition-all hover:border-cyan-300/40 hover:text-cyan-200"
            >
              <Copy size={13} />
              {copied ? "Copied" : "Copy"}
            </button>
          )}
        </header>

        {/* body */}
        <div className="px-6 py-6 sm:px-8">
          {run.phase === "failed" && !synthesis ? (
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-400/[0.05] px-6 py-7">
              <ShieldAlert size={22} className="text-rose-400" />
              <h3 className="text-[16px] font-semibold text-white">
                No verdict reached
              </h3>
              <p className="max-w-xl text-[13.5px] leading-relaxed text-slate-400">
                Every agent failed simultaneously. This is almost always missing
                or invalid API keys — open{" "}
                <span className="font-mono2 text-cyan-300">Settings</span>, arm
                your models with valid credentials, and dispatch the query
                again. The ensemble tolerates individual failures, but it needs
                at least one voice to arbitrate from.
              </p>
            </div>
          ) : synthesis ? (
            <>
              {synthesis.fallback && (
                <p className="font-mono2 mb-4 inline-flex items-center gap-2 rounded-lg border border-amber-300/25 bg-amber-300/[0.06] px-3 py-2 text-[10.5px] uppercase tracking-[0.16em] text-amber-200/90">
                  <Info size={12} />
                  direct relay — strongest single answer shown
                </p>
              )}
              <div className="text-[15px]">
                <Markdown content={synthesis.content} />
              </div>
            </>
          ) : (
            <div className="space-y-3 py-2">
              <p className="font-mono2 mb-4 text-[11px] uppercase tracking-[0.26em] text-cyan-300/80">
                {run.phase === "fanout"
                  ? "awaiting the ensemble…"
                  : "arbitrating across answers…"}
              </p>
              <div className="skel h-3.5 w-[97%]" />
              <div className="skel h-3.5 w-[91%]" />
              <div className="skel h-3.5 w-[94%]" />
              <div className="skel h-3.5 w-[84%]" />
              <div className="skel h-3.5 w-[55%]" />
            </div>
          )}
        </div>

        {/* metrics footer */}
        <footer className="border-t border-white/[0.07] px-6 py-5 sm:px-8">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            <Stat
              icon={<Timer size={11} />}
              label="Total time"
              value={
                totals
                  ? formatLatency(totals.latencyMs)
                  : formatLatency(Date.now() - run.startedAt)
              }
              tone="text-cyan-200"
            />
            <Stat
              icon={<Hash size={11} />}
              label="Tokens burned"
              value={
                totals
                  ? formatTokens(totals.totalTokens)
                  : formatTokens(
                      run.agents.reduce(
                        (s, a) => s + (a.result?.usage.totalTokens ?? 0),
                        0,
                      ),
                    )
              }
            />
            <Stat
              icon={<Coins size={11} />}
              label="Total cost"
              value={
                totals
                  ? formatCost(totals.costUsd)
                  : formatCost(
                      run.agents.reduce((s, a) => s + (a.result?.costUsd ?? 0), 0),
                    )
              }
              tone="text-emerald-300"
            />
            <Stat
              icon={<Users size={11} />}
              label="Agents used"
              value={`${totals?.succeeded ?? succeeded.length}/${totals?.attempted ?? run.agents.length}`}
            />
            <Stat
              icon={<Crown size={11} />}
              label="Arbiter"
              value={synthesis?.agentName ?? run.synthMeta?.agentName ?? "—"}
              tone="text-violet-300"
            />
          </div>

          {/* per-model token bars */}
          {succeeded.length > 0 && (
            <div className="mt-5">
              <p className="font-mono2 mb-2.5 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.24em] text-slate-500">
                <Gauge size={11} />
                tokens per model
              </p>
              <div className="space-y-1.5">
                {[...succeeded]
                  .sort(
                    (a, b) =>
                      (b.result?.usage.totalTokens ?? 0) -
                      (a.result?.usage.totalTokens ?? 0),
                  )
                  .map((a) => {
                    const t = a.result?.usage.totalTokens ?? 0;
                    return (
                      <div key={a.slot.id} className="flex items-center gap-3">
                        <span className="font-mono2 w-24 shrink-0 truncate text-right text-[10px] uppercase tracking-wider text-slate-400">
                          {a.slot.displayName}
                        </span>
                        <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(3, (t / maxTokens) * 100)}%` }}
                            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                            className="h-full rounded-full"
                            style={{
                              background: `linear-gradient(90deg, ${a.slot.accent}55, ${a.slot.accent})`,
                              boxShadow: `0 0 12px ${a.slot.accent}66`,
                            }}
                          />
                        </div>
                        <span className="font-mono2 w-12 shrink-0 text-[10.5px] text-slate-400">
                          {formatTokens(t)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </footer>
      </div>
    </motion.section>
  );
}
