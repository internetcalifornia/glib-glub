# Foundation — design

_2026-09-16. Point-in-time; see `docs/README.md` for how design docs are used._

## What exists today

Nothing. The repository holds a LICENSE. The user's other projects
(`campfhir/renkei`, `campfhir/safe-functions`, `campfhir/bored-logs`) establish
the conventions this repository adopts; their specifics are recorded in
`AGENTS.md` and `PLATFORM.md`'s Decisions.

## Why this exists

The product's headline feature — a voice tutor a child can talk to — sits on
top of identity, personalisation, curriculum, assessment and AI adapters, each
of which has to be correct before the tutor can be trusted with a learner.
The foundation milestone therefore builds the harness that keeps those
modules honest (Result-only error handling enforced by lint, spec-first
tests, a real database in CI) before it builds the modules.

## Proposal

### Toolchain

- Node 24, pnpm 10, raw-TypeScript workspace packages (`"main": "./src/index.ts"`, no build step).
- **TypeScript 7** (the native compiler) runs every `typecheck`. It ships no
  JavaScript API yet, and typescript-eslint — which `@campfhir/safe-functions`
  is built on — needs one, as does Next's build. So the classic compiler is
  installed too, under the `typescript` name via the `@typescript/typescript6`
  compatibility package, and TS 7 under the `@typescript/native` alias, which
  is what provides the `tsc` binary. `tsc --version` → 7.0.2, `tsc6 --version`
  → 6.0.x. The compatibility package goes away when TS 7.1 ships its API and
  the tools adopt it.
- Vitest 5 for unit and feature tests; `@amiceli/vitest-cucumber` runs the
  Gherkin. Playwright for e2e, local only.
- ESLint 10 flat config with typescript-eslint and the four `result/*` rules;
  `consistent-type-assertions: never`; `no-explicit-any`; the copied
  `log-template-fields` rule.

### The harness proves itself

`packages/core/src/harness.test.ts` runs the repository's real ESLint config
over five deliberately broken fixtures and one clean one, and asserts each
rule fires. A refactor that silently drops a glob turns this test red.

### Packages in this milestone

`core`, `config`, `db`, `logging`, `testing` — the infrastructure every domain
package takes as a dependency. Each follows the module shape in `AGENTS.md`.

### Database

Postgres 17 via Kysely. Numbered migrations with a custom provider (Kysely's
file provider would import colocated tests). `EXPECTED_MIGRATIONS` in code,
checked against disk by a test, reported on `/api/health` as 503 while
pending. Seeds ship as migrations (Decision #7).

### Delivery

One multi-stage Dockerfile: `web`, `voice-gateway`, `migrate`. CI runs lint,
typecheck, unit tests, then migrates a service-container Postgres and runs
the integration tier. Images publish to Docker Hub on push to `main`.

## Order

1. Root config, docs, CI, Docker.
2. `core`, `config`, `testing`, `db`, `logging` with their tests; the harness proof test.
3. Then the domain packages, each in its own design doc.

## Guard rails

- No package may import `process.env` except `config` (and `db` for
  `DATABASE_URL` alone).
- No package may depend on `apps/*`.
- `packages/testing` may not depend on `packages/db` (db's tests use it).
