import { streamChat } from "../../../lib/grok";
import { jsonError, readJson, requireSession } from "../../../lib/guard";

export const runtime = "nodejs";

export async function POST(request) {
  const denied = requireSession(request, { mutation: true });
  if (denied) return denied;

  const body = await readJson(request);
  if (!body) return jsonError("Invalid request body.");

  try {
    const upstream = await streamChat({ messages: body.messages, model: body.model });
    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to contact Grok.", 502);
  }
}
