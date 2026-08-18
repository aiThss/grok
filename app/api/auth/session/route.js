import { NextResponse } from "next/server";
import { SESSION_COOKIE, authConfigurationError, passwordIsConfigured, verifySession } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function GET(request) {
  const configurationError = authConfigurationError();
  return NextResponse.json({
    authenticated: configurationError ? false : verifySession(request.cookies.get(SESSION_COOKIE)?.value),
    passwordConfigured: passwordIsConfigured(),
    configurationError,
  });
}
