import { completeChat } from "../../../lib/grok";
import { jsonError, readJson, requireSession } from "../../../lib/guard";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request) {
  const denied = requireSession(request, { mutation: true });
  if (denied) return denied;

  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body.");

  try {
    const content = await completeChat({ messages: body.messages, model: body.model });
    return NextResponse.json({ content });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to contact Grok.", 502);
  }
}
