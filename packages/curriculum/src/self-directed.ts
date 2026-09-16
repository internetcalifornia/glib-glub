/**
 * A track built from the learner's own snapshot. The model proposes the
 * structure through structured output; the result is a draft track owned by
 * the learner with origin `self_directed`. Publishing it (authoring.ts)
 * enrols the learner and no one else ever sees it (catalogue.ts).
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import { completeJson, type LlmProvider } from '@glib-glub/ai';
import { newId, type SubjectId, type UserId } from '@glib-glub/core';
import type { AgeBand } from '@glib-glub/identity';
import { z } from 'zod';

import { DEFAULT_PEDAGOGY, getOutline } from './authoring';
import { enroll } from './enrollment';
import type { CurriculumStore } from './ports';
import type { Lesson, Track, TrackOutline, Unit } from './types';

const proposalSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().max(1_000).default(''),
  units: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        lessons: z
          .array(
            z.object({
              title: z.string().min(1).max(200),
              objectives: z.array(z.string().max(200)).max(6).default([]),
              content: z.string().max(4_000).default(''),
            })
          )
          .min(1)
          .max(8),
      })
    )
    .min(1)
    .max(10),
});

export const SELF_DIRECTED_SYSTEM_PROMPT = `You design a short personal learning track for one learner, from what they told us about themselves and what they want.
Answer with JSON: {"title": string, "summary": string, "units": [{"title": string, "lessons": [{"title": string, "objectives": string[], "content": string}]}]}.
- 2–6 units, 2–5 lessons each, ordered from what the learner already knows toward the goal they stated.
- Each lesson's content is the tutor's own teaching notes (what to explain, what to ask, common mistakes) — 3–8 sentences. Never write a script to read aloud.
- Respect the learner's level and language.`;

export interface SelfDirectedInput {
  learnerId: UserId;
  subjectId: SubjectId;
  /** The personalisation snapshot, rendered as text by the caller. */
  snapshotText: string;
  language?: string;
  level?: AgeBand;
}

export async function generateSelfDirectedTrack(
  deps: { store: CurriculumStore; llm: LlmProvider },
  input: SelfDirectedInput
): AsyncResult<TrackOutline, 'NOT_FOUND' | 'GENERATION_FAILED' | 'DB_ERROR'> {
  const subject = await deps.store.getSubject(input.subjectId);
  if (!subject.ok) return subject;
  if (!subject.val) return err('NOT_FOUND', { message: 'No such subject' });

  const proposal = await completeJson(
    deps.llm,
    {
      system: SELF_DIRECTED_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Subject: ${subject.val.name}\n\nAbout the learner:\n${input.snapshotText}`,
        },
      ],
      maxTokens: 3_000,
      temperature: 0.4,
    },
    proposalSchema
  );
  if (!proposal.ok)
    return err('GENERATION_FAILED', { message: proposal.err.message, cause: proposal.err });

  const track: Track = {
    id: newId<'track'>(),
    subjectId: input.subjectId,
    title: proposal.val.value.title,
    summary: proposal.val.value.summary,
    levelMin: input.level ?? 'adult',
    levelMax: input.level ?? 'adult',
    language: input.language ?? 'en',
    visibility: 'draft',
    authoredBy: input.learnerId,
    origin: 'self_directed',
    pedagogy: DEFAULT_PEDAGOGY,
  };
  const saved = await deps.store.createTrack(track);
  if (!saved.ok) return saved;

  let unitPosition = 0;
  for (const proposedUnit of proposal.val.value.units) {
    unitPosition += 1;
    const unit: Unit = {
      id: newId<'unit'>(),
      trackId: track.id,
      position: unitPosition,
      title: proposedUnit.title,
    };
    const unitSaved = await deps.store.addUnit(unit);
    if (!unitSaved.ok) return unitSaved;
    let lessonPosition = 0;
    for (const proposedLesson of proposedUnit.lessons) {
      lessonPosition += 1;
      const lesson: Lesson = {
        id: newId<'lesson'>(),
        unitId: unit.id,
        position: lessonPosition,
        title: proposedLesson.title,
        objectives: proposedLesson.objectives,
        content: proposedLesson.content,
        estimatedMinutes: 20,
      };
      const lessonSaved = await deps.store.addLesson(lesson);
      if (!lessonSaved.ok) return lessonSaved;
    }
  }
  return getOutline(deps, track.id);
}

/**
 * The learner publishes their own self-directed track: it becomes
 * `published` (visible to them alone) and they are enrolled at a weekly
 * pace of two sessions unless they chose otherwise.
 */
export async function publishSelfDirectedTrack(
  deps: { store: CurriculumStore },
  input: {
    learnerId: UserId;
    trackId: Track['id'];
    now: Date;
    cadence?: 'daily' | 'weekly';
    sessionsPerPeriod?: number;
  }
): AsyncResult<
  void,
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'TRACK_EMPTY'
  | 'TRACK_NOT_PUBLISHED'
  | 'ALREADY_ENROLLED'
  | 'VALIDATION_ERROR'
  | 'DB_ERROR'
> {
  const track = await deps.store.getTrack(input.trackId);
  if (!track.ok) return track;
  if (!track.val) return err('NOT_FOUND', { message: 'No such track' });
  if (track.val.origin !== 'self_directed' || track.val.authoredBy !== input.learnerId) {
    return err('FORBIDDEN', {
      message: 'Only the learner who owns a self-directed track can publish it',
    });
  }
  const lessons = await deps.store.listLessons(input.trackId);
  if (!lessons.ok) return lessons;
  if (lessons.val.length === 0) return err('TRACK_EMPTY');
  if (track.val.visibility !== 'published') {
    const published = await deps.store.setTrackVisibility(input.trackId, 'published');
    if (!published.ok) return published;
  }
  const enrolled = await enroll(deps, {
    learnerId: input.learnerId,
    trackId: input.trackId,
    cadence: input.cadence ?? 'weekly',
    sessionsPerPeriod: input.sessionsPerPeriod ?? 2,
    now: input.now,
  });
  if (!enrolled.ok && enrolled.err.type !== 'ALREADY_ENROLLED') return enrolled;
  return ok();
}
