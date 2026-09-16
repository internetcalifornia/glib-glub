# Deployment

_Operator runbook: what runs, what it needs, and how to get from nothing to a working platform._

## What runs

| Process         | Image                          | Port | Needs                                                      |
| --------------- | ------------------------------ | ---- | ---------------------------------------------------------- |
| `web`           | `<ns>/glib-glub-web`           | 3000 | Postgres, `AUTH_SECRET`, `APP_ORIGIN`, the gateway's URL   |
| `voice-gateway` | `<ns>/glib-glub-voice-gateway` | 8787 | Postgres, the same `AUTH_SECRET`, Azure AI Foundry         |
| `migrate`       | `<ns>/glib-glub-migrate`       | —    | Postgres. Runs pending migrations (seeds included), exits. |

`ci.yml` pushes the three images to Docker Hub on every push to `main`, tagged `latest` and with the version in `apps/web/package.json`. Repository secrets: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`; optional variable `DOCKERHUB_NAMESPACE`.

## Prerequisites

- Docker and Docker Compose, or any host that runs the three images.
- Postgres 17 (the production compose file runs one).
- An **Azure AI Foundry** resource with the Voice Live API enabled. Either an API key (`AZURE_FOUNDRY_API_KEY`) or a managed identity holding the `Cognitive Services User` and `Foundry User` roles on the resource (the gateway uses `DefaultAzureCredential` when no key is set). A chat deployment (default name `gpt-4.1-mini`) for grading, summaries and upload extraction. The same endpoint and key serve Content Safety, which screens uploads and transcripts; without a key nothing is screened — fine on a laptop, not in production.
- OAuth apps, each with the callback `https://<your-host>/api/auth/callback/<provider>`:
  - Google: OAuth client (web) in Google Cloud Console.
  - Microsoft: app registration in Entra ID; `MICROSOFT_TENANT_ID` is `common` for any account, or your tenant id.
  - Facebook: app in Meta for Developers with Facebook Login.
    A provider whose two variables are empty is simply not offered on the sign-in page.
- An Azure Storage account (or Azurite locally) for uploads; leave `AZURE_STORAGE_CONNECTION_STRING` empty to keep uploads on local disk (development only).

## Environment

Copy `.env.example` to `.env` and fill it in. Every variable is validated at startup by `packages/config`; a missing or malformed one aborts boot with every offending variable named.

Two variables must be identical in `web` and `voice-gateway`: `DATABASE_URL` and **`AUTH_SECRET`**. The web app signs a short-lived gateway ticket with the secret and the gateway verifies it; that is how the browser proves who it is on a WebSocket the session cookie does not reach.

The browser connects to `VOICE_GATEWAY_URL` directly, so it must be a URL the browser can reach (`wss://voice.<your-host>` behind TLS in production), and the gateway must be reachable from the public internet on that address. Audio itself flows browser ↔ Azure over WebRTC; the gateway carries only the control channel.

## First deploy

```bash
export DOCKERHUB_NAMESPACE=<ns> POSTGRES_PASSWORD=<strong>
docker compose -f docker-compose.yaml run --rm migrate
docker compose -f docker-compose.yaml up -d
curl -fsS http://localhost:3000/api/health
curl -fsS http://localhost:8787/health
```

`/api/health` answers 503 with the list of pending migrations until the schema matches the build; the gateway's `/health` answers 503 while the database is unreachable or migrations are pending. Both are wired as container healthchecks in the Dockerfile.

After the first deploy, sign up, open **Settings**, pick an age band, and — if you author content — register as an educator and create an MCP key. Point an MCP client at `https://<your-host>/api/mcp` with `Authorization: Bearer <key>`.

## Upgrades

Pull the new tags, run `migrate` again, then `up -d`. Migrations are additive and recorded in Kysely's ledger; seeds ship as migrations (Decision #7), so a new track arrives with the schema it depends on. The runner allows a schema migration numbered below an already-applied seed.

## Running without Azure

Set `VOICE_LIVE_FAKE=1` on the gateway: it starts an in-process fake Voice Live server that answers the call negotiation and echoes nothing useful, which is enough to exercise the session page, the transcript plumbing and the tool dispatch. Leave `AZURE_FOUNDRY_*` empty and summaries are derived from the session record rather than written by a model.

## Local development

```bash
pnpm install
cp .env.example .env            # DATABASE_URL, APP_ORIGIN, AUTH_SECRET at minimum
docker compose up -d postgres azurite
pnpm db:migrate
pnpm dev                        # apps/web on http://localhost:3000
VOICE_LIVE_FAKE=1 pnpm --filter voice-gateway dev   # ws://localhost:8787
```

The integration tier (`pnpm test:integration`) needs `DATABASE_URL` pointing at a database you are happy to have emptied between tests; it runs one package at a time because every package shares that database.
