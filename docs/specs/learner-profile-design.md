# Learner profile — design

_2026-09-16. Point-in-time; see `docs/README.md`._

## What exists today

Identity: users, roles, guardianship, age bands. Nothing yet about who a
learner is as a learner.

## Why this exists

The tutor is only worth talking to if it already knows the learner: how they
describe themselves, what they have studied, where they struggle, what they
or their guardian want out of the next month. That knowledge arrives as a
bio, as uploaded work (essays, tests, notes), and as objectives — and it must
be distilled into something a voice session can start from in a few hundred
tokens. The distilled form is the **personalisation snapshot**.

## Proposal

### Inputs

- **Bio** — free text plus structured hints: interests, learning-style
  preferences (visual, auditory, reading, hands-on), preferred language,
  grade label. Written by the learner, or by a guardian for a learner who
  cannot yet manage their own profile (age band below 9-12).
- **Uploads** — a file goes to the blob store, its text is extracted
  (`TextExtractor` port: pdf, docx, images via OCR later), screened by the
  `ContentSafety` port, then summarised and tagged by the `Summariser` port
  (LLM-backed). Rejected uploads keep a reason and no text.
- **Objectives** — short goals with a status (`active`, `achieved`,
  `archived`), each recording who set it. At most eight active at once.

### The snapshot

`buildSnapshot(inputs)` is a pure function: bio + active objectives + upload
summaries + the latest baseline estimate → a `Snapshot` with a
content-derived `version` (hash), so rebuilding from unchanged inputs yields
the same version and the tutor can tell "nothing new" from "changed". Stored
in `personalisation_snapshots`; the tutor reads the latest.

### Who may change what

`canManageOwnObjectives` from identity decides the learner; an accepted
guardian always may. The same rule governs the bio. Uploads may be made by
either.

## Order

1. Feature files: bio, uploads, objectives, snapshot.
2. `packages/blob-store` (port, disk, memory, Azure) and `packages/ai` (LLM contract, Azure Foundry adapter, content safety, fakes).
3. `packages/learner-profile`: types, ports, policy, snapshot builder, fakes, steps, store, migration 003.

## Guard rails

- No raw upload bytes are ever sent to an LLM; only extracted text.
- Rejected content is not stored beyond the rejection reason.
- The snapshot never includes the raw upload text — summaries only.
