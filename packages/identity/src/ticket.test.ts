/**
 * Gateway tickets: a ticket verifies with the secret that issued it and
 * names the user; a different secret, a tampered user id, and an expired
 * ticket are each refused with their own tag.
 */

import { newId } from '@glib-glub/core';
import { describe, expect, it } from 'vitest';

import { issueGatewayTicket, verifyGatewayTicket } from './ticket';

const secret = 'an-auth-secret-at-least-32-characters-long';
const issuedAt = new Date('2026-09-16T09:00:00Z');

describe('verifyGatewayTicket', () => {
  it('accepts a fresh ticket from the same secret and returns the user id', () => {
    const userId = newId<'user'>();
    const ticket = issueGatewayTicket({ secret, userId, now: issuedAt });

    const verified = verifyGatewayTicket({
      secret,
      ticket,
      now: new Date(issuedAt.getTime() + 30_000),
    });

    expect(verified.ok && verified.val).toBe(userId);
  });

  it('refuses a ticket signed with another secret', () => {
    const ticket = issueGatewayTicket({
      secret: 'other-secret',
      userId: newId<'user'>(),
      now: issuedAt,
    });

    const verified = verifyGatewayTicket({ secret, ticket, now: issuedAt });

    expect(!verified.ok && verified.err.type).toBe('INVALID_TICKET');
  });

  it('refuses a ticket whose user id was swapped', () => {
    const ticket = issueGatewayTicket({ secret, userId: newId<'user'>(), now: issuedAt });
    const [, expires, signature] = ticket.split('.');
    const forged = `${newId<'user'>()}.${expires}.${signature}`;

    const verified = verifyGatewayTicket({ secret, ticket: forged, now: issuedAt });

    expect(!verified.ok && verified.err.type).toBe('INVALID_TICKET');
  });

  it('refuses an expired ticket', () => {
    const ticket = issueGatewayTicket({
      secret,
      userId: newId<'user'>(),
      now: issuedAt,
      ttlSeconds: 10,
    });

    const verified = verifyGatewayTicket({
      secret,
      ticket,
      now: new Date(issuedAt.getTime() + 11_000),
    });

    expect(!verified.ok && verified.err.type).toBe('EXPIRED_TICKET');
  });
});
