/**
 * Who may change a learner's profile: the learner themselves when their age
 * band allows self-management, or an accepted guardian. One function, used
 * by the bio, objectives and uploads, so the rule cannot drift between them.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import type { UserId } from '@glib-glub/core';
import { canManageOwnObjectives } from '@glib-glub/identity';

import type { Guardians } from './ports';

export interface Actor {
  actorId: UserId;
  learnerId: UserId;
}

export async function assertMayManage(
  guardians: Guardians,
  actor: Actor,
  what: string
): AsyncResult<void, 'FORBIDDEN' | 'DB_ERROR'> {
  if (actor.actorId === actor.learnerId) {
    const band = await guardians.ageBandOf(actor.learnerId);
    if (!band.ok) return band;
    if (canManageOwnObjectives(band.val)) return ok();
    return err('FORBIDDEN', {
      message: `A learner in age band ${band.val ?? 'unset'} needs a guardian to change their ${what}`,
    });
  }
  const guardian = await guardians.isGuardianOf(actor.actorId, actor.learnerId);
  if (!guardian.ok) return guardian;
  if (!guardian.val)
    return err('FORBIDDEN', {
      message: `Only the learner or their guardian may change their ${what}`,
    });
  return ok();
}

/** Uploads are less sensitive: a learner of any age may upload their own work. */
export async function assertMayUpload(
  guardians: Guardians,
  actor: Actor
): AsyncResult<void, 'FORBIDDEN' | 'DB_ERROR'> {
  if (actor.actorId === actor.learnerId) return ok();
  const guardian = await guardians.isGuardianOf(actor.actorId, actor.learnerId);
  if (!guardian.ok) return guardian;
  if (!guardian.val)
    return err('FORBIDDEN', { message: 'Only the learner or their guardian may upload for them' });
  return ok();
}
