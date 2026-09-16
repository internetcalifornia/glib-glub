# The platform

_A working name has not been chosen. The workspace scope is `@glib-glub/*`; the display name lives in `packages/core/src/branding.ts` and nowhere else._

## What this is (and isn't)

A mobile-first web platform whose headline feature is a **voice-first AI tutor** that teaches by building on what the learner already knows rather than handing over answers. It serves learners of any level — kindergarten through university and lifelong learners — and the adults around them: parents and guardians who set objectives and sit in on sessions, and educators who author tracks and use the tutor as a teaching aide.

It is not a content marketplace, not a chat app with a syllabus bolted on, and not a homework-answer engine. Every design choice below follows from that.

## Use cases

### 1. A sixth grader works through ratios with a voice tutor

The learner opens the app on a phone, taps the microphone, and talks. The tutor already knows the learner's reading level, what they struggled with last session, and that their parent wants them to explain their reasoning aloud. It presents a problem, listens, and — when the learner is stuck — climbs a hint ladder: clarify, then hint, then a worked parallel example. It never states the target answer before the learner has tried.

### 2. A parent sits in

The same session with two voices. The tutor tells them apart, keeps the learner as the one being taught, and at the end summarises for the parent what was covered and what to practise.

### 3. An educator authors a track over MCP

From their own tooling, an educator creates a track, adds units and lessons, attaches questions in six formats, and publishes it into a category — all through MCP tools, without touching the web UI.

### 4. A lifelong learner starts Japanese

An adult uploads notes from a class they took years ago. The platform builds a self-directed track from them, runs a baseline test, and schedules weekly sessions with a Japanese-speaking tutor voice.

## Architecture

### Surfaces

- `apps/web` — Next.js 16, mobile-first. Auth, catalogue, profile, quizzes, flashcards, session page, the MCP HTTP endpoint, `/api/health`.
- `apps/voice-gateway` — a Node WebSocket service that owns the credentialed control channel to Azure Voice Live, relays the browser's WebRTC SDP, and dispatches the tutor's tool calls into the domain packages.

### Domain modules (`packages/*`)

`identity`, `learner-profile`, `curriculum`, `assessment`, `flashcards`, `tutor` — each a flat package of functions returning `Result`, with its own feature files and store. `ai` holds the LLM and Voice Live adapters behind ports with fakes. `mcp-tools` holds pure tool registration. `core`, `config`, `db`, `logging`, `blob-store`, `testing` are infrastructure.

### Voice

Browser WebRTC for audio; server-held WebSocket control channel for session configuration and tool calls. Transcripts, never audio, are stored. Multi-speaker sessions use diarised transcription and map speaker labels to declared participants.

## Roadmap

### Phase 0 — Foundation (this milestone)

Monorepo, safe-coding harness, feature files for every module, migrations, seeds for 6th-grade mathematics and a small Japanese track, a voice session against a fake Voice Live server and against Azure.

### Phase 1 — Learners and guardians

Guardian invitations, objective setting, progress views, weekly digest.

### Phase 2 — Educators

Educator dashboards, grading queue with overrides, class rosters, MCP OAuth for remote authoring clients.

### Phase 3 — Breadth

More subjects and levels, avatar output, offline flashcards, native mobile wrappers.

## Decisions

Numbered and dated. Cite them from code as `// Decision #n`. Amend by appending a note, never by rewriting.

**1. Vitest, not Jest.** _(2026-09-16)_ The `@campfhir` library repos use Vitest; renkei uses Jest 30 with a module-mapper workaround for raw-TypeScript workspace packages. Every package here ships raw TypeScript (`"main": "./src/index.ts"`), which Vitest handles natively. Every other testing convention from renkei stands: tiers by filename, `describeLive` self-skipping integration tests, colocated tests, contract-stating file headers.

**2. Gherkin feature files are the user-facing specification.** _(2026-09-16)_ Behaviour is written in `.feature` files before code, executed inside Vitest by `@amiceli/vitest-cucumber`, which fails the suite when a scenario or step has no matching definition. Unit tests remain the contract-level specification. Design docs (`docs/specs/*-design.md`) carry the reasoning. If the plugin proves brittle the fallback is `describe('Given …')`/`it('when …, then …')` phrasing with the feature text unchanged.

**3. Better Auth behind `packages/identity`.** _(2026-09-16)_ Social logins (Google, Microsoft, Facebook), email + password, passkeys, and account linking come from Better Auth, which runs on Kysely internally and stores sessions in Postgres with an opaque cookie — roles live in the database, never in the cookie. Better Auth throws `APIError`; every call is wrapped in `wrapAsync` inside `packages/identity`, so nothing above it sees an exception. Alternative considered: a hand-rolled OIDC + WebAuthn stack as in renkei; more code for the same shape.

**4. Raw WebSocket to Voice Live, typed with Zod.** _(2026-09-16)_ `apps/voice-gateway` speaks the Voice Live event protocol directly over `ws` rather than through `@azure/ai-voicelive`. The protocol is small JSON events; a fake server is then trivial, and the gateway's tests run in CI without Azure. The SDK remains the fallback if the event surface drifts.

**5. Transcripts only, never audio.** _(2026-09-16)_ Many learners are minors. Sessions persist transcripts and tool calls. Raw audio is never written to storage.

**6. The hint ladder is code, not prompt.** _(2026-09-16)_ `tutor_record_attempt` returns the only move the tutor may make next (`clarify`, `hint`, `parallel_example`, `reveal_with_explanation`) as a function of attempt count. The prompt is told to obey it; the tool refuses to reveal early regardless of what the model asks.

**7. Seeds ship as migrations.** _(2026-09-16)_ The 6th-grade mathematics and Japanese tracks are migrations `010` and `011`, so every environment — test, dev, prod — has the same catalogue after `migrate`, and the seeds are versioned with the schema they depend on.

**8. MCP over HTTP, API-key authenticated, in `apps/web`.** _(2026-09-16)_ Tool registration is pure and lives in `packages/mcp-tools`; the transport is `mcp-handler` at `/api/mcp/[transport]`. Keys are hashed at rest and scoped to an educator. OAuth for MCP clients is Phase 2.

## Open questions

- The product name.
- Whether guardians can start a session without the learner present (currently no).
- Custom voice per educator (Azure custom voice is limited-access).
