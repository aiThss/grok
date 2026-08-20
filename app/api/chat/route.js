import { openChatStream } from "../../../lib/grok";
import { jsonError, readJson, requireSession } from "../../../lib/guard";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

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
    const stream = await openChatStream({ messages: body.messages, model: body.model });
    console.info("[chat] stream opened", {
      model: body.model || "default",
    });
    return new NextResponse(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[chat] completion failed", {
      model: body.model || "default",
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonError(error instanceof Error ? error.message : "Unable to contact Grok.", 502);
  }
}
