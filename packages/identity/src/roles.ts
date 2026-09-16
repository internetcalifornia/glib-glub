/**
 * Roles: who may do what. A new account is a learner; admins grant the
 * educator and admin roles; the guardian role is earned by an accepted
 * guardianship (see guardianship.ts), never granted directly.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import type { UserId } from '@glib-glub/core';

import type { IdentityStore } from './ports';
import type { Role } from './types';

export interface RoleDeps {
  store: IdentityStore;
}

/** Called once for every new user (Better Auth's `user.create.after` hook in
 *  production). Idempotent: the store ignores a duplicate. */
export async function onUserCreated(deps: RoleDeps, userId: UserId): AsyncResult<void, 'DB_ERROR'> {
  return deps.store.addRole(userId, 'learner');
}

export async function hasRole(
  deps: RoleDeps,
  userId: UserId,
  role: Role
): AsyncResult<boolean, 'DB_ERROR'> {
  const roles = await deps.store.getRoles(userId);
  if (!roles.ok) return roles;
  return ok(roles.val.includes(role));
}

/** Only an admin grants roles, and `guardian` is never granted this way. */
export async function grantRole(
  deps: RoleDeps,
  input: { actorId: UserId; targetUserId: UserId; role: Role }
): AsyncResult<void, 'FORBIDDEN' | 'VALIDATION_ERROR' | 'DB_ERROR'> {
  if (input.role === 'guardian') {
    return err('VALIDATION_ERROR', {
      message: 'The guardian role comes from an accepted guardianship, not a grant',
    });
  }
  const actorIsAdmin = await hasRole(deps, input.actorId, 'admin');
  if (!actorIsAdmin.ok) return actorIsAdmin;
  if (!actorIsAdmin.val) return err('FORBIDDEN', { message: 'Only an admin can grant roles' });
  return deps.store.addRole(input.targetUserId, input.role);
}
