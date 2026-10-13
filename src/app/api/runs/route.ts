import { db } from "@/db";
import { runs } from "@/db/schema";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: runs.id,
        query: runs.query,
        status: runs.status,
        agentsUsed: runs.agentsUsed,
        agentsSucceeded: runs.agentsSucceeded,
        totalLatencyMs: runs.totalLatencyMs,
        totalTokens: runs.totalTokens,
        totalCostUsd: runs.totalCostUsd,
        createdAt: runs.createdAt,
      })
      .from(runs)
      .orderBy(desc(runs.createdAt))
      .limit(50);
    return NextResponse.json({ runs: rows });
  } catch {
    return NextResponse.json({ runs: [] });
  }
}
