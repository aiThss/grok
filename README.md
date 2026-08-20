# Web Chat

This repository deploys [Open WebUI](https://github.com/open-webui/open-webui), an upstream self-hosted chat interface for OpenAI-compatible APIs and local Ollama models. It deliberately does **not** copy or fork Open WebUI source code: Docker pulls a pinned official image while this repository keeps deployment configuration, documentation, and operational decisions under version control.

## Initial scope

- Private, multi-user web chat behind HTTPS.
- One or more OpenAI-compatible model gateways (including a Grok-compatible gateway).
- Persistent chat, account, upload, and vector data at `/app/backend/data`.
- Closed sign-up and a bootstrap administrator.
- No public sharing, model-provider passthrough, MCP, arbitrary tools, web search, RAG ingestion, or bundled Ollama in the first release.

Those optional features expand the attack surface or the operating cost. Enable them only after the core chat flow is stable.

## Repository contents

- `Dockerfile` — wraps a pinned official Open WebUI image.
- `docker-compose.yml` — local or self-managed single-node deployment.
- `.env.example` — complete first-start configuration template without secrets.
- `docs/DEPLOYMENT.md` — Dokploy production procedure and verification checklist.
- `docs/IMPLEMENTATION_PLAN.md` — research outcome, architecture, and staged roadmap.

## Quick local validation

1. Copy `.env.example` to `.env` and replace every placeholder with real, private values.
2. Run `docker compose up -d --build`.
3. Open `http://127.0.0.1:3000`, sign in with the bootstrap administrator, and add/verify the model provider.

For a public deployment, use the Dokploy procedure and HTTPS configuration in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Never commit `.env`, API keys, database snapshots, or `/app/backend/data`.

## Upstream and licensing

Open WebUI is an upstream product with its own license and branding requirements. Before customising its UI or distributing a modified build, review the current [Open WebUI license](https://github.com/open-webui/open-webui/blob/main/LICENSE) and keep the required attribution/branding.
