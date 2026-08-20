import "server-only";

import { completeJson, defaultModel } from "./grok";

const MAX_CHANGES = 20;
const BLOCKED_PATHS = [".env", ".env.local", ".npmrc", ".git/", ".github/workflows/"];

function token() {
  const value = process.env.GITHUB_TOKEN;
  if (!value) throw new Error("GitHub is not configured. Add GITHUB_TOKEN in Dokploy.");
  return value;
}

function configuredBranch() {
  return process.env.GITHUB_BRANCH || "main";
}

export function allowedRepositories() {
  return (process.env.GITHUB_ALLOWED_REPOS || "")
    .split(",")
    .map((repo) => repo.trim())
    .filter((repo) => /^[^/\s]+\/[^/\s]+$/.test(repo));
}

function assertAllowedRepository(repo) {
  if (!allowedRepositories().includes(repo)) {
    throw new Error("This repository is not in GITHUB_ALLOWED_REPOS.");
  }
}

function assertSafePath(path) {
  if (typeof path !== "string" || !path || path.length > 300 || path.startsWith("/") || path.includes("..")) {
    throw new Error("An invalid file path was supplied.");
  }
  if (BLOCKED_PATHS.some((blocked) => path === blocked || path.startsWith(blocked))) {
    throw new Error(`${path} is protected by the server policy.`);
  }
}

function repoParts(repo) {
  assertAllowedRepository(repo);
  const [owner, name] = repo.split("/");
  return { owner, name };
}

async function github(path, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token()}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub returned ${response.status}: ${detail.slice(0, 500)}`);
  }
  return response.status === 204 ? null : response.json();
}

async function getRepository(repo) {
  const { owner, name } = repoParts(repo);
  return github(`/repos/${owner}/${name}`);
}

async function getHead(repo, branch = configuredBranch()) {
  const { owner, name } = repoParts(repo);
  const ref = await github(`/repos/${owner}/${name}/git/ref/heads/${encodeURIComponent(branch)}`);
  const commit = await github(`/repos/${owner}/${name}/git/commits/${ref.object.sha}`);
  return { branch, commitSha: ref.object.sha, treeSha: commit.tree.sha };
}

export async function listRepositories() {
  return Promise.all(
    allowedRepositories().map(async (fullName) => {
      try {
        const repo = await getRepository(fullName);
        return { fullName, name: repo.name, branch: configuredBranch(), private: repo.private };
      } catch {
        return { fullName, name: fullName.split("/")[1], branch: configuredBranch(), unavailable: true };
      }
    }),
  );
}

export async function listFiles(repo) {
  const { owner, name } = repoParts(repo);
  const head = await getHead(repo);
  const tree = await github(`/repos/${owner}/${name}/git/trees/${head.treeSha}?recursive=1`);
  return tree.tree
    .filter((item) => item.type === "blob" && item.path && !item.path.startsWith(".git/"))
    .map((item) => item.path)
    .slice(0, 500);
}

async function readFile(repo, path, branch) {
  assertSafePath(path);
  const { owner, name } = repoParts(repo);
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const result = await github(`/repos/${owner}/${name}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`);
  if (Array.isArray(result) || result.type !== "file") throw new Error(`${path} is not a regular file.`);
  return {
    path,
    content: Buffer.from((result.content || "").replace(/\n/g, ""), "base64").toString("utf8"),
  };
}

function parseModelJson(text) {
  const unwrapped = text.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(unwrapped);
  } catch {
    throw new Error("The model did not return valid JSON. Please try again.");
  }
}

function validateChanges(rawChanges) {
  if (!Array.isArray(rawChanges) || rawChanges.length === 0 || rawChanges.length > MAX_CHANGES) {
    throw new Error(`The model must propose between 1 and ${MAX_CHANGES} changes.`);
  }

  return rawChanges.map((change) => {
    assertSafePath(change?.path);
    const action = change?.action === "delete" ? "delete" : "upsert";
    if (action === "upsert" && (typeof change?.content !== "string" || change.content.length > 500_000)) {
      throw new Error(`Invalid content for ${change.path}.`);
    }
    return { path: change.path, action, content: action === "delete" ? "" : change.content };
  });
}

export async function previewChanges({ repo, prompt, paths, model }) {
  if (typeof prompt !== "string" || prompt.trim().length < 3 || prompt.length > 10_000) {
    throw new Error("Describe the requested change in at least three characters.");
  }
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > 12) {
    throw new Error("Choose between 1 and 12 files for the AI to inspect.");
  }

  const head = await getHead(repo);
  const files = await Promise.all(paths.map((path) => readFile(repo, path, head.branch)));
  const request = { repository: repo, branch: head.branch, instruction: prompt, files };

  const raw = await completeJson({
    model: model || defaultModel(),
    messages: [
      {
        role: "system",
        content:
          "You modify a small software repository. Return only JSON with summary, commitMessage, and changes. Each change must have path, action (upsert or delete), and content for upsert. Preserve unrelated code. Only propose changes that satisfy the user request. Do not include markdown fences.",
      },
      { role: "user", content: JSON.stringify(request) },
    ],
  });
  const proposal = parseModelJson(raw);
  const changes = validateChanges(proposal.changes);

  return {
    repo,
    branch: head.branch,
    expectedHeadSha: head.commitSha,
    summary: typeof proposal.summary === "string" ? proposal.summary.slice(0, 1_000) : "Proposed repository changes.",
    commitMessage:
      typeof proposal.commitMessage === "string" && proposal.commitMessage.trim()
        ? proposal.commitMessage.trim().slice(0, 160)
        : "feat: apply Grok Pocket change",
    changes,
  };
}

export async function applyChanges({ repo, expectedHeadSha, commitMessage, changes }) {
  const head = await getHead(repo);
  if (head.commitSha !== expectedHeadSha) {
    throw new Error("main changed after the preview. Generate a fresh preview before pushing.");
  }
  const safeChanges = validateChanges(changes);
  const { owner, name } = repoParts(repo);

  const treeEntries = await Promise.all(
    safeChanges.map(async (change) => {
      if (change.action === "delete") {
        return { path: change.path, mode: "100644", type: "blob", sha: null };
      }
      const blob = await github(`/repos/${owner}/${name}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: change.content, encoding: "utf-8" }),
      });
      return { path: change.path, mode: "100644", type: "blob", sha: blob.sha };
    }),
  );

  const tree = await github(`/repos/${owner}/${name}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: head.treeSha, tree: treeEntries }),
  });
  const commit = await github(`/repos/${owner}/${name}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: String(commitMessage || "feat: update from Grok Pocket").slice(0, 160),
      tree: tree.sha,
      parents: [head.commitSha],
    }),
  });
  await github(`/repos/${owner}/${name}/git/refs/heads/${encodeURIComponent(head.branch)}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  return { sha: commit.sha, url: `https://github.com/${repo}/commit/${commit.sha}`, branch: head.branch };
}
