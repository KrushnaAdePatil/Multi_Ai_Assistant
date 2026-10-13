import { db } from "@/db";
import { agentConfigs } from "@/db/schema";
import { DEFINITION_BY_ID } from "@/lib/agents/definitions";
import { ensureSeeded, getSanitizedAgents } from "@/lib/server/config";
import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

interface PatchBody {
  enabled?: boolean;
  apiKey?: string | null; // "" clears the DB override → env fallback
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const def = DEFINITION_BY_ID.get(id);
  if (!def) {
    return NextResponse.json({ error: "Unknown agent" }, { status: 404 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  await ensureSeeded();
  const set: Partial<typeof agentConfigs.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (typeof body.enabled === "boolean") set.enabled = body.enabled;
  if (typeof body.apiKey === "string") {
    const k = body.apiKey.trim();
    set.apiKey = k === "" ? null : k;
  } else if (body.apiKey === null) {
    set.apiKey = null;
  }
  if (typeof body.baseUrl === "string") set.baseUrl = body.baseUrl.trim();
  if (typeof body.model === "string") set.model = body.model.trim();
  if (
    typeof body.temperature === "number" &&
    body.temperature >= 0 &&
    body.temperature <= 2
  )
    set.temperature = body.temperature;
  if (
    typeof body.maxTokens === "number" &&
    body.maxTokens >= 1 &&
    body.maxTokens <= 200000
  )
    set.maxTokens = Math.round(body.maxTokens);
  if (
    typeof body.timeoutMs === "number" &&
    body.timeoutMs >= 1000 &&
    body.timeoutMs <= 300000
  )
    set.timeoutMs = Math.round(body.timeoutMs);

  await db.update(agentConfigs).set(set).where(eq(agentConfigs.id, id));

  const agents = await getSanitizedAgents();
  return NextResponse.json({ ok: true, agent: agents.find((a) => a.id === id) });
}
