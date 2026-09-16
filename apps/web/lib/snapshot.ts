/**
 * Rebuilding a learner's snapshot from the web app: the profile module owns
 * the snapshot, the assessment module owns level estimates, and the two
 * name subjects differently (an id there, a display name here). This is
 * the translation, done once.
 */

import { ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import type { UserId } from '@glib-glub/core';
import { rebuildSnapshot, type LevelEstimate, type Snapshot } from '@glib-glub/learner-profile';

import type { Deps } from './deps';

export function rebuildLearnerSnapshot(
  deps: Deps,
  learnerId: UserId
): AsyncResult<Snapshot, 'DB_ERROR'> {
  return rebuildSnapshot(
    {
      store: deps.profiles,
      levelEstimates: async (id): AsyncResult<LevelEstimate[], 'DB_ERROR'> => {
        const estimates = await deps.assessment.listLevelEstimates(id);
        if (!estimates.ok) return estimates;
        const named = [];
        for (const estimate of estimates.val) {
          const subject = await deps.curriculum.getSubject(estimate.subjectId);
          if (!subject.ok) return subject;
          named.push({
            subject: subject.val?.name ?? estimate.subjectId,
            level: estimate.level,
            confidence: estimate.score,
          });
        }
        return ok(named);
      },
    },
    learnerId
  );
}
