import { pickSynthesizer, runOrchestration } from "@/lib/agents/orchestrator";
import type { OrchestrationEvent } from "@/lib/agents/types";
import { getResolvedAgents, getSynthesizerId } from "@/lib/server/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/orchestrate { query }
 * Streams Server-Sent Events: run_start → agent_result×N →
 * synthesis_start → synthesis_result → done
 */
export async function POST(req: Request) {
  let query = "";
  try {
    const body = (await req.json()) as { query?: string };
    query = (body.query ?? "").trim();
  } catch {
    query = "";
  }
  if (!query || query.length > 8000) {
    return Response.json(
      { error: "Query must be 1–8000 characters" },
      { status: 400 },
    );
  }

  const allAgents = await getResolvedAgents();
  const enabled = allAgents.filter((a) => a.enabled);
  if (enabled.length === 0) {
    return Response.json(
      { error: "No agents are enabled. Arm at least one agent in Settings." },
      { status: 409 },
    );
  }

  const preferredSynth = await getSynthesizerId();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const emit = (ev: OrchestrationEvent) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${ev.event}\ndata: ${JSON.stringify(ev.data)}\n\n`,
            ),
          );
        } catch {
          closed = true;
        }
      };

      try {
        const synthesizer = pickSynthesizer(enabled, preferredSynth);
        await runOrchestration({ query, agents: enabled, synthesizer, emit });
      } catch (e) {
        emit({
          event: "error",
          data: {
            message:
              e instanceof Error ? e.message : "Orchestration crashed",
          },
        });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
