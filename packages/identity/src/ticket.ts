/**
 * A gateway ticket: how the browser proves to `apps/voice-gateway` who it is.
 *
 * The session cookie belongs to the web app's origin and does not travel to
 * a WebSocket on another host, so the web app mints a short-lived token
 * bound to the user id and hands it to the page; the gateway, which shares
 * `AUTH_SECRET`, verifies it before starting a session. The ticket carries
 * no roles — the gateway reads those from the database like everyone else.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { Result } from '@campfhir/safe-functions/types';
import { brandId, isUuid, type UserId } from '@glib-glub/core';
import { createHmac, timingSafeEqual } from 'node:crypto';

export type TicketErrorTag = 'INVALID_TICKET' | 'EXPIRED_TICKET';

export const GATEWAY_TICKET_TTL_SECONDS = 120;

function sign(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function issueGatewayTicket(input: {
  secret: string;
  userId: UserId;
  now: Date;
  ttlSeconds?: number;
}): string {
  const expires =
    Math.floor(input.now.getTime() / 1000) + (input.ttlSeconds ?? GATEWAY_TICKET_TTL_SECONDS);
  const payload = `${input.userId}.${expires}`;
  return `${payload}.${sign(input.secret, payload)}`;
}

export function verifyGatewayTicket(input: {
  secret: string;
  ticket: string;
  now: Date;
}): Result<UserId, TicketErrorTag> {
  const parts = input.ticket.split('.');
  if (parts.length !== 3) return err('INVALID_TICKET', { message: 'Malformed ticket' });
  const [userId, expiresText, signature] = parts;
  if (!userId || !expiresText || !signature || !isUuid(userId))
    return err('INVALID_TICKET', { message: 'Malformed ticket' });
  const expected = sign(input.secret, `${userId}.${expiresText}`);
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted))
    return err('INVALID_TICKET', { message: 'Bad signature' });
  const expires = Number(expiresText);
  if (!Number.isFinite(expires) || expires * 1000 <= input.now.getTime())
    return err('EXPIRED_TICKET', { message: 'Ticket has expired' });
  return ok(brandId<'user'>(userId));
}
