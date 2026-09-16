# Assessment and flashcards — design

_2026-09-16. Point-in-time; see `docs/README.md`._

## What exists today

Identity, profiles, the catalogue with two seeded tracks. No way to find
out what a learner can do, and nothing for them to practise between
sessions.

## Why this exists

The tutor should not guess a learner's level; a **baseline test** gives it
a starting point, and **quizzes** after lessons tell it what stuck.
**Flashcards** carry the recall practice a voice session is bad at. Grading
must be trustworthy: objective kinds grade themselves, open kinds are graded
by a model against a rubric, and an educator can override with the trail
kept — a grade is a fact with a history, never a mutable cell.

## Proposal

### Six question kinds

`single_choice`, `multi_select`, `true_false`, `fill_blank`, `short_answer`,
`long_answer`. Each has a body (prompt plus kind-specific fields) and a key
or rubric. The first four grade deterministically:

- single choice: chosen option id equals the key;
- multi select: chosen set equals the key set (no partial credit by default);
- true/false: boolean equality;
- fill in the blank: case-insensitive, whitespace-trimmed match against any
  accepted answer; optional numeric tolerance.

Short and long answers go to the `Grader` port (LLM via structured output):
a score in [0, 1], feedback, and which rubric points were met. The prompt
carries the rubric and a sample answer, never the learner's identity.

### Assessments, attempts, gradings

An **assessment** is a titled set of questions with a purpose (`baseline`,
`quiz`, `test`), attached to a track and optionally a lesson. An **attempt**
is one learner sitting it; **responses** are their answers; a **grading**
row is one grade for one response, with `grader = 'auto' | 'llm' | 'educator'`
and `override_of` pointing at the grading it replaces. The attempt's score
is the sum of the latest grading per response over the total.

### Baseline → level estimate

A baseline attempt's score maps to a **level estimate** per subject
(`beginning`, `developing`, `proficient`, `advanced`) stored on
`level_estimates`, which the learner-profile snapshot reads.

### Quiz generation

`generateQuiz(lesson)` asks the model for N questions of mixed kinds from
the lesson's objectives and notes, validated by schema, stored as a `quiz`
assessment in draft until an educator approves — or immediately usable for a
self-directed track.

### Flashcards

Decks belong to a learner (optionally derived from a lesson). SM-2:
each review with a quality 0–5 updates easiness, interval and repetitions;
`dueCards(deck, now)` is pure. The tutor can push cards into a deck at the
end of a session (`tutor_end_session`).

## Order

1. Feature files: grading per kind, attempts and overrides, baseline levels, flashcards.
2. Pure grading, SM-2, level mapping; ports; memory store; steps.
3. Migrations 005 (assessment) and 006 (flashcards); Postgres store.

## Guard rails

- An LLM grade is never final for a `test`: it is recorded as `llm` and shown as provisional until an educator confirms or the learner's guardian accepts.
- Rubric text is never shown to the learner before the attempt is submitted.
