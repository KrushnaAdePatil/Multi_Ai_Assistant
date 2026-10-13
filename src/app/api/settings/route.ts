import { DEFINITION_BY_ID } from "@/lib/agents/definitions";
import { getSynthesizerId, setSynthesizerId } from "@/lib/server/config";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ synthesizer: await getSynthesizerId() });
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as { synthesizer?: string };
    const id = body.synthesizer ?? "";
    if (!DEFINITION_BY_ID.has(id)) {
      return NextResponse.json(
        { error: "Unknown synthesizer" },
        { status: 400 },
      );
    }
    await setSynthesizerId(id);
    return NextResponse.json({ ok: true, synthesizer: id });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
