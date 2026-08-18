import { NextResponse } from "next/server";
import { generateImage } from "../../../lib/grok";
import { jsonError, readJson, requireSession } from "../../../lib/guard";

export const runtime = "nodejs";

export async function POST(request) {
  const denied = requireSession(request, { mutation: true });
  if (denied) return denied;
  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body.");

  try {
    return NextResponse.json({ images: await generateImage(body) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to generate an image.", 502);
  }
}
