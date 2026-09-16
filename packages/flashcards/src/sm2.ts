/**
 * SM-2, as published by Wozniak (1990) and used by every flashcard app
 * since: quality 0–5 per review; ≥ 3 is a success. Successes lengthen the
 * interval (1 day, then 6, then interval × easiness); a failure resets to
 * one day and zero repetitions. Easiness drifts with quality and never
 * drops below 1.3.
 *
 * Pure: takes a schedule and a moment, returns the next schedule.
 */

import type { Quality, Schedule } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_EASINESS = 1.3;

export function newSchedule(now: Date): Schedule {
  return { easiness: 2.5, intervalDays: 0, repetitions: 0, dueAt: now, lastReviewedAt: null };
}

export function review(schedule: Schedule, quality: Quality, now: Date): Schedule {
  const easiness = Math.max(
    MIN_EASINESS,
    schedule.easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );
  if (quality < 3) {
    return {
      easiness,
      intervalDays: 1,
      repetitions: 0,
      dueAt: addDays(now, 1),
      lastReviewedAt: now,
    };
  }
  const repetitions = schedule.repetitions + 1;
  const intervalDays =
    repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.round(schedule.intervalDays * easiness);
  return {
    easiness,
    intervalDays,
    repetitions,
    dueAt: addDays(now, intervalDays),
    lastReviewedAt: now,
  };
}

export function isDue(schedule: Schedule, now: Date): boolean {
  return schedule.dueAt.getTime() <= now.getTime();
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function parseQuality(value: number): Quality | null {
  return value === 0 || value === 1 || value === 2 || value === 3 || value === 4 || value === 5
    ? value
    : null;
}
