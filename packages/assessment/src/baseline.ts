/**
 * A baseline attempt's score becomes a level estimate for the subject:
 * the one number the tutor and the profile snapshot start from. The map
 * is coarse on purpose — four bands are enough to pitch a first session,
 * and a finer scale would only pretend to a precision ten questions do
 * not have.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import type { AttemptId } from '@glib-glub/core';

import { attemptScore } from './attempts';
import type { AssessmentStore } from './ports';
import type { Level, LevelEstimate } from './types';

export function levelFor(ratio: number): Level {
  if (ratio < 0.35) return 'beginning';
  if (ratio < 0.65) return 'developing';
  if (ratio < 0.9) return 'proficient';
  return 'advanced';
}

export async function recordBaseline(
  deps: { store: AssessmentStore },
  attemptId: AttemptId,
  now: Date
): AsyncResult<LevelEstimate, 'NOT_FOUND' | 'VALIDATION_ERROR' | 'DB_ERROR'> {
  const attempt = await deps.store.getAttempt(attemptId);
  if (!attempt.ok) return attempt;
  if (!attempt.val) return err('NOT_FOUND', { message: 'No such attempt' });
  const assessment = await deps.store.getAssessment(attempt.val.assessmentId);
  if (!assessment.ok) return assessment;
  if (!assessment.val) return err('NOT_FOUND', { message: 'No such assessment' });
  if (assessment.val.purpose !== 'baseline' || !assessment.val.subjectId) {
    return err('VALIDATION_ERROR', {
      message: 'Only a baseline test with a subject yields a level estimate',
    });
  }
  const scored = await attemptScore(deps, attemptId);
  if (!scored.ok) return scored;
  const ratio = scored.val.total === 0 ? 0 : scored.val.score / scored.val.total;
  const estimate: LevelEstimate = {
    learnerId: attempt.val.learnerId,
    subjectId: assessment.val.subjectId,
    level: levelFor(ratio),
    score: ratio,
    attemptId,
    estimatedAt: now,
  };
  const saved = await deps.store.upsertLevelEstimate(estimate);
  if (!saved.ok) return saved;
  return ok(estimate);
}
