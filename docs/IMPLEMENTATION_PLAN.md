# Open WebUI web-chat: research and implementation plan

## Decision

Deploy the official Open WebUI container image, pinned to `v0.11.0`, instead of rebuilding the project from source. The current stable release is `v0.11.0`; its feature set includes multi-user accounts, RBAC, OpenAI-compatible providers, chat history, file/RAG capabilities, and a responsive PWA. Pinning avoids unexpected schema or behaviour changes from the floating `main`/`dev` image tags.

The application is a web-chat platform, not a thin frontend proxy. It owns accounts, chats, uploads, configuration, provider credentials stored by administrators, and optional vector data. Its persistent data directory is therefore a production dependency, not a cache.

## Target architecture

```text
Browser
  │ HTTPS + WebSocket/SSE
  ▼
Dokploy reverse proxy and TLS
  │ port 8080
  ▼
Open WebUI v0.11.0 container ─────► OpenAI-compatible gateway /v1
  │                                        └─► Grok or other selected models
  ▼
Persistent Dokploy volume: /app/backend/data
  ├─ accounts, chat history, configuration
  ├─ uploads
  ├─ vector database (when RAG is enabled)
  └─ audit/cache files
```

For the first release use one Open WebUI replica with its persistent volume. A future high-availability deployment must replace SQLite with PostgreSQL, add Redis, use shared object storage/vector infrastructure, and configure the same `WEBUI_SECRET_KEY` on every replica.

## First-release requirements

| Area | Decision |
| --- | --- |
| Image | `ghcr.io/open-webui/open-webui:v0.11.0` through this repository's Dockerfile |
| Network | HTTPS public domain; reverse proxy must support WebSockets, SSE, and at least 300-second read timeouts |
| Authentication | Local login, bootstrap admin only, `ENABLE_SIGNUP=false` |
| Provider | OpenAI-compatible endpoint ending in the correct API version path (normally `/v1`) |
| Provider access | Least-privilege API key and a model allowlist |
| Persistent state | Dokploy volume mounted at `/app/backend/data` |
| Backups | Encrypted copy of the full data volume before upgrades, then daily |
| Observability | `/health` liveness check; authenticated `/api/models` model-connectivity check |
| Excluded initially | public sharing, MCP/tools/functions, web search, RAG, image generation, voice, OAuth/SSO, Ollama |

## Environment decisions

Set the public URL, CORS origin, cookie security, and `WEBUI_SECRET_KEY` before the first production start. Open WebUI persists several configuration values in its database; later environment changes may appear ignored because the saved Admin-panel value takes precedence. Use the Admin panel for ordinary settings after bootstrapping, or deliberately use `ENABLE_PERSISTENT_CONFIG=false` only for a fully environment-managed deployment.

`WEBUI_SECRET_KEY` must be long, random, stored in Dokploy Secrets, and kept stable. Rotating it invalidates current sessions and makes existing encrypted provider/plugin credentials unreadable. `ENABLE_VALVE_ENCRYPTION=true` protects secret values stored for plugins/functions; do not enable untrusted plugins in the first release.

The provider URL must be the OpenAI-compatible base URL, including its API version. If a provider cannot answer `/models`, add its specific model IDs in the connection's allowlist from the Admin panel rather than exposing every upstream model.

## Staged implementation

1. **Foundation (this repository):** deploy the pinned official image, persistent storage, TLS domain, secrets, first admin, closed signup, one model gateway.
2. **Acceptance:** verify user sign-in, model discovery/allowlist, streamed response, reconnect, file upload disabled/unused, and persistence after a container recreation.
3. **Operations:** schedule backups, update only after staging, monitor `/health` and an authenticated `/api/models` request, retain deployment/application logs.
4. **Hardening:** restrict CORS to the production domain, use secure cookies, disable passthrough, review admin roles, limit provider keys, and apply security headers in report-only mode before enforcing CSP.
5. **Optional expansion:** enable RAG with capacity planning and backups; then consider SSO, web search, MCP/tools, object storage, PostgreSQL, Redis, and replicas as separate reviewed changes.

## Non-goals and risks

- This is not a license-free rebranding exercise; upstream license and branding obligations apply.
- A Docker container without the data volume loses chat history, accounts, uploads, and configuration when recreated.
- A reverse proxy without WebSocket support or correct CORS commonly produces chat connection failures even when the main page loads.
- Provider management/master keys must not be used for ordinary chat traffic.
- Do not expose Open WebUI's port directly to the internet when Dokploy's HTTPS proxy is available.
