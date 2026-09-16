/**
 * Pacing: a cadence (daily or weekly) and a number of sessions per period
 * turn a track into "what is due now". Pure — the enrollment functions
 * hand it the plan, the ordered lessons, and what has been completed.
 *
 * Period k (1-based) begins k−1 periods after the plan started. Before
 * period k the learner should have completed (k−1) × sessionsPerPeriod
 * lessons; the shortfall is how far behind they are. What is due is the
 * next sessionsPerPeriod uncompleted lessons, plus anything they are behind
 * on — catching up is part of what is due.
 */

import type { LessonId } from '@glib-glub/core';

import type { Cadence, Lesson, PacingPlan } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export function periodLengthMs(cadence: Cadence): number {
  return cadence === 'daily' ? DAY_MS : 7 * DAY_MS;
}

export interface DueReport {
  /** The current period, 1-based. */
  period: number;
  due: Lesson[];
  behindBy: number;
  /** True when every lesson is completed. */
  finished: boolean;
}

export function dueLessons(
  plan: PacingPlan,
  lessons: ReadonlyArray<Lesson>,
  completed: ReadonlySet<LessonId>,
  now: Date
): DueReport {
  const elapsed = Math.max(0, now.getTime() - plan.startedAt.getTime());
  const period = Math.floor(elapsed / periodLengthMs(plan.cadence)) + 1;
  const remaining = lessons.filter((lesson) => !completed.has(lesson.id));
  const expectedBefore = (period - 1) * plan.sessionsPerPeriod;
  const behindBy = Math.max(0, Math.min(expectedBefore - completed.size, remaining.length));
  const due = remaining.slice(0, behindBy + plan.sessionsPerPeriod);
  return { period, due, behindBy, finished: remaining.length === 0 };
}
