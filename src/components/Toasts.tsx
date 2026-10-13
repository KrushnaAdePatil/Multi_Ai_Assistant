"use client";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

export interface Toast {
  id: number;
  kind: "ok" | "err" | "info";
  text: string;
}

export default function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[110] flex w-[min(92vw,360px)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast-in glass-deep flex items-start gap-3 rounded-xl px-4 py-3 shadow-2xl shadow-black/60"
        >
          {t.kind === "err" ? (
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-400" />
          ) : t.kind === "ok" ? (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
          ) : (
            <Info size={16} className="mt-0.5 shrink-0 text-cyan-300" />
          )}
          <p className="font-mono2 text-[12.5px] leading-relaxed text-slate-200">
            {t.text}
          </p>
        </div>
      ))}
    </div>
  );
}
