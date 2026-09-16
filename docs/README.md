# Documentation index

This folder holds two kinds of documents:

- **Point-in-time design docs** (`specs/*-design.md`) — proposals written before or during a specific piece of work. They capture the reasoning behind a decision at the time it was made and are **not** kept in sync with the code afterward. Treat them as historical context, not a live reference.
- **As-built references** (below) — describe what the code actually does today. These are meant to be kept current.

## As-built references

| Doc                                    | Covers                                                                                                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`architecture.md`](./architecture.md) | System topology: the `apps/*` processes, the `packages/*` modules, how a voice turn, a quiz attempt, and an MCP authoring call flow through them. Start here.          |
| [`voice.md`](./voice.md)               | The voice session end to end: browser WebRTC, the gateway's control channel to Azure Voice Live, tool dispatch, multi-speaker handling, and the fake server tests use. |

## Design docs

| Doc                                                                    | Proposal                                                                           |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [`specs/foundation-design.md`](./specs/foundation-design.md)           | The monorepo, the safe-coding harness, and the module map.                         |
| [`specs/identity-design.md`](./specs/identity-design.md)               | One account, many logins; roles; guardianship; age bands.                          |
| [`specs/learner-profile-design.md`](./specs/learner-profile-design.md) | Bios, uploads, extraction, objectives, personalisation snapshots.                  |
| [`specs/curriculum-design.md`](./specs/curriculum-design.md)           | Categories, tracks, lessons, enrollment, pacing, MCP authoring.                    |
| [`specs/assessment-design.md`](./specs/assessment-design.md)           | Six question kinds, grading, educator override, flashcards.                        |
| [`specs/tutor-design.md`](./specs/tutor-design.md)                     | Session model, instruction assembly, the hint ladder, multi-speaker modes, memory. |

## Product vision vs. current code

[`PLATFORM.md`](../PLATFORM.md) is the product plan — the target architecture, the phased roadmap, and the numbered **Decisions** that govern how the system is built. It is not a description of what exists today. The docs in this folder describe the code as it stands; `PLATFORM.md` describes where it's headed. Where they disagree, the code — and these docs — win for "what does it do today," and `PLATFORM.md`'s Decisions win for "why was it built this way."

## A note to future agents (human and AI)

- When you add a package, a tool family, or change how a major subsystem works (the session model, grading, the hint ladder, auth linking), update the relevant file here in the same change, not as a follow-up.
- When you notice a doc here is wrong, fix it — don't work around the discrepancy silently.
- Prefer updating an existing as-built doc over creating a new fragment.
- Design docs are append-only history — write a new one for a new proposal rather than editing an old one to match what shipped, but do update the as-built doc it fed into.
