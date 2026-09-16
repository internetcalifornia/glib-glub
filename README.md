# glib-glub

A mobile-first learning platform built around a **voice-first AI tutor** — one you talk to, that builds on what you already know instead of giving you answers. Learners from kindergarten to lifelong learning; parents and educators alongside them; tracks authored in the app or over MCP.

See [`PLATFORM.md`](./PLATFORM.md) for the product plan and the numbered Decisions, and [`docs/`](./docs/README.md) for the as-built references.

## How it works

- **Voice tutor.** The browser streams audio over WebRTC to Azure Voice Live; `apps/voice-gateway` holds the credentialed control channel, assembles the tutor's instructions from the learner's profile and track, and executes the tutor's tool calls (present a problem, record an attempt, note a misconception) against the domain packages.
- **Personalisation.** Learners or guardians write a bio and upload prior work; the platform extracts it, summarises it, and keeps a versioned snapshot the tutor reads at session start. Each session ends with a summary the next one begins from.
- **Curriculum.** Categories → subjects → tracks → units → lessons, with pacing plans (daily/weekly) and enrollment. Tracks are educator-authored, MCP-authored, or self-directed from uploads.
- **Assessment.** Six question kinds (single choice, multi-select, true/false, fill-in-the-blank, short answer, long answer). Objective kinds auto-grade; open kinds are graded by an LLM rubric with an educator override that keeps an audit trail. Flashcards use SM-2 scheduling.
- **Safe coding.** Every fallible function returns a `Result` (`@campfhir/safe-functions`); `throw` is a lint error. See [`AGENTS.md`](./AGENTS.md).

## Getting started

Requirements: Node 24, pnpm 10, Docker (for Postgres and Azurite) — or a local Postgres.

```bash
pnpm install
cp .env.example .env            # DATABASE_URL, APP_ORIGIN, AUTH_SECRET at minimum
docker compose up -d postgres azurite
pnpm db:migrate                 # schema + the seeded Grade 6 Mathematics and Japanese tracks
pnpm dev                        # apps/web on http://localhost:3000
VOICE_LIVE_FAKE=1 pnpm --filter voice-gateway dev   # ws://localhost:8787 against the fake Voice Live server
```

Then sign up, pick an age band in Settings, enrol in a track, and press **Start talking**. With `AZURE_FOUNDRY_ENDPOINT` and a key (or a managed identity) set, the gateway talks to the real Voice Live API instead of the fake.

Toolchain: Node 24, pnpm 10, **TypeScript 7** (`tsc` is the native compiler, aliased as `@typescript/native`) for type checking, with TypeScript 6's classic API installed as `typescript` for typescript-eslint and Next's build.

## Scripts

| Command                 | What it does                                                             |
| ----------------------- | ------------------------------------------------------------------------ |
| `pnpm lint`             | ESLint over the whole workspace, including the safe-functions harness.   |
| `pnpm typecheck`        | `tsc --noEmit` in every package and app.                                 |
| `pnpm test`             | Vitest unit tests and feature files in every package.                    |
| `pnpm test:integration` | The `*.integration.test.ts` tier; needs `DATABASE_URL`, skips otherwise. |
| `pnpm db:migrate`       | Applies pending migrations from `packages/db/src/migrations`.            |
| `pnpm build`            | Builds `apps/web` (Next) and the migrate bundle.                         |
| `pnpm db:migrate`       | Also applies the seeds; `/api/health` is green once nothing is pending.  |

## Layout

```
apps/
  web/             Next.js 16 — UI, auth, MCP endpoint, health
  voice-gateway/   WebSocket service — Voice Live control channel, tool dispatch
packages/
  core/            branding, ids, clock, invariant
  config/          validated environment
  db/              Kysely client, migrations, generated types
  logging/         bored-logs setup
  blob-store/      Azure Blob (Azurite in dev) behind a port
  testing/         vitest-cucumber bootstrap, Postgres test harness, describeLive
  identity/        users, linked logins, passkeys, roles, guardianship
  learner-profile/ bios, uploads, extraction, objectives, snapshots
  curriculum/      categories, tracks, lessons, enrollment, pacing
  assessment/      question kinds, attempts, grading
  flashcards/      decks, SM-2 scheduling
  tutor/           session model, instructions, hint ladder, tools
  ai/              Azure Foundry LLM adapter, Voice Live events, fakes
  mcp-tools/       pure MCP tool registration
docker/            Dockerfile (web, voice-gateway, migrate stages)
docs/              design docs and as-built references
```

## Deployment

Images are published to Docker Hub on every push to `main` (`.github/workflows/ci.yml`). See [`DEPLOYMENT.md`](./DEPLOYMENT.md).
