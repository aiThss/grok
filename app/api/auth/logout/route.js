import { NextResponse } from "next/server";
import { sessionCookie } from "../../../../lib/auth";
import { jsonError } from "../../../../lib/guard";

export const runtime = "nodejs";

export async function POST(request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return jsonError("Yêu cầu bị chặn do origin không hợp lệ.", 403);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie("", 0));
  return response;
}
