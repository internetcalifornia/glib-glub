/**
 * Learning objectives: short goals, at most MAX_ACTIVE_OBJECTIVES active,
 * each remembering who set it. Achieving or archiving moves an objective
 * out of the active list the tutor reads.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import { newId } from '@glib-glub/core';

import { assertMayManage, type Actor } from './access';
import { MAX_ACTIVE_OBJECTIVES } from './errors';
import type { Guardians, ProfileStore } from './ports';
import type { Objective, ObjectiveId, ObjectiveStatus } from './types';

export interface ObjectiveDeps {
  store: ProfileStore;
  guardians: Guardians;
}

export async function addObjective(
  deps: ObjectiveDeps,
  actor: Actor,
  input: { title: string; description?: string }
): AsyncResult<Objective, 'FORBIDDEN' | 'VALIDATION_ERROR' | 'TOO_MANY_OBJECTIVES' | 'DB_ERROR'> {
  const allowed = await assertMayManage(deps.guardians, actor, 'objectives');
  if (!allowed.ok) return allowed;
  const title = input.title.trim();
  if (title.length === 0 || title.length > 200) {
    return err('VALIDATION_ERROR', { message: 'An objective title is 1–200 characters' });
  }

  const existing = await deps.store.listObjectives(actor.learnerId);
  if (!existing.ok) return existing;
  const active = existing.val.filter((objective) => objective.status === 'active');
  if (active.length >= MAX_ACTIVE_OBJECTIVES) {
    return err('TOO_MANY_OBJECTIVES', {
      message: `At most ${MAX_ACTIVE_OBJECTIVES} objectives can be active; achieve or archive one first`,
    });
  }

  const objective: Objective = {
    id: newId<'objective'>(),
    learnerId: actor.learnerId,
    title,
    description: input.description?.trim() || null,
    status: 'active',
    setBy: actor.actorId,
  };
  const saved = await deps.store.addObjective(objective);
  if (!saved.ok) return saved;
  return ok(objective);
}

export async function setObjectiveStatus(
  deps: ObjectiveDeps,
  actor: Actor,
  objectiveId: ObjectiveId,
  status: ObjectiveStatus
): AsyncResult<void, 'FORBIDDEN' | 'NOT_FOUND' | 'DB_ERROR'> {
  const allowed = await assertMayManage(deps.guardians, actor, 'objectives');
  if (!allowed.ok) return allowed;
  const existing = await deps.store.listObjectives(actor.learnerId);
  if (!existing.ok) return existing;
  if (!existing.val.some((objective) => objective.id === objectiveId)) {
    return err('NOT_FOUND', { message: 'No such objective for this learner' });
  }
  return deps.store.setObjectiveStatus(objectiveId, status);
}

export async function listObjectives(
  deps: { store: ProfileStore },
  learnerId: Actor['learnerId'],
  status?: ObjectiveStatus
): AsyncResult<Objective[], 'DB_ERROR'> {
  const all = await deps.store.listObjectives(learnerId);
  if (!all.ok) return all;
  return ok(status ? all.val.filter((objective) => objective.status === status) : all.val);
}
