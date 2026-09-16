/**
 * The clock's contract for tests: `fixedClock` returns the same instant until
 * advanced, and returns copies so a caller mutating the Date cannot move time
 * for everyone else.
 */

import { describe, expect, it } from 'vitest';

import { fixedClock } from './clock';

describe('fixedClock', () => {
  it('stands still until advanced', () => {
    const clock = fixedClock(new Date('2026-09-16T10:00:00Z'));

    expect(clock.now().toISOString()).toBe('2026-09-16T10:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-09-16T10:00:00.000Z');

    clock.advance(60_000);

    expect(clock.now().toISOString()).toBe('2026-09-16T10:01:00.000Z');
  });

  it('hands out copies, so mutating a returned Date changes nothing', () => {
    const clock = fixedClock(new Date('2026-09-16T10:00:00Z'));

    clock.now().setFullYear(1999);

    expect(clock.now().getUTCFullYear()).toBe(2026);
  });
});
