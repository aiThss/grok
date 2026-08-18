import { NextResponse } from "next/server";
import { allowedRepositories, listRepositories } from "../../../../lib/github";
import { requireSession } from "../../../../lib/guard";

export const runtime = "nodejs";

export async function GET(request) {
  const denied = requireSession(request);
  if (denied) return denied;

  try {
    return NextResponse.json({ repositories: await listRepositories(), configured: allowedRepositories().length > 0 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load GitHub repositories." }, { status: 502 });
  }
}
