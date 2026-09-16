/**
 * Enrolling in a published track with a pace, completing lessons, and
 * asking what is due.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import { newId, type LessonId, type TrackId, type UserId } from '@glib-glub/core';

import { getOutline, lessonsInOrder } from './authoring';
import { dueLessons, type DueReport } from './pacing';
import type { CurriculumStore } from './ports';
import type { Cadence, Enrollment, PacingPlan } from './types';

export interface EnrollInput {
  learnerId: UserId;
  trackId: TrackId;
  cadence: Cadence;
  sessionsPerPeriod: number;
  now: Date;
}

export async function enroll(
  deps: { store: CurriculumStore },
  input: EnrollInput
): AsyncResult<
  { enrollment: Enrollment; plan: PacingPlan },
  'NOT_FOUND' | 'TRACK_NOT_PUBLISHED' | 'ALREADY_ENROLLED' | 'VALIDATION_ERROR' | 'DB_ERROR'
> {
  const track = await deps.store.getTrack(input.trackId);
  if (!track.ok) return track;
  if (!track.val) return err('NOT_FOUND', { message: 'No such track' });
  if (track.val.visibility !== 'published') {
    return err('TRACK_NOT_PUBLISHED', { message: 'Only a published track can be enrolled in' });
  }
  if (track.val.origin === 'self_directed' && track.val.authoredBy !== input.learnerId) {
    return err('NOT_FOUND', { message: 'No such track' });
  }
  if (
    !Number.isInteger(input.sessionsPerPeriod) ||
    input.sessionsPerPeriod < 1 ||
    input.sessionsPerPeriod > 14
  ) {
    return err('VALIDATION_ERROR', { message: 'Sessions per period is 1–14' });
  }
  const existing = await deps.store.getEnrollment(input.learnerId, input.trackId);
  if (!existing.ok) return existing;
  if (existing.val && existing.val.status === 'active') {
    return err('ALREADY_ENROLLED', { message: 'Already enrolled in this track' });
  }

  const enrollment: Enrollment = {
    id: newId<'enrollment'>(),
    learnerId: input.learnerId,
    trackId: input.trackId,
    status: 'active',
    enrolledAt: input.now,
  };
  const saved = await deps.store.createEnrollment(enrollment);
  if (!saved.ok) return saved;
  const plan: PacingPlan = {
    enrollmentId: enrollment.id,
    cadence: input.cadence,
    sessionsPerPeriod: input.sessionsPerPeriod,
    startedAt: input.now,
  };
  const planSaved = await deps.store.upsertPacingPlan(plan);
  if (!planSaved.ok) return planSaved;
  return ok({ enrollment, plan });
}

export async function completeLesson(
  deps: { store: CurriculumStore },
  input: { learnerId: UserId; trackId: TrackId; lessonId: LessonId; now: Date }
): AsyncResult<void, 'NOT_FOUND' | 'DB_ERROR'> {
  const enrollment = await deps.store.getEnrollment(input.learnerId, input.trackId);
  if (!enrollment.ok) return enrollment;
  if (!enrollment.val) return err('NOT_FOUND', { message: 'Not enrolled in this track' });
  return deps.store.markLessonCompleted({
    enrollmentId: enrollment.val.id,
    lessonId: input.lessonId,
    completedAt: input.now,
  });
}

export async function whatIsDue(
  deps: { store: CurriculumStore },
  input: { learnerId: UserId; trackId: TrackId; now: Date }
): AsyncResult<DueReport, 'NOT_FOUND' | 'DB_ERROR'> {
  const enrollment = await deps.store.getEnrollment(input.learnerId, input.trackId);
  if (!enrollment.ok) return enrollment;
  if (!enrollment.val) return err('NOT_FOUND', { message: 'Not enrolled in this track' });
  const plan = await deps.store.getPacingPlan(enrollment.val.id);
  if (!plan.ok) return plan;
  if (!plan.val) return err('NOT_FOUND', { message: 'No pacing plan for this enrollment' });
  const outline = await getOutline(deps, input.trackId);
  if (!outline.ok) return outline;
  const completed = await deps.store.listCompletedLessons(enrollment.val.id);
  if (!completed.ok) return completed;
  return ok(
    dueLessons(
      plan.val,
      lessonsInOrder(outline.val),
      new Set(completed.val.map((p) => p.lessonId)),
      input.now
    )
  );
}
