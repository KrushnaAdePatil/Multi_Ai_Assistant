"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Crown,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  PlugZap,
  Save,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import AgentGlyph from "@/components/AgentGlyph";
import type { SanitizedAgent } from "@/lib/client/api";
import { formatLatency } from "@/lib/format";

type TestState =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "ok"; latencyMs: number; model: string }
  | { kind: "fail"; error: string };

function Toggle({
  on,
  onClick,
  accent,
}: {
  on: boolean;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className="relative h-6 w-11 shrink-0 rounded-full border transition-all duration-300"
      style={{
        background: on ? `${accent}33` : "rgba(255,255,255,0.06)",
        borderColor: on ? `${accent}88` : "rgba(255,255,255,0.12)",
      }}
    >
      <span
        className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-all duration-300"
        style={{
          left: on ? "calc(100% - 20px)" : "4px",
          background: on ? accent : "rgba(255,255,255,0.4)",
          boxShadow: on ? `0 0 10px ${accent}` : "none",
        }}
      />
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="font-mono2 mb-1.5 block text-[9.5px] uppercase tracking-[0.22em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-slate-100 placeholder:text-slate-600 transition-colors focus:border-cyan-300/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/10";

function AgentEditCard({
  agent,
  onSaved,
  onToggle,
  notify,
}: {
  agent: SanitizedAgent;
  onSaved: (a: SanitizedAgent) => void;
  onToggle: (a: SanitizedAgent, enabled: boolean) => void;
  notify: (text: string, kind: "ok" | "err" | "info") => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(agent.baseUrl);
  const [model, setModel] = useState(agent.model);
  const [temperature, setTemperature] = useState(agent.temperature);
  const [maxTokens, setMaxTokens] = useState(agent.maxTokens);
  const [timeoutS, setTimeoutS] = useState(Math.round(agent.timeoutMs / 1000));
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState<TestState>({ kind: "idle" });

  useEffect(() => {
    setBaseUrl(agent.baseUrl);
    setModel(agent.model);
    setTemperature(agent.temperature);
    setMaxTokens(agent.maxTokens);
    setTimeoutS(Math.round(agent.timeoutMs / 1000));
  }, [agent]);

  const showBaseUrl =
    agent.provider !== "anthropic" && agent.provider !== "google";
  const dim = !agent.enabled;

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: agent.enabled,
          ...(apiKey.trim() ? { apiKey } : {}),
          baseUrl,
          model,
          temperature,
          maxTokens,
          timeoutMs: timeoutS * 1000,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      onSaved(data.agent as SanitizedAgent);
      setApiKey("");
      notify(`${agent.displayName} configuration saved`, "ok");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Save failed", "err");
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTest({ kind: "testing" });
    try {
      // persist pending fields first so the test uses what you typed
      await save();
      const res = await fetch(`/api/agents/${agent.id}/test`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setTest({ kind: "ok", latencyMs: data.latencyMs, model: data.model });
        notify(`${agent.displayName} responded in ${formatLatency(data.latencyMs)}`, "ok");
      } else {
        setTest({ kind: "fail", error: data.error ?? "No response" });
        notify(`${agent.displayName} unreachable — ${data.error ?? "check credentials"}`, "err");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Test failed";
      setTest({ kind: "fail", error: msg });
      notify(msg, "err");
    }
  };

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border transition-all duration-300 ${
        agent.enabled
          ? "border-white/[0.1] bg-white/[0.03]"
          : "border-white/[0.06] bg-white/[0.012]"
      }`}
    >
      <header className="flex items-center gap-3 px-5 pt-4">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-lg border"
          style={{
            borderColor: dim ? "rgba(255,255,255,0.1)" : `${agent.accent}44`,
            background: dim ? "rgba(255,255,255,0.03)" : `${agent.accent}11`,
            color: dim ? "#64748b" : agent.accent,
          }}
        >
          <AgentGlyph glyph={agent.glyph} size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`text-[14.5px] font-semibold ${dim ? "text-slate-400" : "text-white"}`}>
              {agent.displayName}
            </h3>
            <span className="font-mono2 rounded border border-white/10 bg-white/[0.04] px-1.5 py-px text-[9px] uppercase tracking-[0.14em] text-slate-500">
              {agent.provider}
            </span>
            {agent.isCore && (
              <span className="font-mono2 rounded border border-cyan-300/25 bg-cyan-400/10 px-1.5 py-px text-[9px] uppercase tracking-[0.14em] text-cyan-300">
                core
              </span>
            )}
          </div>
          <p className="font-mono2 mt-0.5 text-[9.5px] uppercase tracking-[0.16em] text-slate-600">
            ${agent.pricing.input}/M in · ${agent.pricing.output}/M out
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono2 text-[9.5px] uppercase tracking-[0.2em] text-slate-500">
            {agent.enabled ? "armed" : "off"}
          </span>
          <Toggle
            on={agent.enabled}
            accent={agent.accent}
            onClick={() => onToggle(agent, !agent.enabled)}
          />
        </div>
      </header>

      <div
        className={`grid gap-4 px-5 pb-5 pt-4 ${dim ? "pointer-events-none opacity-45" : ""}`}
      >
        <Field
          label={
            agent.keySource === "env"
              ? `API key — using environment (${agent.keyPreview})`
              : agent.keySource === "db"
                ? `API key — saved (${agent.keyPreview})`
                : "API key — not configured"
          }
        >
          <div className="relative">
            <KeyRound size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={agent.keyPreview ?? (agent.isCore ? "paste key or set env var" : "optional — add when ready")}
              autoComplete="off"
              spellCheck={false}
              className={`${inputCls} pl-9 pr-10 font-mono2 text-[12px]`}
            />
            <button
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-200"
              aria-label="Toggle key visibility"
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </Field>

        <div className={`grid gap-4 ${showBaseUrl ? "sm:grid-cols-2" : ""}`}>
          {showBaseUrl && (
            <Field label={agent.provider === "azure" ? "Azure endpoint" : "Base URL"}>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                spellCheck={false}
                className={`${inputCls} font-mono2 text-[12px]`}
              />
            </Field>
          )}
          <Field label={agent.provider === "azure" ? "Deployment name" : "Model"}>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              spellCheck={false}
              className={`${inputCls} font-mono2 text-[12px]`}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={`Temperature — ${temperature.toFixed(2)}`}>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="mt-2.5 w-full"
              style={{ "--fill": `${(temperature / 1.5) * 100}%` } as React.CSSProperties}
            />
          </Field>
          <Field label="Max tokens">
            <input
              type="number"
              min={1}
              max={200000}
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value || "1", 10))}
              className={`${inputCls} font-mono2 text-[12px]`}
            />
          </Field>
          <Field label="Timeout (sec)">
            <input
              type="number"
              min={1}
              max={300}
              value={timeoutS}
              onChange={(e) => setTimeoutS(parseInt(e.target.value || "30", 10))}
              className={`${inputCls} font-mono2 text-[12px]`}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            onClick={save}
            disabled={saving}
            className="font-mono2 flex items-center gap-2 rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-[10.5px] uppercase tracking-[0.18em] text-cyan-200 transition-all hover:bg-cyan-400/20 disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save
          </button>
          <button
            onClick={runTest}
            disabled={saving || test.kind === "testing"}
            className="font-mono2 flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.04] px-4 py-2 text-[10.5px] uppercase tracking-[0.18em] text-slate-300 transition-all hover:border-violet-300/40 hover:text-violet-200 disabled:opacity-50"
          >
            {test.kind === "testing" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <PlugZap size={13} />
            )}
            Test link
          </button>
          {test.kind === "ok" && (
            <span className="font-mono2 flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] text-emerald-300">
              <CheckCircle2 size={13} />
              online · {formatLatency(test.latencyMs)}
            </span>
          )}
          {test.kind === "fail" && (
            <span className="font-mono2 truncate text-[10.5px] uppercase tracking-[0.12em] text-rose-400">
              {test.error}
            </span>
          )}
        </div>
      </div>
    </motion.section>
  );
}

export default function SettingsPanel({
  open,
  agents,
  synthesizer,
  onClose,
  onSaved,
  onToggleAgent,
  onSynthesizerChanged,
  notify,
}: {
  open: boolean;
  agents: SanitizedAgent[];
  synthesizer: string;
  onClose: () => void;
  onSaved: (a: SanitizedAgent) => void;
  onToggleAgent: (a: SanitizedAgent, enabled: boolean) => void;
  onSynthesizerChanged: (id: string) => void;
  notify: (text: string, kind: "ok" | "err" | "info") => void;
}) {
  const [synthId, setSynthId] = useState(synthesizer);
  const [savingSynth, setSavingSynth] = useState(false);

  useEffect(() => setSynthId(synthesizer), [synthesizer, open]);

  const saveSynthesizer = async (id: string) => {
    setSynthId(id);
    setSavingSynth(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ synthesizer: id }),
      });
      if (!res.ok) throw new Error("Failed");
      onSynthesizerChanged(id);
      notify(`Arbiter set to ${agents.find((a) => a.id === id)?.displayName ?? id}`, "ok");
    } catch {
      notify("Could not save arbiter", "err");
    } finally {
      setSavingSynth(false);
    }
  };

  const core = agents.filter((a) => a.isCore);
  const optional = agents.filter((a) => !a.isCore);

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
            transition={{ type: "spring", stiffness: 300, damping: 34 }}
            className="glass-deep fixed inset-y-0 right-0 z-[70] flex w-[min(96vw,560px)] flex-col border-l border-white/10"
          >
            <header className="flex items-center gap-3 border-b border-white/[0.07] px-6 py-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-400/10 text-cyan-300">
                <Crown size={16} />
              </span>
              <div className="flex-1">
                <h2 className="text-[15px] font-semibold tracking-[0.18em] text-white">
                  AGENT CONTROL DECK
                </h2>
                <p className="font-mono2 mt-0.5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  arm models · keys resolve from settings, else .env
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg border border-white/10 p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                aria-label="Close settings"
              >
                <X size={15} />
              </button>
            </header>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
              {/* arbiter select */}
              <section className="rounded-2xl border border-violet-300/20 bg-violet-400/[0.05] p-5">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-white">
                      <Crown size={14} className="text-violet-300" />
                      Synthesis arbiter
                    </h3>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
                      The model that fuses every answer into the final verdict.
                    </p>
                  </div>
                  <div className="relative">
                    <select
                      value={synthId}
                      disabled={savingSynth}
                      onChange={(e) => saveSynthesizer(e.target.value)}
                      className="font-mono2 appearance-none rounded-lg border border-violet-300/30 bg-[#0d0f18] py-2 pl-3.5 pr-9 text-[12px] uppercase tracking-[0.12em] text-violet-200 focus:outline-none"
                    >
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.displayName}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-violet-300">
                      ▼
                    </span>
                  </div>
                </div>
              </section>

              <div>
                <p className="font-mono2 mb-3 text-[10px] uppercase tracking-[0.26em] text-cyan-300/80">
                  Core roster — live keys required
                </p>
                <div className="space-y-4">
                  {core.map((a) => (
                    <AgentEditCard
                      key={a.id}
                      agent={a}
                      onSaved={onSaved}
                      onToggle={onToggleAgent}
                      notify={notify}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="font-mono2 mb-3 text-[10px] uppercase tracking-[0.26em] text-slate-500">
                  Auxiliary roster — plug in keys whenever ready
                </p>
                <div className="space-y-4">
                  {optional.map((a) => (
                    <AgentEditCard
                      key={a.id}
                      agent={a}
                      onSaved={onSaved}
                      onToggle={onToggleAgent}
                      notify={notify}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
