import { NextResponse } from "next/server";
import { listFiles } from "../../../../lib/github";
import { requireSession } from "../../../../lib/guard";

export const runtime = "nodejs";

export async function GET(request) {
  const denied = requireSession(request);
  if (denied) return denied;
  const repo = new URL(request.url).searchParams.get("repo");
  if (!repo) return NextResponse.json({ error: "repo is required." }, { status: 400 });

  try {
    return NextResponse.json({ files: await listFiles(repo) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load repository files." }, { status: 502 });
  }
}
