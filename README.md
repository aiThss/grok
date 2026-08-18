# Grok Pocket

A private, mobile-first Grok workspace. It proxies the Grok API from the server, keeps secrets out of the browser, is installable as a PWA, and can create one atomic commit directly on `main` for a small set of GitHub repositories.

## Included

- Reliable Grok chat with local conversation history on the device
- Model picker populated from the configured OpenAI-compatible endpoint
- Image generation through `/v1/images/generations` when the gateway exposes an Imagine model
- Password-protected personal workspace
- Installable PWA for Android and iPhone
- GitHub workspace: select files, request a change, inspect the generated proposal, and commit directly to `main`
- Optional auto-push mode, enabled by default in the GitHub screen

The app does not expose either the Grok API key or GitHub token to the browser or APK. It does not execute shell commands or clone repositories.

## Grok2API gateway compatibility

Grok Pocket uses the OpenAI-compatible paths exposed by [Grok2API](https://github.com/chenyme/grok2api): `/v1/models`, `/v1/chat/completions`, and `/v1/images/generations`. Point `GROK_BASE_URL` at the gateway's `/v1` URL and set `GROK_API_KEY` to one of its client keys. The gateway keeps its account pools and provider credentials separate from Grok Pocket.

If no image-capable model is returned from `/v1/models`, the Images tab will report the gateway error rather than falling back to an unknown model.

## Local development

1. Copy `.env.example` to `.env.local`.
2. Fill every required secret with fresh values.
3. Run `npm install` and `npm run dev`.
4. Visit `http://localhost:3000`.

Use a new Grok key, not one pasted into chat history. Generate `SESSION_SECRET` with at least 32 random characters.

## GitHub direct-to-main setup

For this first version, create a **fine-grained personal access token** in GitHub:

1. Restrict it to only the repositories listed in `GITHUB_ALLOWED_REPOS`.
2. Give it **Contents: Read and write**.
3. Do not grant administration, secrets, actions, or organization permissions.
4. Put it in Dokploy as `GITHUB_TOKEN`; never in source code or a browser setting.

Set `GITHUB_BRANCH=main` for the intended branch. Each generated change is made through GitHub's Git Data API as one commit. The server checks the current `main` commit SHA before updating it, so it refuses to push if the branch changed after the AI generated its proposal.

The server deliberately blocks `.env`, `.npmrc`, `.git/`, and `.github/workflows/` paths. Remove or adjust that policy only after reviewing `lib/github.js`.

## Deploy with Dokploy

1. Push this folder to a private GitHub repository.
2. In Dokploy, create an **Application** from that repository and choose **Dockerfile** build mode.
3. Set the container port to `3000`.
4. Add your domain in Dokploy's Domains section and enable HTTPS.
5. Add the variables from `.env.example` in Dokploy's Environment section. Do not upload an `.env` file to the repository.
6. Deploy.

Required production variables:

```text
GROK_BASE_URL
GROK_API_KEY
GROK_DEFAULT_MODEL
APP_PASSWORD
SESSION_SECRET
```

Add `GITHUB_TOKEN`, `GITHUB_ALLOWED_REPOS`, and `GITHUB_BRANCH` to enable the GitHub tab.

### Required build argument for Next.js

In **Environment → Build Time Arguments**, add `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` with one persistent, Base64-encoded 32-byte value. Generate it once, save it in a password manager, and use that exact value for every redeploy:

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

This build argument prevents Next.js client/server build mismatches that can otherwise show `Failed to find Server Action` after a self-hosted deployment. Do not commit this value or add it to a browser-visible `NEXT_PUBLIC_` variable.

## Install on a phone

Open the HTTPS domain in Chrome on Android and choose **Install app** (or use the in-app `Cài app` button when available). On iPhone Safari, use **Share → Add to Home Screen**.

## Safety model

The GitHub action has no Pull Request stage by design. In auto-push mode it calls the model, builds an atomic commit, and updates `main` immediately. Turn off **Auto-push vào main** in the GitHub tab whenever you want a review step before pressing the direct push button.
