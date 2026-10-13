/** Shared types for the multi-agent orchestration layer. */

export type ProviderId =
  | "openai-compatible"
  | "google"
  | "anthropic"
  | "azure"
  | "ollama";

/** Effective, fully-resolved config used to actually call a model. */
export interface ResolvedAgentConfig {
  id: string;
  displayName: string;
  provider: ProviderId;
  enabled: boolean;
  /** Resolved API key (DB override wins, env fallback). Empty = unconfigured. */
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  accent: string;
  glyph: string;
  isCore: boolean;
  keySource: "db" | "env" | "none";
  /** Whether this agent requires an API key to run (ollama does not). */
  requiresKey: boolean;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** Normalized result returned by every provider adapter. */
export interface AgentCallResult {
  agentId: string;
  agentName: string;
  model: string;
  content: string;
  usage: TokenUsage;
  costUsd: number;
  latencyMs: number;
  success: boolean;
  error?: string;
}

/** SSE event payloads streamed to the client during a run. */
export type OrchestrationEvent =
  | {
      event: "run_start";
      data: { query: string; agents: AgentSlot[]; synthesizerId: string };
    }
  | {
      event: "agent_result";
      data: AgentCallResult & { agent: AgentSlot };
    }
  | {
      event: "synthesis_start";
      data: { synthesizerId: string; agentName: string; basedOn: string[] };
    }
  | {
      event: "synthesis_result";
      data: AgentCallResult & { fallback?: boolean };
    }
  | {
      event: "done";
      data: {
        runId: string;
        status: "completed" | "partial" | "failed";
        totals: {
          latencyMs: number;
          totalTokens: number;
          costUsd: number;
          succeeded: number;
          attempted: number;
        };
      };
    }
  | { event: "error"; data: { message: string } };

export interface AgentSlot {
  id: string;
  displayName: string;
  model: string;
  accent: string;
  glyph: string;
}
