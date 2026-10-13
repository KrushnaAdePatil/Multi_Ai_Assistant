import { callAgent } from "@/lib/agents/adapters";
import { DEFINITION_BY_ID } from "@/lib/agents/definitions";
import { getResolvedAgents } from "@/lib/server/config";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Ping a single agent with a 1-token probe to verify keys/endpoint. */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!DEFINITION_BY_ID.has(id)) {
    return NextResponse.json({ error: "Unknown agent" }, { status: 404 });
  }
  const agents = await getResolvedAgents();
  const agent = agents.find((a) => a.id === id);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  const result = await callAgent(
    { ...agent, maxTokens: Math.min(agent.maxTokens, 16), timeoutMs: Math.min(agent.timeoutMs, 20000) },
    [
      {
        role: "user",
        content: "Reply with exactly the word: ONLINE",
      },
    ],
  );
  return NextResponse.json({
    ok: result.success,
    model: result.model,
    latencyMs: result.latencyMs,
    preview: result.content.slice(0, 60),
    error: result.error,
  });
}
