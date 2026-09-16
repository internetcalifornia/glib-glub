/**
 * Guardianship: a guardian invites a learner; the learner (or one of the
 * learner's existing guardians) accepts. Only an accepted guardianship
 * grants anything — the guardian role, the right to set the learner's
 * objectives, to sit in on sessions, to link logins on their behalf.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import type { UserId } from '@glib-glub/core';

import type { IdentityStore } from './ports';
import type { Guardianship } from './types';

export interface GuardianshipDeps {
  store: IdentityStore;
}

export async function inviteLearner(
  deps: GuardianshipDeps,
  input: { guardianId: UserId; learnerId: UserId }
): AsyncResult<Guardianship, 'VALIDATION_ERROR' | 'INVALID_STATE' | 'NOT_FOUND' | 'DB_ERROR'> {
  if (input.guardianId === input.learnerId) {
    return err('VALIDATION_ERROR', { message: 'A person cannot be their own guardian' });
  }
  const learner = await deps.store.getUser(input.learnerId);
  if (!learner.ok) return learner;

  const existing = await deps.store.getGuardianship(input.guardianId, input.learnerId);
  if (!existing.ok) return existing;
  if (existing.val?.status === 'accepted') {
    return err('INVALID_STATE', { message: 'Already a guardian of this learner' });
  }
  return deps.store.upsertGuardianship({ ...input, status: 'invited' });
}

/**
 * The learner accepts, or an already-accepted guardian of the learner
 * accepts on their behalf (a parent adding the other parent).
 */
export async function acceptGuardianship(
  deps: GuardianshipDeps,
  input: { actorId: UserId; guardianId: UserId; learnerId: UserId }
): AsyncResult<Guardianship, 'FORBIDDEN' | 'INVALID_STATE' | 'NOT_FOUND' | 'DB_ERROR'> {
  const invitation = await deps.store.getGuardianship(input.guardianId, input.learnerId);
  if (!invitation.ok) return invitation;
  if (!invitation.val) return err('NOT_FOUND', { message: 'No such invitation' });
  if (invitation.val.status !== 'invited') {
    return err('INVALID_STATE', { message: `Guardianship is ${invitation.val.status}` });
  }

  const actorMayAccept =
    input.actorId === input.learnerId || (await isGuardianOf(deps, input.actorId, input.learnerId));
  if (typeof actorMayAccept !== 'boolean') {
    if (!actorMayAccept.ok) return actorMayAccept;
    if (!actorMayAccept.val)
      return err('FORBIDDEN', { message: 'Only the learner or an accepted guardian may accept' });
  }

  const accepted = await deps.store.upsertGuardianship({
    guardianId: input.guardianId,
    learnerId: input.learnerId,
    status: 'accepted',
  });
  if (!accepted.ok) return accepted;

  const role = await deps.store.addRole(input.guardianId, 'guardian');
  if (!role.ok) return role;
  return ok(accepted.val);
}

export async function isGuardianOf(
  deps: GuardianshipDeps,
  guardianId: UserId,
  learnerId: UserId
): AsyncResult<boolean, 'DB_ERROR'> {
  const guardianship = await deps.store.getGuardianship(guardianId, learnerId);
  if (!guardianship.ok) return guardianship;
  return ok(guardianship.val?.status === 'accepted');
}
