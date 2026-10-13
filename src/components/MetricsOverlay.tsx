"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Activity, BarChart3, Coins, Hash, Timer, TrendingUp, X } from "lucide-react";
import type { MetricsData } from "@/lib/client/api";
import { formatCost, formatLatency, formatTokens } from "@/lib/format";

function BigStat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="glass relative overflow-hidden rounded-2xl p-5">
      <span className="font-mono2 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.24em] text-slate-500">
        {icon}
        {label}
      </span>
      <p className="font-mono2 mt-3 text-[26px] font-medium leading-none text-white">
        {value}
      </p>
      {sub && (
        <p className="font-mono2 mt-1.5 text-[10px] uppercase tracking-[0.16em] text-slate-500">
          {sub}
        </p>
      )}
    </div>
  );
}

export default function MetricsOverlay({
  open,
  metrics,
  loading,
  onClose,
}: {
  open: boolean;
  metrics: MetricsData | null;
  loading: boolean;
  onClose: () => void;
}) {
  const maxCalls = Math.max(1, ...(metrics?.perAgent.map((a) => a.calls) ?? [1]));
  const maxRecent = Math.max(1, ...(metrics?.recent.map((r) => r.tokens) ?? [1]));
  const overallRate =
    metrics && metrics.perAgent.length
      ? metrics.perAgent.reduce((s, a) => s + a.successRate, 0) /
        metrics.perAgent.length
      : 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
            className="glass-deep fixed inset-x-4 top-[7vh] z-[70] mx-auto flex max-h-[86vh] w-[min(94vw,880px)] flex-col overflow-hidden rounded-3xl md:inset-x-0"
          >
            <header className="flex items-center gap-3 border-b border-white/[0.07] px-6 py-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-300/30 bg-violet-400/10 text-violet-300">
                <Activity size={17} />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold tracking-[0.18em] text-white">
                  MISSION TELEMETRY
                </h2>
                <p className="font-mono2 mt-0.5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  aggregated across orchestration runs
                </p>
              </div>
              <button
                onClick={onClose}
                className="ml-auto rounded-lg border border-white/10 p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                aria-label="Close telemetry"
              >
                <X size={15} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
              {loading || !metrics ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="skel h-28 rounded-2xl" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <BigStat
                      icon={<BarChart3 size={12} />}
                      label="Total runs"
                      value={`${metrics.totalRuns}`}
                      sub={`${metrics.agentsUsed} agents engaged`}
                    />
                    <BigStat
                      icon={<Coins size={12} />}
                      label="Total spend"
                      value={formatCost(metrics.totalCostUsd)}
                      sub="estimated · all models"
                    />
                    <BigStat
                      icon={<Hash size={12} />}
                      label="Tokens processed"
                      value={formatTokens(metrics.totalTokens)}
                      sub={`${Math.round(overallRate * 100)}% success rate`}
                    />
                    <BigStat
                      icon={<Timer size={12} />}
                      label="Avg run latency"
                      value={formatLatency(metrics.avgLatencyMs)}
                      sub="fan-out + synthesis"
                    />
                  </div>

                  {/* per-agent table */}
                  <div className="mt-7">
                    <p className="font-mono2 mb-3 text-[10px] uppercase tracking-[0.26em] text-slate-500">
                      Per-model activity
                    </p>
                    {metrics.perAgent.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No model traffic recorded yet — run an orchestration.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {[...metrics.perAgent]
                          .sort((a, b) => b.calls - a.calls)
                          .map((a, i) => (
                            <motion.div
                              key={a.agentId}
                              initial={{ opacity: 0, x: -14 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.05 * i }}
                              className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                            >
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                <span
                                  className="flex items-center gap-2 text-[13.5px] font-medium text-white"
                                  style={{ minWidth: 110 }}
                                >
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{ background: a.accent, boxShadow: `0 0 8px ${a.accent}` }}
                                  />
                                  {a.displayName}
                                </span>
                                <span className="font-mono2 text-[10.5px] text-slate-400">
                                  {a.calls} calls
                                </span>
                                <span className="font-mono2 text-[10.5px] text-slate-400">
                                  avg {formatLatency(a.avgLatencyMs)}
                                </span>
                                <span className="font-mono2 text-[10.5px] text-slate-400">
                                  {formatTokens(a.tokens)} tok
                                </span>
                                <span className="font-mono2 text-[10.5px] text-emerald-300/90">
                                  {formatCost(a.costUsd)}
                                </span>
                                <span
                                  className="font-mono2 ml-auto text-[10.5px]"
                                  style={{ color: a.successRate >= 0.9 ? "#34d399" : a.successRate >= 0.6 ? "#fbbf24" : "#fb7185" }}
                                >
                                  {Math.round(a.successRate * 100)}% ok
                                </span>
                              </div>
                              <div className="mt-2.5 h-[6px] overflow-hidden rounded-full bg-white/[0.05]">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(a.calls / maxCalls) * 100}%` }}
                                  transition={{ duration: 0.8, delay: 0.1 + 0.05 * i, ease: [0.16, 1, 0.3, 1] }}
                                  className="h-full rounded-full"
                                  style={{
                                    background: `linear-gradient(90deg, ${a.accent}44, ${a.accent})`,
                                  }}
                                />
                              </div>
                            </motion.div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* recent activity sparkbars */}
                  <div className="mt-7">
                    <p className="font-mono2 mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.26em] text-slate-500">
                      <TrendingUp size={12} />
                      Recent runs · tokens
                    </p>
                    <div className="flex h-24 items-end gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                      {metrics.recent.length === 0 ? (
                        <p className="font-mono2 m-auto text-[10px] uppercase tracking-[0.2em] text-slate-600">
                          awaiting first run
                        </p>
                      ) : (
                        metrics.recent.map((r, i) => (
                          <motion.div
                            key={r.id}
                            initial={{ height: 0 }}
                            animate={{
                              height: `${Math.max(8, (r.tokens / maxRecent) * 100)}%`,
                            }}
                            transition={{ duration: 0.7, delay: 0.05 * i, ease: [0.16, 1, 0.3, 1] }}
                            className={`flex-1 rounded-t-md ${
                              r.status === "failed" ? "bg-rose-400/40" : ""
                            }`}
                            style={
                              r.status === "failed"
                                ? undefined
                                : {
                                    background:
                                      "linear-gradient(to top, rgba(34,211,238,0.25), rgba(34,211,238,0.85))",
                                  }
                            }
                            title={`${formatTokens(r.tokens)} tokens`}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
