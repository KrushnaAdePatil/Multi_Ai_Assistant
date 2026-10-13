import { db } from "@/db";
import { runResponses, runs } from "@/db/schema";
import { DEFINITION_BY_ID } from "@/lib/agents/definitions";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const allRuns = await db
      .select()
      .from(runs)
      .orderBy(desc(runs.createdAt))
      .limit(200);

    const perAgentRows = await db
      .select()
      .from(runResponses)
      .where(eq(runResponses.role, "agent"));

    const byAgent = new Map<
      string,
      {
        agentId: string;
        calls: number;
        successes: number;
        tokens: number;
        costUsd: number;
        latencyTotal: number;
      }
    >();
    for (const r of perAgentRows) {
      const entry =
        byAgent.get(r.agentId) ??
        {
          agentId: r.agentId,
          calls: 0,
          successes: 0,
          tokens: 0,
          costUsd: 0,
          latencyTotal: 0,
        };
      entry.calls += 1;
      if (r.success) entry.successes += 1;
      entry.tokens += r.totalTokens;
      entry.costUsd += r.costUsd;
      entry.latencyTotal += r.latencyMs;
      byAgent.set(r.agentId, entry);
    }

    const perAgent = [...byAgent.values()].map((a) => {
      const def = DEFINITION_BY_ID.get(a.agentId);
      return {
        agentId: a.agentId,
        displayName: def?.displayName ?? a.agentId,
        accent: def?.accent ?? "#64748b",
        calls: a.calls,
        successes: a.successes,
        avgLatencyMs: a.calls ? Math.round(a.latencyTotal / a.calls) : 0,
        tokens: a.tokens,
        costUsd: a.costUsd,
        successRate: a.calls ? a.successes / a.calls : 0,
      };
    });

    const completedRuns = allRuns.filter((r) => r.status !== "running");
    const totalCost = allRuns.reduce((s, r) => s + r.totalCostUsd, 0);
    const totalTokens = allRuns.reduce((s, r) => s + r.totalTokens, 0);
    const avgLatency =
      completedRuns.length > 0
        ? Math.round(
            completedRuns.reduce((s, r) => s + r.totalLatencyMs, 0) /
              completedRuns.length,
          )
        : 0;

    // Recent activity: last 12 runs, oldest→newest, for the sparkline.
    const recent = [...allRuns]
      .slice(0, 12)
      .reverse()
      .map((r) => ({
        id: r.id,
        tokens: r.totalTokens,
        costUsd: r.totalCostUsd,
        status: r.status,
      }));

    return NextResponse.json({
      totalRuns: allRuns.length,
      totalCostUsd: totalCost,
      totalTokens,
      avgLatencyMs: avgLatency,
      agentsUsed: Math.max(...perAgent.map((p) => p.calls), 0) > 0 ? perAgent.length : 0,
      perAgent,
      recent,
    });
  } catch {
    return NextResponse.json({
      totalRuns: 0,
      totalCostUsd: 0,
      totalTokens: 0,
      avgLatencyMs: 0,
      agentsUsed: 0,
      perAgent: [],
      recent: [],
    });
  }
}
