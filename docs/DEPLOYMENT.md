# Deploy on Dokploy

## 1. Prepare secrets

Create the following in Dokploy's secret/environment configuration. Do not add a real `.env` file to Git.

```text
WEBUI_URL=https://chat.example.com
CORS_ALLOW_ORIGIN=https://chat.example.com
WEBUI_SESSION_COOKIE_SECURE=true
WEBUI_SECRET_KEY=<openssl rand -hex 32>

WEBUI_ADMIN_NAME=Admin
WEBUI_ADMIN_EMAIL=<administrator email>
WEBUI_ADMIN_PASSWORD=<long unique password>
ENABLE_SIGNUP=false
DEFAULT_USER_ROLE=pending

OPENAI_API_BASE_URL=https://gateway.example.com/v1
OPENAI_API_KEY=<least-privilege provider key>
OPENAI_API_CONFIGS={"0":{"enable":true,"prefix_id":"ai","model_ids":["your-model-id"]}}
ENABLE_OPENAI_API_PASSTHROUGH=false

ENABLE_VALVE_ENCRYPTION=true
ENABLE_PERSISTENT_CONFIG=true
```

Set `WEBUI_URL` and `CORS_ALLOW_ORIGIN` to the exact public HTTPS address before the first boot. Add every intentional browser origin, separated with semicolons, only if more than one domain is required.

## 2. Create the application

1. In Dokploy, create an **Application** from this Git repository using **Dockerfile** build mode.
2. Set the exposed application/container port to **8080**.
3. Add persistent storage with mount path **`/app/backend/data`**. This mount is mandatory.
4. Add the environment variables above as secrets; do not put them in build arguments or browser-visible variables.
5. Add the public domain, enable HTTPS, then deploy.

The Dockerfile uses a pinned upstream image. To upgrade, update `OPEN_WEBUI_VERSION` deliberately, deploy to staging first, take a backup, then promote the same tested version to production.

## 3. Reverse-proxy requirements

Dokploy's proxy/domain configuration must:

- terminate HTTPS and forward to port 8080;
- pass WebSocket `Upgrade` and `Connection` headers;
- disable response buffering for streamed Server-Sent Events;
- allow a read timeout of at least 300 seconds for slow model responses;
- avoid exposing a separate direct host port to the public internet.

## 4. First-run procedure

1. Open the public `WEBUI_URL` and sign in with `WEBUI_ADMIN_EMAIL`/`WEBUI_ADMIN_PASSWORD`.
2. In **Admin Settings → Connections → OpenAI**, verify the configured gateway and restrict the visible models to the approved model IDs.
3. Send a short test prompt and confirm streaming completes.
4. Restart/redeploy the application without deleting its persistent storage; confirm that the admin account, configuration, and test chat remain.
5. Keep signup closed. When shared access is needed, create users or enable signup later with `DEFAULT_USER_ROLE=pending` so an administrator approves every account.

## 5. Validate and monitor

```bash
# Public service and database initialized
curl -fsS https://chat.example.com/health

# After creating a dedicated monitoring account/API key, also test models
curl -fsS https://chat.example.com/api/models \\
  -H "Authorization: Bearer <monitoring-api-key>"
```

Use `/health` for liveness and the authenticated `/api/models` check to detect a provider outage that would not affect the login page.

## 6. Backup and recovery

Back up the complete mounted data directory before every version update and at least daily. It includes `webui.db`, uploads, vector data, cache, and audit information. Encrypt backups and test a restore into an isolated staging instance. Never share a production data volume with a `:dev` image.

## 7. Local alternative

For a server you administer directly, copy `.env.example` to `.env`, fill in secrets, then run:

```bash
docker compose up -d --build
```

The supplied compose file binds to `127.0.0.1:3000` by default; put a TLS-capable reverse proxy in front of it. Do not change it to a public bind address without completing the HTTPS, CORS, and firewall controls above.
