/**
 * From a request to a `SessionUser`: the cookie names a session, the session
 * names a user, and roles and age band are read fresh from the store. Nothing
 * that gates an action is ever trusted from the cookie itself.
 */

import { ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';

import type { Authenticator, IdentityStore } from './ports';
import type { SessionUser } from './types';

export interface SessionDeps {
  store: IdentityStore;
  authenticator: Authenticator;
}

export async function getSessionUser(
  deps: SessionDeps,
  headers: Headers
): AsyncResult<SessionUser, 'NO_SESSION' | 'AUTH_ERROR' | 'NOT_FOUND' | 'DB_ERROR'> {
  const session = await deps.authenticator.sessionFromHeaders(headers);
  if (!session.ok) return session;

  const user = await deps.store.getUser(session.val.userId);
  if (!user.ok) return user;
  const roles = await deps.store.getRoles(user.val.id);
  if (!roles.ok) return roles;
  const ageBand = await deps.store.getAgeBand(user.val.id);
  if (!ageBand.ok) return ageBand;

  return ok({
    userId: user.val.id,
    email: user.val.email,
    name: user.val.name,
    roles: roles.val,
    ageBand: ageBand.val,
  });
}
