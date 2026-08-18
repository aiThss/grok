import { NextResponse } from "next/server";
import { SESSION_COOKIE, passwordIsConfigured, verifySession } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function GET(request) {
  return NextResponse.json({
    authenticated: verifySession(request.cookies.get(SESSION_COOKIE)?.value),
    passwordConfigured: passwordIsConfigured(),
  });
}
