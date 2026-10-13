"use client";

import { motion } from "framer-motion";
import { Sigma } from "lucide-react";
import AgentGlyph from "@/components/AgentGlyph";

export type NodeState = "off" | "armed" | "active" | "success" | "error";

export interface ConstellationNode {
  id: string;
  name: string;
  accent: string;
  glyph: string;
  state: NodeState;
}

export type Phase = "idle" | "fanout" | "synthesizing" | "complete" | "failed";

const R = 42; // ring radius in %

function pos(i: number, n: number) {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return { x: 50 + R * Math.cos(a), y: 50 + R * Math.sin(a) };
}

const PHASE_LABEL: Record<Phase, string> = {
  idle: "AWAITING QUERY",
  fanout: "PARALLEL REASONING",
  synthesizing: "SYNTHESIZING VERDICT",
  complete: "VERDICT READY",
  failed: "SIGNAL LOST",
};

export default function Constellation({
  nodes,
  phase,
}: {
  nodes: ConstellationNode[];
  phase: Phase;
}) {
  const busy = phase === "fanout" || phase === "synthesizing";
  const n = nodes.length || 1;

  return (
    <div className="relative aspect-square w-full select-none">
      {/* orbital guides */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
            <stop offset="45%" stopColor="#22d3ee" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g className={busy ? "spin-slow" : "spin-slower"} style={{ transformOrigin: "50px 50px" }}>
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="0.25"
            strokeDasharray="1 2.4"
          />
        </g>
        <circle
          cx="50"
          cy="50"
          r="31"
          fill="none"
          stroke="rgba(255,255,255,0.045)"
          strokeWidth="0.2"
          strokeDasharray="0.6 3"
        />

        {/* halo around core while working */}
        {(busy || phase === "complete") && (
          <motion.circle
            cx="50"
            cy="50"
            r="14"
            fill="url(#coreGlow)"
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === "synthesizing" ? 1 : 0.55 }}
          />
        )}

        {/* connectors + traveling pulses */}
        {nodes.map((node, i) => {
          const p = pos(i, n);
          const live = node.state === "active" || node.state === "success";
          return (
            <g key={node.id}>
              <line
                x1="50"
                y1="50"
                x2={p.x}
                y2={p.y}
                stroke={
                  node.state === "error"
                    ? "rgba(251,113,133,0.28)"
                    : live
                      ? node.accent
                      : node.state === "armed"
                        ? "rgba(255,255,255,0.13)"
                        : "rgba(255,255,255,0.05)"
                }
                strokeWidth={live ? 0.4 : 0.22}
                opacity={live ? 0.85 : 1}
                className={node.state === "active" ? "dash-flow" : undefined}
              />
              {node.state === "active" && (
                <motion.circle
                  r="0.9"
                  fill={node.accent}
                  style={{ filter: `drop-shadow(0 0 3px ${node.accent})` }}
                  initial={{
                    cx: p.x,
                    cy: p.y,
                    opacity: 0,
                  }}
                  animate={{
                    cx: [p.x, 50],
                    cy: [p.y, 50],
                    opacity: [0, 1, 1, 0],
                  }}
                  transition={{
                    duration: 1.35,
                    repeat: Infinity,
                    ease: "linear",
                    delay: (i * 0.17) % 1.2,
                  }}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* agent nodes */}
      {nodes.map((node, i) => {
        const p = pos(i, n);
        const dim = node.state === "off";
        return (
          <div
            key={node.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 * i, type: "spring", stiffness: 200, damping: 18 }}
              className="relative flex flex-col items-center gap-1.5"
            >
              {node.state === "active" && (
                <motion.span
                  className="absolute inset-0 rounded-full"
                  style={{ border: `1px solid ${node.accent}` }}
                  animate={{ scale: [1, 1.9], opacity: [0.8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                />
              )}
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-500 sm:h-11 sm:w-11 ${
                  node.state === "success"
                    ? "shadow-[0_0_22px_-2px_var(--glow)]"
                    : ""
                }`}
                style={{
                  // @ts-expect-error css var
                  "--glow": node.accent,
                  borderColor: dim
                    ? "rgba(255,255,255,0.09)"
                    : node.state === "error"
                      ? "rgba(251,113,133,0.6)"
                      : `${node.accent}${node.state === "armed" ? "88" : ""}`,
                  background:
                    node.state === "success"
                      ? `${node.accent}24`
                      : dim
                        ? "rgba(255,255,255,0.025)"
                        : "rgba(10,12,20,0.8)",
                  color:
                    node.state === "error"
                      ? "#fb7185"
                      : dim
                        ? "rgba(255,255,255,0.28)"
                        : node.accent,
                }}
              >
                <AgentGlyph glyph={node.glyph} size={17} />
              </div>
              <span
                className="font-mono2 text-[9px] uppercase tracking-[0.18em]"
                style={{
                  color: dim
                    ? "rgba(255,255,255,0.22)"
                    : node.state === "error"
                      ? "rgba(251,113,133,0.8)"
                      : node.state === "success"
                        ? "#e6edf7"
                        : `${node.accent}cc`,
                }}
              >
                {node.name}
              </span>
            </motion.div>
          </div>
        );
      })}

      {/* the core */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative flex flex-col items-center gap-2">
          {phase === "synthesizing" && (
            <>
              <motion.span
                className="absolute inset-0 rounded-full border border-cyan-300/50"
                animate={{ scale: [1, 2.4], opacity: [0.9, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
              />
              <motion.span
                className="absolute inset-0 rounded-full border border-violet-400/40"
                animate={{ scale: [1, 2.4], opacity: [0.9, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut", delay: 0.55 }}
              />
            </>
          )}
          <motion.div
            animate={
              phase === "synthesizing"
                ? { scale: [1, 1.12, 1] }
                : { scale: 1 }
            }
            transition={
              phase === "synthesizing"
                ? { duration: 1.5, repeat: Infinity }
                : undefined
            }
            className={`flex h-16 w-16 items-center justify-center rounded-full border sm:h-[72px] sm:w-[72px] ${
              phase === "complete" ? "pulse-ring" : ""
            }`}
            style={{
              borderColor:
                phase === "failed"
                  ? "rgba(251,113,133,0.5)"
                  : "rgba(34,211,238,0.55)",
              background:
                "linear-gradient(150deg, rgba(34,211,238,0.14), rgba(167,139,250,0.09) 60%, rgba(10,12,20,0.9))",
              boxShadow: busy
                ? "0 0 44px -4px rgba(34,211,238,0.5), inset 0 0 18px rgba(34,211,238,0.15)"
                : "0 0 30px -8px rgba(34,211,238,0.35)",
            }}
          >
            <Sigma size={26} className="text-cyan-200" strokeWidth={1.6} />
          </motion.div>
          <span
            className={`font-mono2 text-[9px] uppercase tracking-[0.3em] ${
              busy ? "blink text-cyan-300" : "text-slate-500"
            } ${phase === "complete" ? "text-emerald-300" : ""} ${
              phase === "failed" ? "text-rose-400" : ""
            }`}
          >
            {PHASE_LABEL[phase]}
          </span>
        </div>
      </div>
    </div>
  );
}
