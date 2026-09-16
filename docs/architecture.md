# Architecture (as built)

_Kept current. Update in the same change as the code._

## Processes

| Process              | What it is                                                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web`           | Next.js 16 (App Router, Turbopack, Tailwind 4). Better Auth routes, sign-in/up, home, catalogue and enrolment, profile, settings, the live session page and past-session review, `/api/mcp`, `/api/health`. Server actions carry every mutation. |
| `apps/voice-gateway` | Node `ws` service. One bridge per browser connection: verifies the gateway ticket, starts the tutoring session, holds the credentialed Voice Live channel, relays the SDP exchange, records turns, dispatches tool calls. `/health` for probes.  |
| `migrate`            | The `packages/db` migrate CLI, bundled as a Docker stage. Run deliberately, never on app start.                                                                                                                                                  |

## Packages

| Package           | Purpose                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core`            | Branding constant, branded ids, injected `Clock`, shared error tags, `invariant`, Result helpers.                                                                                           |
| `config`          | Zod environment schemas per process and `loadEnv`. The only reader of `process.env`.                                                                                                        |
| `db`              | Kysely client on one pool per process, numbered migrations (001–009 schema, 010–011 seeds), `EXPECTED_MIGRATIONS` + status check, generated `db.types.ts`.                                  |
| `logging`         | `LoggerPort`, bored-logs construction, the Postgres adapter (tables from migration 009), memory/noop loggers.                                                                               |
| `testing`         | `describeLive`, the shared Postgres test handle, `featurePath`.                                                                                                                             |
| `blob-store`      | Uploaded files behind one port: memory, disk, Azure Blob.                                                                                                                                   |
| `identity`        | Better Auth behind `Authenticator`/`IdentityStore`; linking policy, roles, guardianship, age bands, `getSessionUser`, gateway tickets.                                                      |
| `learner-profile` | Bio, objectives, uploads (extract → screen → summarise), the versioned snapshot and its prose rendering.                                                                                    |
| `curriculum`      | Categories, subjects, tracks, units, lessons; authoring, browsing, enrolment, pacing, self-directed tracks.                                                                                 |
| `assessment`      | Six question kinds, attempts with a grading history (LLM rubric, educator override), baseline level estimates, quiz generation.                                                             |
| `flashcards`      | Decks, cards, SM-2 scheduling.                                                                                                                                                              |
| `tutor`           | Session model, instruction assembly, hint ladder, voice profile, speaker attribution, the six tools and their dispatcher, session lifecycle, summaries, the production wiring of its ports. |
| `ai`              | LLM contract, structured output, Azure Foundry chat adapter, Content Safety, the Voice Live protocol and client, the fake Voice Live server.                                                |
| `mcp-tools`       | Pure MCP tool registration (`registerCurriculumTools`) and the text helpers.                                                                                                                |

## How a request is authenticated

Better Auth (Decision #3) owns `user`, `session`, `account`, `verification` and `passkey`. `packages/identity` never trusts the cookie for anything but the session token: `getSessionUser` reads roles and age band from `user_roles` and `learner_settings` on every request. In `apps/web`, `lib/session.ts` wraps that for pages, routes and actions; `test/route-auth-coverage.test.ts` fails the build of any `page.tsx`, `route.ts` or `actions.ts` that neither references the guard nor is listed with a reason. The guard reads `headers()` before anything else and never wraps it in `wrapAsync`, because Next signals "this route is dynamic" by throwing from it.

The voice gateway is on another host, where the cookie does not reach. The session page mints a gateway ticket (HMAC over user id + expiry with `AUTH_SECRET`, `packages/identity/src/ticket.ts`) through a server action; the gateway verifies it and then reads roles from the database like everyone else.

MCP clients present an API key as a bearer token; `apps/web/lib/mcp/api-keys.ts` stores only a SHA-256 digest and resolves the key to the educator it belongs to. Anonymous clients are served read-only; the tools' own policy decides what the resolved user may do.

## How a voice turn flows

See [`voice.md`](./voice.md). In one line: browser ws → gateway bridge → `startSession` → Voice Live over wss; audio browser ↔ Azure over WebRTC; transcripts and function calls come back on the control channel, are recorded through `packages/tutor`, and the tool outputs go back to the model.

## How a quiz attempt flows

`submitAttempt` (`packages/assessment`) grades objective kinds by rule and open kinds through the `Grader` port (LLM rubric in production, scripted in tests), writing a `gradings` row per response. An educator override is a second row with `override_of`; `latestGrading` wins. `recordBaseline` turns a baseline attempt into a level estimate that the profile snapshot renders for the tutor.

## How an MCP authoring call flows

Client → `POST /api/mcp` with `Authorization: Bearer gg_…` → `resolveApiKey` → the SDK's `createMcpHandler` builds a fresh `McpServer` per request with `registerCurriculumTools(server, { userId }, { store, roles })` → the tool calls `createTrack`/`addUnit`/`addLesson`/`publishTrack` in `packages/curriculum`, whose policy checks the educator role → the track appears in the catalogue for the learner's `/tracks` page.

## How a check runs

`pnpm lint` → ESLint 10 with typescript-eslint (classic TS 6 API) and the `@campfhir/safe-functions` rules over every package and both apps. `pnpm typecheck` → TypeScript 7's `tsc` in every package and app. `pnpm test` → Vitest per package, unit tier, feature files included. `pnpm test:integration` → the integration tier, one package at a time (they share the database), self-skipping without `DATABASE_URL`. `pnpm --filter web build` → Next's own compile and type pass.
