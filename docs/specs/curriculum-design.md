# Curriculum — design

_2026-09-16. Point-in-time; see `docs/README.md`._

## What exists today

Identity, learner profiles, the AI ports. No content.

## Why this exists

The tutor needs something to teach from. A **track** is a curriculum with
a level range and a subject; it narrows what a session is about and gives
the tutor a sequence — units of lessons, each with objectives and content
the tutor paraphrases rather than reads. Tracks are authored by educators
in the app or over MCP, or generated as **self-directed** tracks from a
learner's uploads. **Categories** and **subjects** exist so a learner can
find a track without knowing its name. **Pacing plans** turn a track into
"what is due today".

## Proposal

### Model

- `categories` (Mathematics, Languages, …) → `subjects` (Mathematics / Grade 6; Japanese / Beginner) → `tracks`.
- A track has `title`, `summary`, `level_min`/`level_max` (age-band vocabulary reused: `k-5`, `6-8`, `9-12`, `university`, `adult`), `language`, `visibility` (`draft`, `published`, `archived`), `authored_by`, `origin` (`educator`, `mcp`, `self_directed`), and `pedagogy` — the free-text teaching rules the tutor's instructions carry ("Socratic; never state the answer before two attempts").
- A track has ordered `units`; a unit has ordered `lessons`; a lesson has `title`, `objectives[]`, `content` (markdown the tutor reads as its own notes), `estimated_minutes`.
- `enrollments` (learner, track, enrolled_at, status) and `pacing_plans` (enrollment, cadence `daily|weekly`, sessions_per_period, next_due_at).

### Authoring rules

Only an `educator` or `admin` creates or publishes a track (the MCP surface
carries the educator's identity through its API key). Anyone enrolled reads a
published track; a draft is visible to its author only. Publishing requires
at least one unit with one lesson.

### Self-directed tracks

`generateSelfDirectedTrack(learnerId)` hands the learner's snapshot to the
LLM through structured output and creates a draft track owned by the
learner with `origin = self_directed`; the learner publishes it to themselves
(visibility `published`, but only they are ever enrolled).

### Pacing

`dueLessons(plan, progress, now)` is pure: given cadence and what has been
completed, which lessons are due and whether the learner is behind.

### MCP

`packages/mcp-tools` registers `curriculum_list_categories`,
`curriculum_get_track`, `curriculum_create_track`, `curriculum_add_unit`,
`curriculum_add_lesson`, `curriculum_publish_track` against a
`CurriculumDeps` object. Registration performs no I/O.

### Seeds (Decision #7)

Migration `010-seed-6th-grade-math`: Mathematics → Grade 6, one track with
six units (ratios and rates; fractions and decimals; expressions;
equations and inequalities; geometry; statistics), three lessons each.
Migration `011-seed-japanese-n5`: Languages → Japanese, one short track
(hiragana; greetings; numbers and time).

## Order

1. Feature files: browse, author, publish, enroll, pacing, self-directed.
2. Types, ports, policy, pacing, memory store, steps.
3. Migration 004, Postgres store, seeds 010/011.
4. MCP tools + contract tests through the MCP client.

## Guard rails

- Lesson content is never spoken verbatim; it is the tutor's notes. The tutor package enforces this in its instructions.
- A published track is immutable except through a new version (later); for now, edits to a published track require unpublishing.
