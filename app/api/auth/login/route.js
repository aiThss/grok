import { NextResponse } from "next/server";
import { createSession, passwordIsConfigured, sessionCookie, verifyPassword } from "../../../../lib/auth";
import { jsonError, readJson } from "../../../../lib/guard";

export const runtime = "nodejs";

export async function POST(request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return jsonError("Yêu cầu bị chặn do origin không hợp lệ.", 403);
  }
  if (!passwordIsConfigured()) {
    return jsonError("APP_PASSWORD has not been configured on the server.", 503);
  }

  const body = await readJson(request);
  if (!body || !verifyPassword(body.password)) {
    return jsonError("Mật khẩu không đúng.", 401);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie(createSession()));
  return response;
}
