/**
 * The session guard every page and route references (or is listed in
 * test/route-auth-coverage.test.ts with a reason for not doing so). Roles and
 * age band come from the database on every call, never from the cookie.
 */

import type { AsyncResult } from '@campfhir/safe-functions/types';
import { getSessionUser, type SessionUser } from '@glib-glub/identity';
import { headers } from 'next/headers';

import { getDeps, type DepsErrorTag } from './deps';

export type SessionErrorTag = DepsErrorTag | 'NO_SESSION' | 'AUTH_ERROR' | 'NOT_FOUND' | 'DB_ERROR';

/**
 * The signed-in user behind the current request, from its cookies.
 *
 * `headers()` is deliberately NOT wrapped in `wrapAsync`: during a
 * prerender Next signals "this route is dynamic" by throwing from it, and
 * swallowing that signal turned every guarded page into a static redirect.
 * Chaining without `await` keeps the harness rule satisfied and the signal
 * intact — nothing here can reject except Next's own control flow.
 */
export function getSessionFromHeaders(): AsyncResult<SessionUser, SessionErrorTag> {
  // Read the headers first: a build without the runtime environment must
  // still learn that this route is dynamic before any other failure.
  return headers().then((incoming): AsyncResult<SessionUser, SessionErrorTag> => {
    const deps = getDeps();
    if (!deps.ok) return Promise.resolve(deps);
    return getSessionUser(
      { store: deps.val.identity, authenticator: deps.val.authenticator },
      new Headers(incoming)
    );
  });
}

/** The same, for a route handler or action that already holds the request's headers. */
export function getSessionFor(requestHeaders: Headers): AsyncResult<SessionUser, SessionErrorTag> {
  const deps = getDeps();
  if (!deps.ok) return Promise.resolve(deps);
  return getSessionUser(
    { store: deps.val.identity, authenticator: deps.val.authenticator },
    requestHeaders
  );
}

export type { SessionUser };
