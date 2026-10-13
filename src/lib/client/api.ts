"use client";

/** Client-only types + SSE plumbing for the orchestrator UI. */

export interface AgentSlot {
  id: string;
  displayName: string;
  model: string;
  accent: string;
  glyph: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AgentResult {
  agentId: string;
  agentName: string;
  model: string;
  content: string;
  usage: TokenUsage;
  costUsd: number;
  latencyMs: number;
  success: boolean;
  error?: string;
  fallback?: boolean;
  agent?: AgentSlot;
}

export type AgentLiveStatus = "pending" | "success" | "error";

export interface AgentLive {
  slot: AgentSlot;
  status: AgentLiveStatus;
  result?: AgentResult;
}

export type RunPhase = "fanout" | "synthesizing" | "complete" | "failed";

export interface RunTotals {
  latencyMs: number;
  totalTokens: number;
  costUsd: number;
  succeeded: number;
  attempted: number;
}

export interface LiveRun {
  key: string; // unique per run (client-side)
  query: string;
  agents: AgentLive[];
  phase: RunPhase;
  synthesizerId: string;
  synthMeta?: { agentName: string; basedOn: string[] };
  synthesis?: AgentResult;
  totals?: RunTotals;
  runId?: string;
  status?: "completed" | "partial" | "failed";
  startedAt: number;
  readonly?: boolean;
}

export interface SanitizedAgent {
  id: string;
  displayName: string;
  provider: string;
  enabled: boolean;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  accent: string;
  glyph: string;
  isCore: boolean;
  requiresKey: boolean;
  keySource: "db" | "env" | "none";
  keyPreview: string | null;
  pricing: { input: number; output: number };
}

export interface AgentsResponse {
  agents: SanitizedAgent[];
  synthesizer: string;
  armed: number;
  total: number;
}

export interface MetricsData {
  totalRuns: number;
  totalCostUsd: number;
  totalTokens: number;
  avgLatencyMs: number;
  agentsUsed: number;
  perAgent: {
    agentId: string;
    displayName: string;
    accent: string;
    calls: number;
    successes: number;
    avgLatencyMs: number;
    tokens: number;
    costUsd: number;
    successRate: number;
  }[];
  recent: { id: string; tokens: number; costUsd: number; status: string }[];
}

export interface RunSummary {
  id: string;
  query: string;
  status: string;
  agentsUsed: number;
  agentsSucceeded: number;
  totalLatencyMs: number;
  totalTokens: number;
  totalCostUsd: number;
  createdAt: string;
}

export interface RunDetail {
  run: {
    id: string;
    query: string;
    synthesis: string | null;
    synthesizerId: string | null;
    status: string;
    totalLatencyMs: number;
    totalTokens: number;
    totalCostUsd: number;
    createdAt: string;
  };
  responses: {
    id: string;
    agentId: string;
    agentName: string;
    model: string;
    role: string;
    content: string;
    latencyMs: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
    success: boolean;
    error: string | null;
  }[];
}

/** Parse an SSE payload into discrete {event, data} messages. */
export async function streamSSE(
  res: Response,
  onMessage: (event: string, data: unknown) => void,
): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Streaming not supported");
  const decoder = new TextDecoder();
  let buffer = "";

  const flush = (chunk: string) => {
    // SSE frames are separated by a blank line
    const frames = chunk.split("\n\n");
    for (const frame of frames) {
      if (!frame.trim()) continue;
      let event = "message";
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      try {
        onMessage(event, JSON.parse(data));
      } catch {
        /* malformed frame */
      }
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      if (buffer.trim()) flush(buffer);
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lastBoundary = buffer.lastIndexOf("\n\n");
    if (lastBoundary >= 0) {
      const ready = buffer.slice(0, lastBoundary + 2);
      buffer = buffer.slice(lastBoundary + 2);
      flush(ready);
    }
  }
}
