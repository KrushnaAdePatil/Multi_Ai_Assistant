import { db } from "@/db";
import { runResponses, runs } from "@/db/schema";
import { callAgent, fanOutAll } from "./adapters";
import type {
  AgentCallResult,
  AgentSlot,
  OrchestrationEvent,
  ResolvedAgentConfig,
} from "./types";
import type { ChatMessage } from "./adapters";

const AGENT_SYSTEM_PROMPT = `You are an agent inside a multi-model AI orchestrator. The same user question is being answered in parallel by several other frontier models. Give your best, most decisive answer: be correct, specific, and complete, but tightly written (markdown is fine). Do not mention other models or that you are part of an ensemble.`;

const SYNTH_SYSTEM_PROMPT = `You are the Synthesizer — the final arbiter in a multi-agent AI orchestrator. Several independent AI models each answered the same user question. Your job is to fuse their answers into ONE optimal, definitive response.

Rules:
- Take the best parts of each answer; discard wrong, redundant, or filler material.
- If answers conflict, decide which is most likely correct and briefly note the reconciliation if it matters.
- Keep what's genuinely useful; never pad. Match or beat the quality of the best single answer.
- Answer in clean, well-structured markdown (headings/lists/code only when they help).
- Never mention "the models", "agents", "answers above", or the synthesis process itself — the reader wants THE answer, not a report about answers.`;

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}\n…[truncated]` : s;
}

function buildSynthesisPrompt(
  query: string,
  successes: AgentCallResult[],
): string {
  const blocks = successes
    .map(
      (r, i) => `### Answer ${i + 1} (model family: ${r.agentName})
${truncate(r.content, 6000)}`,
    )
    .join("\n\n");
  return `USER QUESTION:
${query}

---

CANDIDATE ANSWERS FROM INDEPENDENT MODELS:
${blocks}

---

