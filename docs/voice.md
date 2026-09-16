# The voice session (as built)

_Kept current. Update in the same change as the code._

## Who talks to whom

```
browser ──(ws, control)──► apps/voice-gateway ──(wss + credential)──► Azure Voice Live
   │                              │
   └──────(WebRTC audio)──────────┼──────────────────────────────────► Azure Voice Live
                                  └── packages/tutor ── stores (Postgres)
```

- The **browser** (`apps/web/components/session-client.tsx`) opens one WebSocket to the gateway and, for voice, one `RTCPeerConnection` whose offer the gateway forwards to Azure. Audio never touches the gateway. A `voice-live-events` data channel gives the page low-latency listening hints; the gateway's `transcript` messages remain the record.
- The **gateway** (`apps/voice-gateway/src/bridge.ts`) holds the Azure credential and the session. One bridge per browser socket; a pure state machine (`session-machine.ts`) guards `idle → starting → live → ending → ended | failed`.
- **Azure Voice Live** is spoken to over raw `ws` with Zod-typed events (`packages/ai/src/voice-live.ts`, Decision #4). A fake server (`voice-live-fake.ts`) plays its part in tests and behind `VOICE_LIVE_FAKE=1`.

## Proving who you are

The session cookie belongs to the web app's origin and does not travel to the gateway's host. The session page calls a server action that mints a **gateway ticket** — an HMAC over the user id and an expiry, signed with `AUTH_SECRET` (`packages/identity/src/ticket.ts`) — and sends it in `session.start`. The gateway verifies it with the same secret and reads roles from the database like everyone else. Tickets live two minutes and are minted at connect time.

## The protocol (`apps/voice-gateway/src/protocol.ts`)

Browser → gateway: `session.start {ticket, mode, transport, trackId?, others[]}`, `sdp.offer {sdp}`, `text.turn {text}`, `session.end`.

Gateway → browser: `session.started`, `sdp.answer`, `transcript {speaker, name, text}`, `tool {name, result}`, `listening`, `ended {summary}`, `error {tag, message, fatal}`.

Gateway → Azure: `rtc.call.sdp.create` (carrying the whole session config), `session.update` (text sessions), `conversation.item.create` (text turns and function-call outputs), `response.create`.

## What a session is told

`startSession` (`packages/tutor/src/session.ts`) assembles the instructions from the learner's name, age band and snapshot, the track's pedagogy, the due lesson's objectives and notes (never to be read aloud), who is in the room, and the previous session's summary. The voice profile (`voice.ts`) picks the voice and rate by age band, the multilingual VAD for non-English tracks, and diarised transcription when more than one person is present.

## Tools, and the hint ladder

The tutor's tools (`packages/tutor/src/tools.ts`) are the only way it changes anything: `tutor_get_lesson_context`, `tutor_present_problem`, `tutor_record_attempt`, `tutor_note_misconception`, `tutor_add_flashcard`, `tutor_end_session`. `tutor_record_attempt` returns the one move allowed next (`clarify → hint → parallel_example → reveal_with_explanation`, Decision #6); the prompt is told to obey and the tool refuses to reveal early regardless.

## Multi-speaker sessions

With a guardian or educator declared, transcription is diarised. `participants.ts` maps speaker labels to people from the calibration phrase each says first ("I'm Maya"); a label that never calibrates is recorded as `unknown`, never guessed. The instructions switch to teaching-aide behaviour when an educator is present.

## What is kept

Transcripts and tool calls only (Decision #5). Every turn is a row in `session_turns` with its speaker; every tool call in `session_tool_calls`; the summary on the session. No audio is ever written.

## How it ends

Three ways, all leaving a summary: the browser sends `session.end`, the tutor calls `tutor_end_session`, or the browser disconnects. If the voice service drops mid-session the session is marked `failed` with a narrative saying so. The summary is what the next session starts from.
