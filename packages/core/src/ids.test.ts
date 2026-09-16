/**
 * Ids are UUIDs, brands are phantom: `newId` produces a valid v4 UUID every
 * time, `isUuid` accepts only well-formed ids, and a brand costs nothing at
 * runtime (the branded value IS the string).
 */

import { describe, expect, it } from 'vitest';

import { brandId, isUuid, newId } from './ids';
import type { TrackId, UserId } from './ids';

describe('newId', () => {
  it('produces a well-formed v4 UUID', () => {
    const id = newId<'user'>();

    expect(isUuid(id)).toBe(true);
    expect(id.charAt(14)).toBe('4');
  });

  it('never repeats across a burst of calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId<'user'>()));

    expect(ids.size).toBe(1000);
  });
});

describe('isUuid', () => {
  it('rejects strings that merely look uuid-shaped', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('zzzzzzzz-zzzz-4zzz-8zzz-zzzzzzzzzzzz')).toBe(false);
    expect(isUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
  });
});

describe('brandId', () => {
  it('is the identity at runtime — the brand is a type, not a wrapper', () => {
    const raw = '123e4567-e89b-42d3-a456-426614174000';
    const user: UserId = brandId<'user'>(raw);
    const track: TrackId = brandId<'track'>(raw);

    expect(user).toBe(raw);
    expect(track).toBe(raw);
  });
});
