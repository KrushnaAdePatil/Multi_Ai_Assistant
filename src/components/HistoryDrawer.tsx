"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, History, RotateCw, X, XCircle } from "lucide-react";
import type { RunSummary } from "@/lib/client/api";
import { formatCost, formatTokens, timeAgo } from "@/lib/format";

export default function HistoryDrawer({
  open,
  runs,
  activeId,
  onClose,
  onSelect,
  onReask,
}: {
  open: boolean;
  runs: RunSummary[];
  activeId?: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  onReask: (query: string) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="glass-deep fixed inset-y-0 right-0 z-[70] flex w-[min(94vw,420px)] flex-col border-l border-white/10"
          >
            <header className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-4">
              <History size={16} className="text-cyan-300" />
              <h2 className="font-mono2 text-[12px] uppercase tracking-[0.28em] text-white">
                Run history
              </h2>
              <button
                onClick={onClose}
                className="ml-auto rounded-lg border border-white/10 p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                aria-label="Close history"
              >
                <X size={15} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4">
              {runs.length === 0 ? (
                <div className="mt-24 text-center">
                  <p className="font-mono2 text-[11px] uppercase tracking-[0.24em] text-slate-600">
                    no runs yet
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Your orchestration transcripts will appear here.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {runs.map((r, i) => {
                    const ok = r.status === "completed";
                    const failed = r.status === "failed";
                    return (
                      <motion.li
                        key={r.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.03 * i }}
                      >
                        <button
                          onClick={() => onSelect(r.id)}
                          className={`group w-full rounded-xl border px-4 py-3.5 text-left transition-all ${
                            activeId === r.id
                              ? "border-cyan-300/40 bg-cyan-400/[0.07]"
                              : "border-white/[0.07] bg-white/[0.02] hover:border-white/20"
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            {failed ? (
                              <XCircle size={14} className="mt-0.5 shrink-0 text-rose-400" />
                            ) : (
                              <CheckCircle2
                                size={14}
                                className={`mt-0.5 shrink-0 ${ok ? "text-emerald-400" : "text-amber-300"}`}
                              />
                            )}
                            <p className="line-clamp-2 flex-1 text-[13px] leading-snug text-slate-200">
                              {r.query}
                            </p>
                          </div>
                          <div className="font-mono2 mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                            <span>{timeAgo(r.createdAt)}</span>
                            <span className="text-slate-600">·</span>
                            <span>
                              {r.agentsSucceeded}/{r.agentsUsed} agents
                            </span>
                            <span className="text-slate-600">·</span>
                            <span>{formatTokens(r.totalTokens)} tok</span>
                            <span className="text-slate-600">·</span>
                            <span className="text-emerald-300/80">{formatCost(r.totalCostUsd)}</span>
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                onReask(r.query);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.stopPropagation();
                                  onReask(r.query);
                                }
                              }}
                              className="ml-auto inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 text-[9.5px] text-slate-400 transition-all hover:border-cyan-300/40 hover:text-cyan-200"
                            >
                              <RotateCw size={10} />
                              re-ask
                            </span>
                          </div>
                        </button>
                      </motion.li>
                    );
                  })}
                </ul>
              )}
            </div>

            {runs.length > 0 && (
              <footer className="border-t border-white/[0.07] px-5 py-3">
                <p className="font-mono2 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.2em] text-slate-600">
                  <RotateCw size={11} />
                  click a run to replay its full transcript
                </p>
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
