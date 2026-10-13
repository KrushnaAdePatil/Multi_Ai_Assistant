"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Radio, Sparkle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Constellation, {
  type ConstellationNode,
  type Phase,
} from "@/components/Constellation";
import HistoryDrawer from "@/components/HistoryDrawer";
import MetricsOverlay from "@/components/MetricsOverlay";
import Nav from "@/components/Nav";
import QueryConsole from "@/components/QueryConsole";
import ResponseCard from "@/components/ResponseCard";
import SettingsPanel from "@/components/SettingsPanel";
import Starfield from "@/components/Starfield";
import SynthesisPanel from "@/components/SynthesisPanel";
import Toasts, { type Toast } from "@/components/Toasts";
import type {
  AgentsResponse,
  LiveRun,
  MetricsData,
  RunSummary,
  RunDetail,
  SanitizedAgent,
  AgentResult,
} from "@/lib/client/api";
import { streamSSE } from "@/lib/client/api";
import { formatCost } from "@/lib/format";

const GLYPH_FALLBACK = "sparkles";

export default function Home() {
  const [agents, setAgents] = useState<SanitizedAgent[]>([]);
  const [synthesizer, setSynthesizer] = useState("deepseek");
  const [run, setRun] = useState<LiveRun | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [history, setHistory] = useState<RunSummary[]>([]);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const resultsRef = useRef<HTMLElement>(null);
  const runSeq = useRef(0);

  const busy = !!run && (run.phase === "fanout" || run.phase === "synthesizing");

  /* ---------------- toasts ---------------- */
  const notify = useCallback((text: string, kind: Toast["kind"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  /* ---------------- data loading ---------------- */
  const loadAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents", { cache: "no-store" });
      const data = (await res.json()) as AgentsResponse;
      setAgents(data.agents ?? []);
      if (data.synthesizer) setSynthesizer(data.synthesizer);
    } catch {
      notify("Could not load agent roster", "err");
    }
  }, [notify]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/runs", { cache: "no-store" });
      const data = (await res.json()) as { runs: RunSummary[] };
      setHistory(data.runs ?? []);
    } catch {
      /* non-fatal */
    }
  }, []);

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const res = await fetch("/api/metrics", { cache: "no-store" });
      setMetrics((await res.json()) as MetricsData);
    } catch {
      /* non-fatal */
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
    loadHistory();
    loadMetrics();
  }, [loadAgents, loadHistory, loadMetrics]);

  /* ---------------- elapsed ticker ---------------- */
  useEffect(() => {
    if (!busy || !run) return;
    const t = setInterval(() => setElapsedMs(Date.now() - run.startedAt), 120);
    return () => clearInterval(t);
  }, [busy, run]);

  const armedCount = agents.filter(
    (a) => a.enabled && (a.keySource !== "none" || !a.requiresKey),
  ).length;

  /* ---------------- orchestration ---------------- */
  const orchestrate = useCallback(
    async (query: string) => {
      if (busy) {
        notify("An orchestration is already running", "info");
        return;
      }
      const seq = ++runSeq.current;
      setElapsedMs(0);
      setRun(null);

      try {
        const res = await fetch("/api/orchestrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });

        if (!res.ok || !res.body) {
          let message = `Orchestration failed (${res.status})`;
          try {
            const data = await res.json();
            if (data.error) message = data.error;
          } catch {
            /* keep default */
          }
          notify(message, "err");
          if (res.status === 409) setSettingsOpen(true);
          return;
        }

        await streamSSE(res, (event, raw) => {
          if (runSeq.current !== seq) return;
          const data = raw as Record<string, never>;

          if (event === "run_start") {
            const d = raw as {
              query: string;
              agents: LiveRun["agents"] extends never
                ? never
                : { id: string; displayName: string; model: string; accent: string; glyph: string }[];
              synthesizerId: string;
            };
            setRun({
              key: `run-${seq}`,
              query: d.query,
              agents: d.agents.map((a) => ({
                slot: a,
                status: "pending" as const,
              })),
              phase: "fanout",
              synthesizerId: d.synthesizerId,
              startedAt: Date.now(),
            });
            setElapsedMs(0);
            setTimeout(
              () =>
                resultsRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                }),
              350,
            );
          }

          if (event === "agent_result") {
            const r = data as unknown as AgentResult;
            setRun((prev) =>
              prev
                ? {
                    ...prev,
                    agents: prev.agents.map((a) =>
                      a.slot.id === r.agentId
                        ? {
                            ...a,
                            status: r.success ? "success" : "error",
                            result: r,
                          }
                        : a,
                    ),
                  }
                : prev,
            );
          }

          if (event === "synthesis_start") {
            const d = raw as { synthesizerId: string; agentName: string; basedOn: string[] };
            setRun((prev) =>
              prev
                ? { ...prev, phase: "synthesizing", synthMeta: d }
                : prev,
            );
          }

          if (event === "synthesis_result") {
            const r = data as unknown as AgentResult;
            setRun((prev) => (prev ? { ...prev, synthesis: r } : prev));
          }

          if (event === "done") {
            const d = raw as {
              runId: string;
              status: LiveRun["status"];
              totals: LiveRun["totals"];
            };
            setRun((prev) =>
              prev
                ? {
                    ...prev,
                    phase: d.status === "failed" ? "failed" : "complete",
                    runId: d.runId,
                    status: d.status,
                    totals: d.totals,
                  }
                : prev,
            );
            if (d.status !== "completed") {
              notify(
                d.status === "failed"
                  ? "All agents failed — check keys in Settings"
                  : "Partial success — some agents failed gracefully",
                d.status === "failed" ? "err" : "info",
              );
            }
            loadHistory();
            loadMetrics();
          }

          if (event === "error") {
            const d = raw as { message: string };
            notify(d.message ?? "Orchestration error", "err");
            setRun((prev) => (prev ? { ...prev, phase: "failed" } : prev));
          }
        });
      } catch (e) {
        notify(
          e instanceof Error ? e.message : "Network error while orchestrating",
          "err",
        );
        setRun((prev) => (prev && runSeq.current === seq ? { ...prev, phase: "failed" } : prev));
      }
    },
    [busy, loadHistory, loadMetrics, notify],
  );

  /* ---------------- history replay ---------------- */
  const loadRun = useCallback(
    async (id: string) => {
      if (busy) {
        notify("Wait for the current run to finish", "info");
        return;
      }
      try {
        const res = await fetch(`/api/runs/${id}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Run not found");
        const detail = (await res.json()) as RunDetail;

        const agentRows = detail.responses.filter((r) => r.role === "agent");
        const synthRow = detail.responses.find((r) => r.role === "synthesizer");
        const slotFor = (r: (typeof agentRows)[number]) => {
          const def = agents.find((a) => a.id === r.agentId);
          return {
            id: r.agentId,
            displayName: r.agentName,
            model: r.model,
            accent: def?.accent ?? "#64748b",
            glyph: def?.glyph ?? GLYPH_FALLBACK,
          };
        };

        setRun({
          key: `hist-${id}`,
          query: detail.run.query,
          agents: agentRows.map((r) => ({
            slot: slotFor(r),
            status: r.success ? ("success" as const) : ("error" as const),
            result: {
              agentId: r.agentId,
              agentName: r.agentName,
              model: r.model,
              content: r.content,
              usage: {
                promptTokens: r.promptTokens,
                completionTokens: r.completionTokens,
                totalTokens: r.totalTokens,
              },
              costUsd: r.costUsd,
              latencyMs: r.latencyMs,
              success: r.success,
              error: r.error ?? undefined,
            },
          })),
          phase: detail.run.status === "failed" ? "failed" : "complete",
          synthesizerId: detail.run.synthesizerId ?? "",
          synthMeta:
            synthRow || detail.run.synthesis
              ? {
                  agentName: agents.find(
                    (a) => a.id === detail.run.synthesizerId,
                  )?.displayName ?? "Synthesizer",
                  basedOn: agentRows.filter((r) => r.success).map((r) => r.agentId),
                }
              : undefined,
          synthesis:
            synthRow || detail.run.synthesis
              ? {
                  agentId: detail.run.synthesizerId ?? "synthesizer",
                  agentName:
                    agents.find((a) => a.id === detail.run.synthesizerId)
                      ?.displayName ?? "Synthesizer",
                  model: synthRow?.model ?? "",
                  content: synthRow?.content ?? detail.run.synthesis ?? "",
                  usage: {
                    promptTokens: synthRow?.promptTokens ?? 0,
                    completionTokens: synthRow?.completionTokens ?? 0,
                    totalTokens: synthRow?.totalTokens ?? 0,
                  },
                  costUsd: synthRow?.costUsd ?? 0,
                  latencyMs: synthRow?.latencyMs ?? 0,
                  success: true,
                }
              : undefined,
          totals: {
            latencyMs: detail.run.totalLatencyMs,
            totalTokens: detail.run.totalTokens,
            costUsd: detail.run.totalCostUsd,
            succeeded: agentRows.filter((r) => r.success).length,
            attempted: agentRows.length,
          },
          runId: id,
          status: detail.run.status as LiveRun["status"],
          startedAt: Date.now() - detail.run.totalLatencyMs,
          readonly: true,
        });
        setHistoryOpen(false);
        setTimeout(
          () =>
            resultsRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            }),
          300,
        );
      } catch (e) {
        notify(e instanceof Error ? e.message : "Could not load run", "err");
      }
    },
    [agents, busy, notify],
  );

  /* ---------------- settings mutations ---------------- */
  const patchAgentLocal = useCallback((a: SanitizedAgent) => {
    setAgents((prev) => prev.map((x) => (x.id === a.id ? a : x)));
  }, []);

  const toggleAgent = useCallback(
    async (a: SanitizedAgent, enabled: boolean) => {
      setAgents((prev) =>
        prev.map((x) => (x.id === a.id ? { ...x, enabled } : x)),
      );
      try {
        const res = await fetch(`/api/agents/${a.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed");
        patchAgentLocal(data.agent as SanitizedAgent);
        notify(
          `${a.displayName} ${enabled ? "armed" : "stood down"}`,
          enabled ? "ok" : "info",
        );
      } catch (e) {
        setAgents((prev) =>
          prev.map((x) => (x.id === a.id ? { ...x, enabled: !enabled } : x)),
        );
        notify(e instanceof Error ? e.message : "Toggle failed", "err");
      }
    },
    [notify, patchAgentLocal],
  );

  /* ---------------- constellation nodes ---------------- */
  const phase: Phase = run?.phase ?? "idle";
  const nodes: ConstellationNode[] = run
    ? run.agents.map((a) => ({
        id: a.slot.id,
        name: a.slot.displayName,
        accent: a.slot.accent,
        glyph: a.slot.glyph,
        state:
          a.status === "pending"
            ? ("active" as const)
            : a.status === "success"
              ? ("success" as const)
              : ("error" as const),
      }))
    : agents.map((a) => ({
        id: a.id,
        name: a.displayName,
        accent: a.accent,
        glyph: a.glyph,
        state: (
          a.enabled && (a.keySource !== "none" || !a.requiresKey)
            ? "armed"
            : "off"
        ) as ConstellationNode["state"],
      }));

  return (
    <div id="top" className="relative min-h-screen">
      <Starfield />
      <div className="grid-bg pointer-events-none fixed inset-0 z-0" />
      {/* vignette */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(3,4,8,0.75)_100%)]" />

      <Nav
        armed={armedCount}
        total={agents.length || 7}
        runCount={history.length}
        onHistory={() => setHistoryOpen(true)}
        onMetrics={() => {
          setMetricsOpen(true);
          loadMetrics();
        }}
        onSettings={() => setSettingsOpen(true)}
      />

      <main className="relative z-10 mx-auto max-w-[1400px] px-5 pb-24 pt-28 sm:px-8">
        {/* ---------------- HERO ---------------- */}
        <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="mb-5 inline-flex items-center gap-2.5 rounded-full border border-cyan-300/20 bg-cyan-400/[0.06] px-4 py-1.5"
            >
              <Radio size={12} className="text-cyan-300" />
              <span className="font-mono2 text-[10px] uppercase tracking-[0.3em] text-cyan-200/90">
                multi-agent intelligence grid
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-[clamp(2.6rem,6.5vw,4.9rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-white"
            >
              Seven minds.
              <br />
              <span
                className="font-serif-i bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-400 bg-clip-text pr-3 text-transparent"
                style={{ fontStyle: "italic" }}
              >
                One verdict.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="mt-6 max-w-xl text-[15.5px] leading-relaxed text-slate-400"
            >
              Ask once.{" "}
              <span className="text-slate-200">DeepSeek</span>,{" "}
              <span className="text-slate-200">GPT-4o</span> and{" "}
              <span className="text-slate-200">Gemini</span> reason in parallel,
              side-by-side — then an arbiter fuses their answers into{" "}
              <span className="text-cyan-200">a single decisive response</span>.
              Graceful failure, token accounting and true cost on every run.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.26, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8"
            >
              <QueryConsole busy={busy} elapsedMs={elapsedMs} onSubmit={orchestrate} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="font-mono2 mt-8 flex flex-wrap gap-x-7 gap-y-2 text-[10.5px] uppercase tracking-[0.2em] text-slate-500"
            >
              <span className="flex items-center gap-2">
                <Sparkle size={11} className="text-cyan-400" />
                {armedCount} live models
              </span>
              <span>{history.length} runs logged</span>
              <span>{formatCost(metrics?.totalCostUsd ?? 0)} estimated spend</span>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="float-y mx-auto w-full max-w-[520px]"
          >
            <Constellation nodes={nodes} phase={phase} />
          </motion.div>
        </section>

        {/* ---------------- RESULTS ---------------- */}
        <AnimatePresence>
          {run && (
            <motion.section
              ref={resultsRef}
              key={run.key}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-16 scroll-mt-24"
            >
              {/* run header */}
              <div className="mb-7 flex flex-wrap items-end gap-x-6 gap-y-3 border-b border-white/[0.07] pb-5">
                <div className="min-w-0 flex-1">
                  <p className="font-mono2 mb-2 flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-slate-500">
                    ensemble results
                    {run.readonly && (
                      <span className="rounded-full border border-violet-300/30 bg-violet-400/10 px-2 py-0.5 text-violet-300">
                        replay
                      </span>
                    )}
                    {busy && (
                      <span className="blink flex items-center gap-1.5 text-cyan-300">
                        <span className="h-1.5 w-1.5 animate-ping rounded-full bg-cyan-300" />
                        live
                      </span>
                    )}
                  </p>
                  <h2 className="font-serif-i max-w-4xl text-[clamp(1.3rem,3vw,1.9rem)] leading-snug text-slate-100">
                    “{run.query.length > 160 ? `${run.query.slice(0, 160)}…` : run.query}”
                  </h2>
                </div>
                <div className="font-mono2 text-right text-[10.5px] uppercase tracking-[0.18em] text-slate-500">
                  <p>
                    arbiter ·{" "}
                    <span className="text-violet-300">
                      {agents.find((a) => a.id === run.synthesizerId)?.displayName ??
                        run.synthesizerId}
                    </span>
                  </p>
                  <p className="mt-1">
                    status ·{" "}
                    <span
                      className={
                        run.phase === "complete"
                          ? "text-emerald-300"
                          : run.phase === "failed"
                            ? "text-rose-400"
                            : "text-cyan-300"
                      }
                    >
                      {run.status ?? (busy ? "running" : run.phase)}
                    </span>
                  </p>
                </div>
              </div>

              {/* agent cards */}
              <div className="grid gap-5 md:grid-cols-2">
                {run.agents.map((a, i) => (
                  <ResponseCard
                    key={`${run.key}-${a.slot.id}`}
                    agent={a}
                    index={i}
                    elapsedMs={a.status === "pending" ? elapsedMs : a.result?.latencyMs ?? 0}
                  />
                ))}
              </div>

              {/* verdict */}
              <SynthesisPanel run={run} />
            </motion.section>
          )}
        </AnimatePresence>

        {/* ---------------- footer ---------------- */}
        <footer className="mt-28 border-t border-white/[0.06] pt-8">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <p className="font-mono2 text-[10px] uppercase tracking-[0.3em] text-slate-600">
              ORCHESTRA — multi-AI orchestration engine
            </p>
            <p className="font-mono2 text-[10px] uppercase tracking-[0.2em] text-slate-700">
              deepseek · openai · gemini · claude · perplexity · azure · ollama
            </p>
            <p className="font-mono2 ml-auto text-[10px] uppercase tracking-[0.2em] text-slate-600">
              built for the age of many minds
            </p>
          </div>
        </footer>
      </main>

      {/* ---------------- overlays ---------------- */}
      <SettingsPanel
        open={settingsOpen}
        agents={agents}
        synthesizer={synthesizer}
        onClose={() => setSettingsOpen(false)}
        onSaved={patchAgentLocal}
        onToggleAgent={toggleAgent}
        onSynthesizerChanged={setSynthesizer}
        notify={notify}
      />
      <HistoryDrawer
        open={historyOpen}
        runs={history}
        activeId={run?.runId}
        onClose={() => setHistoryOpen(false)}
        onSelect={loadRun}
        onReask={(q) => {
          setHistoryOpen(false);
          orchestrate(q);
        }}
      />
      <MetricsOverlay
        open={metricsOpen}
        metrics={metrics}
        loading={metricsLoading}
        onClose={() => setMetricsOpen(false)}
      />
      <Toasts toasts={toasts} />
    </div>
  );
}
