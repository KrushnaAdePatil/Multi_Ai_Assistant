import { getSanitizedAgents, getSynthesizerId } from "@/lib/server/config";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const agents = await getSanitizedAgents();
    const synthesizer = await getSynthesizerId();
    return NextResponse.json({
      agents,
      synthesizer,
      armed: agents.filter(
        (a) => a.enabled && (a.keySource !== "none" || !a.requiresKey),
      ).length,
      total: agents.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load agents" },
      { status: 500 },
    );
  }
}
