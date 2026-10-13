import { db } from "@/db";
import { runResponses, runs } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    const [run] = await db
      .select()
      .from(runs)
      .where(eq(runs.id, id))
      .limit(1);
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    const responses = await db
      .select()
      .from(runResponses)
      .where(eq(runResponses.runId, id))
      .orderBy(asc(runResponses.createdAt));
    return NextResponse.json({ run, responses });
  } catch {
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
