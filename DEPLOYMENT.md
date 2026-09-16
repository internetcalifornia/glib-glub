# Deployment

_Operator runbook. Expanded as the apps land; the shape below is what CI already publishes._

## Prerequisites

- Docker and Docker Compose.
- A Postgres 17 instance (the production compose file runs one).
- An Azure AI Foundry resource with the Voice Live API enabled, and either an API key or a managed identity holding the `Cognitive Services User` and `Foundry User` roles.
- OAuth apps for Google, Microsoft Entra ID and Facebook, each with the callback `https://<your-host>/api/auth/callback/<provider>`.

## Environment

Copy `.env.example` to `.env` and fill it in. Every variable is validated at startup by `packages/config`; a missing or malformed one aborts boot with the variable named.

## Published images

`ci.yml` pushes three images to Docker Hub on every push to `main`, tagged `latest` and with the version in `apps/web/package.json`:

| Image                          | Dockerfile target | Runs                                            |
| ------------------------------ | ----------------- | ----------------------------------------------- |
| `<ns>/glib-glub-web`           | `web`             | `pnpm --filter web start` on :3000              |
| `<ns>/glib-glub-voice-gateway` | `voice-gateway`   | `pnpm --filter voice-gateway start` on :8787    |
| `<ns>/glib-glub-migrate`       | `migrate`         | `node packages/db/dist/migrate.cjs`, then exits |

Secrets required in the GitHub repository: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`; optional variable `DOCKERHUB_NAMESPACE`.

## First deploy

```bash
export DOCKERHUB_NAMESPACE=<ns> POSTGRES_PASSWORD=<strong>
docker compose -f docker-compose.yaml run --rm migrate
docker compose -f docker-compose.yaml up -d
curl -fsS http://localhost:3000/api/health
```

`/api/health` answers 503 with the list of pending migrations until the schema matches the build.

## Upgrades

Pull the new tag, run `migrate` again, then `up -d`. Migrations are additive and idempotent per Kysely's ledger.
