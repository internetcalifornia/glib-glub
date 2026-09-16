# Working in this repository

This file is the contract for anyone — human or AI — writing code here. `CLAUDE.md` points at it.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

`apps/web` runs Next.js 16. It has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `apps/web/node_modules/next/dist/docs/` before writing any Next code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## The order of work: spec first

1. **Design doc** — for anything larger than a bug fix, write `docs/specs/<area>-design.md` (What exists today / Why this exists / Proposal / Order / Guard rails). Design docs are append-only history; write a new one rather than editing an old one to match what shipped.
2. **Feature file** — describe the behaviour in `packages/<name>/features/<thing>.feature` (Gherkin) in the learner's, guardian's, or educator's words. Commit it before any `src/`.
3. **Red** — write the step definitions (`src/<thing>.steps.test.ts`) and unit tests (`src/<thing>.test.ts`) against the package's public types. The suite fails.
4. **Green** — the smallest implementation that passes, returning `Result` everywhere.
5. **Refactor** — under the same tests. Update the as-built doc (`docs/architecture.md`) in the same change.

A pull request that adds behaviour without a feature file or a test is incomplete.

## Errors are values

- Every fallible function returns `Result<T, 'TAG' | 'OTHER_TAG'>` or `AsyncResult<T, …>` from `@campfhir/safe-functions/types`, built with `ok()` / `err()` from `@campfhir/safe-functions/helpers`.
- Error tags are a **closed string-literal union per module**, declared once in that module's `errors.ts`. Never widen to `string`.
- Consume with `if (!r.ok) return r; const x = r.val;`. Never `.val` without checking `.ok`. Discard explicitly with `void`.
- `throw` is forbidden. The single exception is `packages/core/src/invariant.ts`, allowed by lint config, for genuine programmer errors that must abort.
- Third-party code that throws or rejects is wrapped at the call site: `wrap(() => JSON.parse(s), 'INVALID_JSON')`, `wrapAsync(() => fetch(url), 'NETWORK_ERROR')`.
- Framework boundaries (Next route handlers, pages, server actions, MCP tool handlers) convert a failed `Result` into the framework's shape — `NextResponse.json({ error }, { status })`, an MCP text result — and never let it escape as an exception.
- `@campfhir/bored-logs` ships its own inlined `Result` whose `Err` is an `Error` subclass with the tag in `.message`. It never crosses a module boundary; `packages/logging` adapts it.

## TypeScript rules the linter enforces

- No `any`. No `as` casts (`consistent-type-assertions: never`). A justified exception carries `// eslint-disable-next-line … -- <reason>`.
- No unused variables unless prefixed `_`.
- Every `{placeholder}` in a log message must resolve to an attribute that cannot be `undefined` (`glib-glub/log-template-fields`).

## Module shape

Every package under `packages/` looks the same:

```
packages/<name>/
├─ package.json          @glib-glub/<name>, "main": "./src/index.ts" — raw TS, no build step
├─ tsconfig.json         standalone, strict, noEmit
├─ vitest.config.ts
├─ features/*.feature    Gherkin specs
└─ src/
   ├─ index.ts           strict barrel: explicit named exports, `export type` separated, never `export *`
   ├─ types.ts           domain types — readonly, branded ids
   ├─ errors.ts          the module's closed error-tag union
   ├─ store.ts           Kysely queries → AsyncResult
   ├─ <noun>.ts          pure logic, one noun per file
   ├─ <noun>.test.ts     colocated unit tests (fakes, no network, no database)
   ├─ <noun>.integration.test.ts   needs DATABASE_URL; self-skips without it
   ├─ <thing>.steps.test.ts        step definitions for features/<thing>.feature
   └─ testing.ts         fakes and builders exported for other packages' tests
```

- **Flat `src/`.** No `domain/`, `services/`, `repositories/` layering. Files are named for the noun they own.
- **Functions with injected dependencies**, not classes or containers: `createTutorSession(deps, input)`, `registerCurriculumTools(server, ctx, deps = productionDeps)`. Classes only for genuinely stateful clients (a socket, a pool).
- **Every file opens with a block comment** explaining why it exists and what breaks without it. Comments explain _why_, at length; the code says _what_.
- Ports are `interface`s; unions are `type`s. Fakes in tests are hand-rolled objects typed against the port (`const store: SessionStore = { … }`), not auto-mocks.

## Tests

- Vitest. `*.test.ts` runs everywhere and touches no network or database. `*.integration.test.ts` needs a real Postgres (`DATABASE_URL`) and self-skips without it via `describeLive` from `@glib-glub/testing`. `apps/web/e2e/*.spec.ts` is Playwright, run locally.
- **Every test file opens with a JSDoc stating the contract it pins.** `describe(<exported symbol>)`, `it(<prose assertion, no "should">)`. Arrange / act / assert separated by blank lines. Plain `expect(...).toEqual/toBe`; no snapshots, no custom matchers.
- Feature files are executed by `@amiceli/vitest-cucumber`. Every scenario and step in a `.feature` must have a matching step definition or the suite fails — that is the point.

## Naming

- Workspace packages: `@glib-glub/<name>`. The product's display name lives in `packages/core/src/branding.ts` only.
- MCP tools: `<area>_<verb>_<noun>` (`curriculum_create_track`), titled `"<Area> · Read|Act — <sentence>"`, with `annotations.readOnlyHint`. Registration performs no I/O.
- Migrations: `packages/db/src/migrations/NNN-kebab-name.ts`, listed in `EXPECTED_MIGRATIONS`. Seeds ship as migrations.
- Database columns: `snake_case`. TypeScript: `camelCase`. Files: `kebab-case`.

## Documentation

- `PLATFORM.md` is the product plan and holds the numbered, dated **Decisions**. Cite them from code (`// Decision #3`). Amend by appending, never by rewriting.
- `docs/README.md` explains the split between append-only design docs and kept-current as-built references. Update the as-built doc in the same change as the code.
- `DEPLOYMENT.md` is the operator's runbook.

## Safety defaults you may not loosen without a Decision

- No raw audio is persisted from tutoring sessions; transcripts and tool calls only.
- Learners in age bands `k-5` and `6-8` cannot link a Facebook login themselves.
- The hint ladder (`packages/tutor/src/hint-ladder.ts`) is enforced in code: the tutor never reveals a target answer before the learner has attempted it.
- Uploaded material and transcripts pass the `ContentSafety` port before they are stored.
