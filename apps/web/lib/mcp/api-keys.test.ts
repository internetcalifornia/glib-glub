/**
 * The pure half of API keys: a fresh secret carries the prefix and enough
 * entropy, the digest is deterministic and never the secret itself, and
 * bearer parsing is strict about the scheme.
 */

import { describe, expect, it } from 'vitest';

import { API_KEY_PREFIX, bearerFrom, hashApiKey, newApiKeySecret } from './api-keys';

describe('newApiKeySecret', () => {
  it('mints distinct prefixed secrets of 32 random bytes', () => {
    const a = newApiKeySecret();
    const b = newApiKeySecret();

    expect(a.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(a).not.toBe(b);
    expect(Buffer.from(a.slice(API_KEY_PREFIX.length), 'base64url')).toHaveLength(32);
  });
});

describe('hashApiKey', () => {
  it('is deterministic and does not contain the secret', () => {
    const secret = newApiKeySecret();

    expect(hashApiKey(secret)).toBe(hashApiKey(secret));
    expect(hashApiKey(secret)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey(secret)).not.toContain(secret.slice(3, 12));
  });
});

describe('bearerFrom', () => {
  it('returns the token only for a Bearer scheme', () => {
    expect(bearerFrom(new Headers({ authorization: 'Bearer gg_abc' }))).toBe('gg_abc');
    expect(bearerFrom(new Headers({ authorization: 'bearer gg_abc' }))).toBe('gg_abc');
    expect(bearerFrom(new Headers({ authorization: 'Basic gg_abc' }))).toBeNull();
    expect(bearerFrom(new Headers())).toBeNull();
  });
});
