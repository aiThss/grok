import { NextResponse } from "next/server";
import { defaultModel, listModels } from "../../../lib/grok";
import { requireSession } from "../../../lib/guard";

export const runtime = "nodejs";

export async function GET(request) {
  const denied = requireSession(request);
  if (denied) return denied;

  try {
    const models = await listModels();
    return NextResponse.json({ models, defaultModel: defaultModel() });
  } catch (error) {
    console.error("[models] gateway check failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load models." }, { status: 502 });
  }
}