Produce the single best possible answer to the USER QUESTION now.`;
}

function slot(r: ResolvedAgentConfig): AgentSlot {
  return {
    id: r.id,
    displayName: r.displayName,
    model: r.model,
    accent: r.accent,
    glyph: r.glyph,
  };
}

/** Pick the synthesizer: configured id first, else first runnable core agent. */
export function pickSynthesizer(
  agents: ResolvedAgentConfig[],
  preferred: string,
): ResolvedAgentConfig | null {
  const pref = agents.find((a) => a.id === preferred);
  if (pref) return pref;
  return agents.find((a) => a.isCore) ?? agents[0] ?? null;
}

type Emit = (event: OrchestrationEvent) => void;

/**
 * Run a full orchestration: fan the query out to every enabled agent in
 * parallel, stream per-agent events, synthesize the verdict, persist to the
 * database, and emit the final summary. Never throws.
 */
export async function runOrchestration(args: {
  query: string;
  agents: ResolvedAgentConfig[]; // enabled agents for this run
  synthesizer: ResolvedAgentConfig | null;
  emit: Emit;
}): Promise<void> {
  const { query, agents, synthesizer, emit } = args;
  const startedAt = Date.now();

  emit({
    event: "run_start",
    data: {
      query,
      agents: agents.map(slot),
      synthesizerId: synthesizer?.id ?? "",
    },
  });

  const messages: ChatMessage[] = [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
    { role: "user", content: query },
  ];

  /* ---------------- fan-out in parallel ---------------- */
  const results = await fanOutAll(agents, messages, (result, cfg) => {
    emit({
      event: "agent_result",
      data: { ...result, agent: slot(cfg) },
    });
  });

  const successes = results.filter((r) => r.success).slice(0, 12);

  /* ---------------- synthesis ---------------- */
  let synthesis: (AgentCallResult & { fallback?: boolean }) | null = null;

  if (successes.length > 0 && synthesizer) {
    emit({
      event: "synthesis_start",
      data: {
        synthesizerId: synthesizer.id,
        agentName: synthesizer.displayName,
        basedOn: successes.map((s) => s.agentId),
      },
    });

    if (successes.length === 1) {
      // Only one voice survived — it IS the answer.
      synthesis = { ...successes[0], fallback: true };
    } else {
      const synthMessages: ChatMessage[] = [
        { role: "system", content: SYNTH_SYSTEM_PROMPT },
        { role: "user", content: buildSynthesisPrompt(query, successes) },
      ];
      let synthResult = await callAgent(synthesizer, synthMessages);

      if (!synthResult.success) {
        // Retry once with the fastest successful agent as synthesizer.
        const backup = agents.find((a) =>
          successes.some((s) => s.agentId === a.id),
        );
        if (backup && backup.id !== synthesizer.id) {
          const retry = await callAgent(backup, synthMessages);
          if (retry.success) synthResult = retry;
        }
      }

      if (synthResult.success) {
        synthesis = synthResult;
      } else {
        // Graceful degradation: surface the strongest single answer.
        const best = [...successes].sort(
          (a, b) => b.content.length - a.content.length,
        )[0];
        synthesis = {
          ...best,
          content: best.content,
          fallback: true,
        };
      }
    }
    emit({ event: "synthesis_result", data: synthesis });
  }

  /* ---------------- totals + persistence ---------------- */
  const all = synthesis ? [...results, synthesis] : results;
  const totalTokens = all.reduce((sum, r) => sum + r.usage.totalTokens, 0);
  const costUsd = all.reduce((sum, r) => sum + r.costUsd, 0);
  const status: "completed" | "partial" | "failed" =
    successes.length === 0
      ? "failed"
      : successes.length === agents.length
        ? "completed"
        : "partial";

  let runId = "";
  try {
    runId = await persist({
      query,
      results,
      synthesis,
      synthesizerId: synthesizer?.id ?? null,
      status,
      totalLatencyMs: Date.now() - startedAt,
      totalTokens,
      costUsd,
    });
  } catch {
    // Persistence failure must not kill the stream.
  }

  emit({
    event: "done",
    data: {
      runId,
      status,
      totals: {
        latencyMs: Date.now() - startedAt,
        totalTokens,
        costUsd,
        succeeded: successes.length,
        attempted: agents.length,
      },
    },
  });
}

async function persist(args: {
  query: string;
  results: AgentCallResult[];
  synthesis: (AgentCallResult & { fallback?: boolean }) | null;
  synthesizerId: string | null;
  status: string;
  totalLatencyMs: number;
  totalTokens: number;
  costUsd: number;
}): Promise<string> {
  const [run] = await db
    .insert(runs)
    .values({
      query: args.query,
      synthesis: args.synthesis?.content ?? null,
      synthesizerId: args.synthesizerId,
      status: args.status,
      agentsUsed: args.results.length,
      agentsSucceeded: args.results.filter((r) => r.success).length,
      totalLatencyMs: args.totalLatencyMs,
      totalTokens: args.totalTokens,
      totalCostUsd: args.costUsd,
    })
    .returning({ id: runs.id });

  const rows = [
    ...args.results.map((r) => ({
      runId: run.id,
      agentId: r.agentId,
      agentName: r.agentName,
      model: r.model,
      role: "agent",
      content: r.content,
      latencyMs: r.latencyMs,
      promptTokens: r.usage.promptTokens,
      completionTokens: r.usage.completionTokens,
      totalTokens: r.usage.totalTokens,
      costUsd: r.costUsd,
      success: r.success,
      error: r.error ?? null,
    })),
    ...(args.synthesis
      ? [
          {
            runId: run.id,
            agentId: args.synthesizerId ?? "synthesizer",
            agentName: "Synthesis",
            model: args.synthesis.model,
            role: "synthesizer",
            content: args.synthesis.content,
            latencyMs: args.synthesis.latencyMs,
            promptTokens: args.synthesis.usage.promptTokens,
            completionTokens: args.synthesis.usage.completionTokens,
            totalTokens: args.synthesis.usage.totalTokens,
            costUsd: args.synthesis.costUsd,
            success: true,
            error: null,
          },
        ]
      : []),
  ];
  await db.insert(runResponses).values(rows);
  return run.id;
}
