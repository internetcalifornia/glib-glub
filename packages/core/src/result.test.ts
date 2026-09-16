/**
 * The shared Result helper: `fromNullable` turns absence into a tagged
 * error and narrows the value to non-null on the success branch.
 */

import { describe, expect, it } from 'vitest';

import { fromNullable } from './result';

describe('fromNullable', () => {
  it('wraps a present value', () => {
    expect(fromNullable(3, 'NOT_FOUND')).toEqual({ ok: true, val: 3 });
  });

  it('tags null and undefined as the given error, with the message when given', () => {
    expect(fromNullable(null, 'NOT_FOUND')).toEqual({ ok: false, err: { type: 'NOT_FOUND' } });
    expect(fromNullable(undefined, 'NOT_FOUND', 'no such row')).toEqual({
      ok: false,
      err: { type: 'NOT_FOUND', message: 'no such row' },
    });
  });
});
