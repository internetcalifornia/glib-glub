# Architecture (as built)

_Kept current. Update in the same change as the code._

## Processes

| Process              | What it is                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `apps/web`           | Next.js 16 app: UI, Better Auth routes, server actions, `/api/mcp`, `/api/health`. _Not yet built._                    |
| `apps/voice-gateway` | Node WebSocket service holding the Azure Voice Live control channel and dispatching tutor tool calls. _Not yet built._ |
| `migrate`            | The `packages/db` migrate CLI, bundled as a Docker stage. Run deliberately, never on app start.                        |

## Packages

| Package   | Purpose                                                                                               |
| --------- | ----------------------------------------------------------------------------------------------------- |
| `core`    | Branding constant, branded ids, injected `Clock`, shared error tags, `invariant`, Result helpers.     |
| `config`  | Zod environment schemas per process and `loadEnv`. The only reader of `process.env`.                  |
| `db`      | Kysely client on one pool per process, numbered migrations, `EXPECTED_MIGRATIONS` + status check.     |
| `logging` | `LoggerPort` (the structural slice packages depend on), bored-logs construction, memory/noop loggers. |
| `testing` | `describeLive`, the shared Postgres test handle, `featurePath`.                                       |

## How a check runs

`pnpm lint` → ESLint 10 with typescript-eslint (classic TS 6 API) and the
`@campfhir/safe-functions` rules. `pnpm typecheck` → TypeScript 7's `tsc` in
every package. `pnpm test` → Vitest per package, unit tier. `pnpm
test:integration` → the integration tier, self-skipping without
`DATABASE_URL`.
