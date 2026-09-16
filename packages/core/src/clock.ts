/**
 * Time as an injected dependency.
 *
 * Pacing plans ("due tomorrow"), SM-2 review intervals, and session timeouts
 * are all functions of "now". A module that reads `Date.now()` directly can
 * only be tested by waiting, or by patching globals; a module that takes a
 * `Clock` is tested with `fixedClock` and a date of the test's choosing.
 */

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

/** A clock frozen at one instant. `advance` moves it, for tests that need a
 *  sequence of moments. */
export function fixedClock(at: Date): Clock & { advance(ms: number): void } {
  let current = new Date(at.getTime());
  return {
    now: () => new Date(current.getTime()),
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
  };
}
