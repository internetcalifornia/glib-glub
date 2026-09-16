/**
 * The catalogue: categories → subjects → tracks → units → lessons, plus a
 * learner's enrollment and pace through a track.
 */

import type {
  Brand,
  CategoryId,
  EnrollmentId,
  LessonId,
  SubjectId,
  TrackId,
  UnitId,
  UserId,
} from '@glib-glub/core';
import type { AgeBand } from '@glib-glub/identity';

export interface Category {
  readonly id: CategoryId;
  readonly slug: string;
  readonly name: string;
}

export interface Subject {
  readonly id: SubjectId;
  readonly categoryId: CategoryId;
  readonly slug: string;
  readonly name: string;
}

export type TrackVisibility = 'draft' | 'published' | 'archived';
export type TrackOrigin = 'educator' | 'mcp' | 'self_directed' | 'seed';

export interface Track {
  readonly id: TrackId;
  readonly subjectId: SubjectId;
  readonly title: string;
  readonly summary: string;
  readonly levelMin: AgeBand;
  readonly levelMax: AgeBand;
  readonly language: string;
  readonly visibility: TrackVisibility;
  /** Null for seeded tracks, which belong to the platform. */
  readonly authoredBy: UserId | null;
  readonly origin: TrackOrigin;
  /** The teaching rules the tutor's instructions carry for this track. */
  readonly pedagogy: string;
}

export interface Unit {
  readonly id: UnitId;
  readonly trackId: TrackId;
  readonly position: number;
  readonly title: string;
}

export interface Lesson {
  readonly id: LessonId;
  readonly unitId: UnitId;
  readonly position: number;
  readonly title: string;
  readonly objectives: ReadonlyArray<string>;
  /** Markdown the tutor reads as its own notes — never spoken verbatim. */
  readonly content: string;
  readonly estimatedMinutes: number;
}

export type EnrollmentStatus = 'active' | 'completed' | 'dropped';

export interface Enrollment {
  readonly id: EnrollmentId;
  readonly learnerId: UserId;
  readonly trackId: TrackId;
  readonly status: EnrollmentStatus;
  readonly enrolledAt: Date;
}

export type Cadence = 'daily' | 'weekly';

export interface PacingPlan {
  readonly enrollmentId: EnrollmentId;
  readonly cadence: Cadence;
  readonly sessionsPerPeriod: number;
  readonly startedAt: Date;
}

export type LessonProgressId = Brand<string, 'lesson_progress'>;

export interface LessonProgress {
  readonly enrollmentId: EnrollmentId;
  readonly lessonId: LessonId;
  readonly completedAt: Date;
}

/** A track with its structure, as the tutor and the UI consume it. */
export interface TrackOutline {
  readonly track: Track;
  readonly units: ReadonlyArray<Unit & { lessons: ReadonlyArray<Lesson> }>;
}
