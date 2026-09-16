/**
 * The in-memory CurriculumStore, the Roles adapter over an identity store,
 * and the scenario world the step definitions share.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { EnrollmentId, LessonId, SubjectId, TrackId, UnitId, UserId } from '@glib-glub/core';
import { identityWorld, type IdentityStore, type IdentityWorld } from '@glib-glub/identity';

import type { CurriculumStore, Roles } from './ports';
import type {
  Category,
  Enrollment,
  Lesson,
  LessonProgress,
  PacingPlan,
  Subject,
  Track,
  Unit,
} from './types';

export function rolesFromIdentity(store: IdentityStore): Roles {
  return { rolesOf: (userId) => store.getRoles(userId) };
}

export function memoryCurriculumStore(): CurriculumStore {
  const categories = new Map<string, Category>();
  const subjects = new Map<SubjectId, Subject>();
  const tracks = new Map<TrackId, Track>();
  const units = new Map<UnitId, Unit>();
  const lessons = new Map<LessonId, Lesson>();
  const enrollments = new Map<EnrollmentId, Enrollment>();
  const plans = new Map<EnrollmentId, PacingPlan>();
  const progress: LessonProgress[] = [];

  return {
    listCategories: async (): ReturnType<CurriculumStore['listCategories']> =>
      ok([...categories.values()]),
    listSubjects: async (): ReturnType<CurriculumStore['listSubjects']> =>
      ok([...subjects.values()]),
    upsertCategory: async (category): ReturnType<CurriculumStore['upsertCategory']> => {
      categories.set(category.id, category);
      return ok();
    },
    upsertSubject: async (subject): ReturnType<CurriculumStore['upsertSubject']> => {
      subjects.set(subject.id, subject);
      return ok();
    },
    getSubject: async (id): ReturnType<CurriculumStore['getSubject']> =>
      ok(subjects.get(id) ?? null),
    createTrack: async (track): ReturnType<CurriculumStore['createTrack']> => {
      tracks.set(track.id, track);
      return ok();
    },
    getTrack: async (id): ReturnType<CurriculumStore['getTrack']> => ok(tracks.get(id) ?? null),
    listTracksInSubject: async (subjectId): ReturnType<CurriculumStore['listTracksInSubject']> =>
      ok([...tracks.values()].filter((track) => track.subjectId === subjectId)),
    listTracksByAuthor: async (authorId): ReturnType<CurriculumStore['listTracksByAuthor']> =>
      ok([...tracks.values()].filter((track) => track.authoredBy === authorId)),
    setTrackVisibility: async (
      id,
      visibility
    ): ReturnType<CurriculumStore['setTrackVisibility']> => {
      const track = tracks.get(id);
      if (!track) return err('NOT_FOUND');
      tracks.set(id, { ...track, visibility });
      return ok();
    },
    addUnit: async (unit): ReturnType<CurriculumStore['addUnit']> => {
      units.set(unit.id, unit);
      return ok();
    },
    listUnits: async (trackId): ReturnType<CurriculumStore['listUnits']> =>
      ok(
        [...units.values()]
          .filter((unit) => unit.trackId === trackId)
          .sort((a, b) => a.position - b.position)
      ),
    addLesson: async (lesson): ReturnType<CurriculumStore['addLesson']> => {
      lessons.set(lesson.id, lesson);
      return ok();
    },
    listLessons: async (trackId): ReturnType<CurriculumStore['listLessons']> => {
      const unitIds = new Set(
        [...units.values()].filter((unit) => unit.trackId === trackId).map((unit) => unit.id)
      );
      return ok([...lessons.values()].filter((lesson) => unitIds.has(lesson.unitId)));
    },
    getLesson: async (id): ReturnType<CurriculumStore['getLesson']> => ok(lessons.get(id) ?? null),
    getUnit: async (id): ReturnType<CurriculumStore['getUnit']> => ok(units.get(id) ?? null),
    createEnrollment: async (enrollment): ReturnType<CurriculumStore['createEnrollment']> => {
      enrollments.set(enrollment.id, enrollment);
      return ok();
    },
    getEnrollment: async (learnerId, trackId): ReturnType<CurriculumStore['getEnrollment']> =>
      ok(
        [...enrollments.values()].find((e) => e.learnerId === learnerId && e.trackId === trackId) ??
          null
      ),
    getEnrollmentById: async (id): ReturnType<CurriculumStore['getEnrollmentById']> =>
      ok(enrollments.get(id) ?? null),
    listEnrollments: async (learnerId): ReturnType<CurriculumStore['listEnrollments']> =>
      ok([...enrollments.values()].filter((e) => e.learnerId === learnerId)),
    upsertPacingPlan: async (plan): ReturnType<CurriculumStore['upsertPacingPlan']> => {
      plans.set(plan.enrollmentId, plan);
      return ok();
    },
    getPacingPlan: async (enrollmentId): ReturnType<CurriculumStore['getPacingPlan']> =>
      ok(plans.get(enrollmentId) ?? null),
    markLessonCompleted: async (entry): ReturnType<CurriculumStore['markLessonCompleted']> => {
      if (
        !progress.some(
          (p) => p.enrollmentId === entry.enrollmentId && p.lessonId === entry.lessonId
        )
      )
        progress.push(entry);
      return ok();
    },
    listCompletedLessons: async (
      enrollmentId
    ): ReturnType<CurriculumStore['listCompletedLessons']> =>
      ok(progress.filter((p) => p.enrollmentId === enrollmentId)),
  };
}

export interface CurriculumWorld {
  identity: IdentityWorld;
  store: CurriculumStore;
  roles: Roles;
  last: { ok: boolean; err?: { type: string } } | undefined;
  person(email: string, role?: 'educator' | 'admin'): Promise<UserId>;
  userIdOf(email: string): Promise<UserId>;
  trackByTitle(title: string): Promise<Track | undefined>;
}

export function curriculumWorld(): CurriculumWorld {
  const identity = identityWorld();
  const store = memoryCurriculumStore();
  return {
    identity,
    store,
    roles: rolesFromIdentity(identity.store),
    last: undefined,
    async person(email, role) {
      const existing = await identity.store.findUserByEmail(email);
      if (!existing.ok || !existing.val) await identity.signUp(email, 'correct horse battery');
      const id = await identity.userIdOf(email);
      if (role) void (await identity.store.addRole(id, role));
      return id;
    },
    userIdOf: (email) => identity.userIdOf(email),
    async trackByTitle(title) {
      const subjects = await store.listSubjects();
      if (!subjects.ok) return undefined;
      for (const subject of subjects.val) {
        const tracks = await store.listTracksInSubject(subject.id);
        const found = tracks.ok ? tracks.val.find((track) => track.title === title) : undefined;
        if (found) return found;
      }
      return undefined;
    },
  };
}
