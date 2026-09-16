/**
 * Better Auth's own routes (Decision #3): sign-up, sign-in, OAuth callbacks,
 * passkey ceremonies, sign-out. Everything here mints or ends sessions; it
 * is the one route family that is reachable without one.
 */

import { getDeps } from '@/lib/deps';
import { toNextJsHandler } from 'better-auth/next-js';

const handler = toNextJsHandler(async (request: Request): Promise<Response> => {
  const deps = getDeps();
  if (!deps.ok) return Response.json({ error: deps.err.type }, { status: 500 });
  return deps.val.auth.handler(request);
});

export const { GET, POST } = handler;
