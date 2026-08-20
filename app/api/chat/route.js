import { completeChat } from "../../../lib/grok";
import { jsonError, readJson, requireSession } from "../../../lib/guard";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 100;

export async function POST(request) {
  const denied = requireSession(request, { mutation: true });
  if (denied) return denied;

  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body.");

  try {
    console.info("[chat] completion requested", {
      model: body.model || "default",
      messageCount: Array.isArray(body.messages) ? body.messages.length : 0,
    });
    const content = await completeChat({ messages: body.messages, model: body.model });
    console.info("[chat] completion completed", {
      model: body.model || "default",
      contentLength: content.length,
    });
    return NextResponse.json({ content });
  } catch (error) {
    console.error("[chat] completion failed", {
      model: body.model || "default",
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonError(error instanceof Error ? error.message : "Unable to contact Grok.", 502);
  }
}
