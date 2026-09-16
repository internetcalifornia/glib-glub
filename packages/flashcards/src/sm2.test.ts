/**
 * SM-2's arithmetic, pinned: the first two intervals are fixed, later ones
 * multiply by easiness, a failure resets, and easiness never drops below
 * 1.3 however badly a card goes.
 */

import { describe, expect, it } from 'vitest';

import { newSchedule, review } from './sm2';

const day = (n: number) => new Date(Date.UTC(2026, 8, n, 9));

describe('review', () => {
  it('spaces successes 1, 6, then interval × easiness', () => {
    let schedule = newSchedule(day(16));

    schedule = review(schedule, 5, day(16));
    expect(schedule.intervalDays).toBe(1);
    schedule = review(schedule, 5, day(17));
    expect(schedule.intervalDays).toBe(6);
    schedule = review(schedule, 5, day(23));

    expect(schedule.repetitions).toBe(3);
    expect(schedule.intervalDays).toBe(17);
    expect(schedule.easiness).toBeCloseTo(2.8, 5);
  });

  it('resets on a failure but keeps the lowered easiness', () => {
    const primed = review(review(newSchedule(day(16)), 5, day(16)), 5, day(17));

    const failed = review(primed, 1, day(23));

    expect(failed.repetitions).toBe(0);
    expect(failed.intervalDays).toBe(1);
    expect(failed.easiness).toBeLessThan(primed.easiness);
  });

  it('never lets easiness fall below 1.3', () => {
    let schedule = newSchedule(day(16));
    for (let i = 0; i < 20; i += 1) schedule = review(schedule, 0, day(16));

    expect(schedule.easiness).toBe(1.3);
  });
});
