# Tutor sessions and the voice gateway — design

_2026-09-16. Point-in-time; see `docs/README.md`._

## What exists today

Everything the tutor needs to know: who the learner is (identity,
profile snapshot), what to teach (the catalogue and pacing), how to check
(assessment), what to practise (flashcards). No tutor.

## Why this exists

The product is a tutor you talk to. Everything else is context for that
conversation. The session has to start knowing the learner, follow the
track, keep to the pedagogy (Decision #6: the hint ladder is code), work
with a parent or educator in the room, and end by writing down what
happened so the next session starts further along — all while the audio
path stays low-latency and the credentials stay on the server.

## Proposal

### The session model (`packages/tutor`)

A `TutorSession` has a learner, a track (and the lesson due), a mode
(`solo | with_guardian | with_educator`), a transport (`voice | text`),
participants, turns and tool calls, and — at the end — a summary. It is
created by `startSession`, which:

1. loads the personalisation snapshot, the track outline and what is due
   (the pacing plan), and the previous session's summary;
2. assembles **instructions** (`instructions.ts`): identity of the tutor,
   the learner's age band and style, the track's pedagogy, the lesson's
   notes, the last summary, the participants and the mode's rules, and the
   hint-ladder contract;
3. chooses the **voice profile** (`voice.ts`): voice name and rate by age
   band and track language, turn detection (`azure_semantic_vad`, or the
   multilingual variant for non-English tracks), transcription model
   (diarising in multi-speaker modes).

### The hint ladder (Decision #6)

`hint-ladder.ts` is a pure state machine per problem: attempts 0 → 1 → 2
→ 3 map to the allowed next move `clarify → hint → parallel_example →
reveal_with_explanation`. The `tutor_record_attempt` tool returns the move;
the instructions say the tutor must take exactly that move. A correct
attempt closes the problem with `celebrate_and_explain`.

### Tools (`tools.ts`)

Declared once as JSON-schema tool definitions the gateway hands to Voice
Live, and dispatched by `dispatchTool(session, name, args)`, which returns a
`Result` and records the call as a turn:

- `tutor_get_lesson_context` — the current lesson's objectives and notes.
- `tutor_present_problem` — registers a problem (text, expected answer) so the ladder can track it.
- `tutor_record_attempt` — the learner's attempt; returns `{ correct, nextMove }`.
- `tutor_note_misconception` — a misconception to carry into the summary.
- `tutor_add_flashcard` — a card into the learner's deck for the lesson.
- `tutor_end_session` — closes the session; triggers the summary.

### Multi-speaker modes

Participants are declared at start. With diarised transcription the gateway
receives speaker labels; `participants.ts` maps labels to participants by
the calibration phrase each says at the start ("I'm Maya", "I'm Maya's
dad"), and the instructions for `with_guardian` / `with_educator` say who
is being taught and how to address the adult (summarise, suggest, never
grade the adult).

### Summaries

`summarise.ts` turns the transcript and tool calls into a `SessionSummary`
(covered, struggled, misconceptions, next steps, minutes) through
structured output — the fake summariser used in tests derives it from the
tool calls alone. Stored on the session and read by the next `startSession`.

### The gateway (`apps/voice-gateway`)

A `ws` server. Browser → gateway: `session.start`, `sdp.offer`, `text.turn`,
`session.end`. Gateway → Azure: the credentialed control channel
(`voice-live/realtime/calls?api-version=…&model=…`), `rtc.call.sdp.create`,
`session.update` with instructions and voice profile, function-call
outputs. Gateway → browser: `sdp.answer`, `transcript`, `tool`, `ended`,
`error`. One state machine per session (`session-machine.ts`) with explicit
states: `idle → starting → live → ending → ended | failed`.

`VoiceLiveClient` is a port; the Azure implementation speaks the real
protocol, the fake (`packages/ai/src/voice-live-fake.ts`) is a `ws` server
that replays scripted events so the gateway's behaviour is tested in CI.

### The web session page

`/session/[id]`: WebRTC set-up (`RTCPeerConnection`, mic track, remote
audio element, `voice-live-events` data channel for live transcript and
VAD), a hands-free / push-to-talk toggle, the live transcript, a text input
for the text fallback, and an "end session" button. Mobile first: one
column, large targets, the transcript scrolls, the controls stay fixed.

## Order

1. Features: instructions, hint ladder, tools, participants, summary, gateway session lifecycle.
2. `packages/tutor` pure modules and fakes; steps.
3. `packages/ai` Voice Live event types + fake server.
4. Migration 007; the Postgres session store.
5. `apps/voice-gateway`; `apps/web` session page and auth pages.

## Guard rails

- Transcripts and tool calls only; never audio (Decision #5).
- The Azure credential never leaves the gateway.
- Lesson content is notes for the tutor, never read aloud.
