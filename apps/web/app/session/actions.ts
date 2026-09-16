'use server';

/**
 * The one thing the session page needs from the server at connect time: a
 * short-lived gateway ticket for the signed-in person, and where to
 * connect. Minted on demand so a page left open does not hold a stale one.
 */

import { issueGatewayTicket } from '@glib-glub/identity';

import { getDeps } from '@/lib/deps';
import { getSessionFromHeaders } from '@/lib/session';

export type TicketResponse =
  { ok: true; ticket: string; gatewayUrl: string } | { ok: false; error: string };

export async function issueTicketAction(): Promise<TicketResponse> {
  const session = await getSessionFromHeaders();
  if (!session.ok) return { ok: false, error: 'Please sign in again.' };
  const deps = getDeps();
  if (!deps.ok) return { ok: false, error: 'The server is not configured.' };
  return {
    ok: true,
    ticket: issueGatewayTicket({
      secret: deps.val.env.AUTH_SECRET,
      userId: session.val.userId,
      now: deps.val.clock.now(),
    }),
    gatewayUrl: deps.val.env.VOICE_GATEWAY_URL,
  };
}
