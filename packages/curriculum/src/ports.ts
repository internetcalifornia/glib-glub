/**
 * The seams: the catalogue tables, and the slice of identity that says
 * whether an actor may author (their roles).
 */

import type { AsyncResult } from '@campfhir/safe-functions/types';
import type { EnrollmentId, LessonId, SubjectId, TrackId, UnitId, UserId } from '@glib-glub/core';
import type { Role } from '@glib-glub/identity';

import type {
  Category,
  Enrollment,
  Lesson,
  LessonProgress,
  PacingPlan,
  Subject,
  Track,
  TrackVisibility,
  Unit,
} from './types';

export interface Roles {
  rolesOf(userId: UserId): AsyncResult<Role[], 'DB_ERROR'>;
}

export interface CurriculumStore {
  listCategories(): AsyncResult<Category[], 'DB_ERROR'>;
  listSubjects(): AsyncResult<Subject[], 'DB_ERROR'>;
  upsertCategory(category: Category): AsyncResult<void, 'DB_ERROR'>;
  upsertSubject(subject: Subject): AsyncResult<void, 'DB_ERROR'>;
  getSubject(id: SubjectId): AsyncResult<Subject | null, 'DB_ERROR'>;

  createTrack(track: Track): AsyncResult<void, 'DB_ERROR'>;
  getTrack(id: TrackId): AsyncResult<Track | null, 'DB_ERROR'>;
  listTracksInSubject(subjectId: SubjectId): AsyncResult<Track[], 'DB_ERROR'>;
  listTracksByAuthor(authorId: UserId): AsyncResult<Track[], 'DB_ERROR'>;
  setTrackVisibility(
    id: TrackId,
    visibility: TrackVisibility
  ): AsyncResult<void, 'DB_ERROR' | 'NOT_FOUND'>;

  addUnit(unit: Unit): AsyncResult<void, 'DB_ERROR'>;
  listUnits(trackId: TrackId): AsyncResult<Unit[], 'DB_ERROR'>;
  addLesson(lesson: Lesson): AsyncResult<void, 'DB_ERROR'>;
  listLessons(trackId: TrackId): AsyncResult<Lesson[], 'DB_ERROR'>;
  getLesson(id: LessonId): AsyncResult<Lesson | null, 'DB_ERROR'>;
  getUnit(id: UnitId): AsyncResult<Unit | null, 'DB_ERROR'>;

  createEnrollment(enrollment: Enrollment): AsyncResult<void, 'DB_ERROR'>;
  getEnrollment(learnerId: UserId, trackId: TrackId): AsyncResult<Enrollment | null, 'DB_ERROR'>;
  getEnrollmentById(id: EnrollmentId): AsyncResult<Enrollment | null, 'DB_ERROR'>;
  listEnrollments(learnerId: UserId): AsyncResult<Enrollment[], 'DB_ERROR'>;

  upsertPacingPlan(plan: PacingPlan): AsyncResult<void, 'DB_ERROR'>;
  getPacingPlan(enrollmentId: EnrollmentId): AsyncResult<PacingPlan | null, 'DB_ERROR'>;

  markLessonCompleted(progress: LessonProgress): AsyncResult<void, 'DB_ERROR'>;
  listCompletedLessons(enrollmentId: EnrollmentId): AsyncResult<LessonProgress[], 'DB_ERROR'>;
}

export interface CurriculumDeps {
  store: CurriculumStore;
  roles: Roles;
}
