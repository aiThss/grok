import "server-only";

import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "./auth";

export function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function requireSession(request, { mutation = false } = {}) {
  if (!verifySession(request.cookies.get(SESSION_COOKIE)?.value)) {
    return jsonError("Bạn cần đăng nhập để thực hiện thao tác này.", 401);
  }

  if (mutation) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host && new URL(origin).host !== host) {
      return jsonError("Yêu cầu bị chặn do origin không hợp lệ.", 403);
    }
  }

  return null;
}

export function readJson(request) {
  return request.json().catch(() => null);
}
