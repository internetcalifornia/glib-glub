/**
 * The Postgres CurriculumStore. Straight table mappings; teaching order is
 * the `position` columns, unique within their parent.
 */

import { err, ok, wrapAsync } from '@campfhir/safe-functions/helpers';
import { brandId } from '@glib-glub/core';
import type { DB } from '@glib-glub/db';
import { AGE_BANDS, type AgeBand } from '@glib-glub/identity';
import type { Kysely } from 'kysely';

import type { CurriculumStore } from './ports';
import type {
  Cadence,
  Category,
  Enrollment,
  EnrollmentStatus,
  Lesson,
  Subject,
  Track,
  TrackOrigin,
  TrackVisibility,
  Unit,
} from './types';

function toBand(value: string): AgeBand {
  return AGE_BANDS.find((band) => band === value) ?? 'adult';
}
function toVisibility(value: string): TrackVisibility {
  return value === 'published' ? 'published' : value === 'archived' ? 'archived' : 'draft';
}
function toOrigin(value: string): TrackOrigin {
  return value === 'mcp'
    ? 'mcp'
    : value === 'self_directed'
      ? 'self_directed'
      : value === 'seed'
        ? 'seed'
        : 'educator';
}
function toEnrollmentStatus(value: string): EnrollmentStatus {
  return value === 'completed' ? 'completed' : value === 'dropped' ? 'dropped' : 'active';
}
function toCadence(value: string): Cadence {
  return value === 'daily' ? 'daily' : 'weekly';
}

function toTrack(row: {
  id: string;
  subject_id: string;
  title: string;
  summary: string;
  level_min: string;
  level_max: string;
  language: string;
  visibility: string;
  authored_by: string | null;
  origin: string;
  pedagogy: string;
}): Track {
  return {
    id: brandId<'track'>(row.id),
    subjectId: brandId<'subject'>(row.subject_id),
    title: row.title,
    summary: row.summary,
    levelMin: toBand(row.level_min),
    levelMax: toBand(row.level_max),
    language: row.language,
    visibility: toVisibility(row.visibility),
    authoredBy: row.authored_by ? brandId<'user'>(row.authored_by) : null,
    origin: toOrigin(row.origin),
    pedagogy: row.pedagogy,
  };
}

function toUnit(row: { id: string; track_id: string; position: number; title: string }): Unit {
  return {
    id: brandId<'unit'>(row.id),
    trackId: brandId<'track'>(row.track_id),
    position: row.position,
    title: row.title,
  };
}

function toLesson(row: {
  id: string;
  unit_id: string;
  position: number;
  title: string;
  objectives: string[];
  content: string;
  estimated_minutes: number;
}): Lesson {
  return {
    id: brandId<'lesson'>(row.id),
    unitId: brandId<'unit'>(row.unit_id),
    position: row.position,
    title: row.title,
    objectives: row.objectives,
    content: row.content,
    estimatedMinutes: row.estimated_minutes,
  };
}

function toEnrollment(row: {
  id: string;
  learner_id: string;
  track_id: string;
  status: string;
  enrolled_at: Date;
}): Enrollment {
  return {
    id: brandId<'enrollment'>(row.id),
    learnerId: brandId<'user'>(row.learner_id),
    trackId: brandId<'track'>(row.track_id),
    status: toEnrollmentStatus(row.status),
    enrolledAt: row.enrolled_at,
  };
}

export function kyselyCurriculumStore(db: Kysely<DB>): CurriculumStore {
  return {
    listCategories: async (): ReturnType<CurriculumStore['listCategories']> => {
      const rows = await wrapAsync(
        () => db.selectFrom('categories').selectAll().orderBy('name').execute(),
        'DB_ERROR'
      );
      if (!rows.ok) return rows;
      return ok(
        rows.val.map<Category>((row) => ({
          id: brandId<'category'>(row.id),
          slug: row.slug,
          name: row.name,
        }))
      );
    },
    listSubjects: async (): ReturnType<CurriculumStore['listSubjects']> => {
      const rows = await wrapAsync(
        () => db.selectFrom('subjects').selectAll().orderBy('name').execute(),
        'DB_ERROR'
      );
      if (!rows.ok) return rows;
      return ok(
        rows.val.map<Subject>((row) => ({
          id: brandId<'subject'>(row.id),
          categoryId: brandId<'category'>(row.category_id),
          slug: row.slug,
          name: row.name,
        }))
      );
    },
    upsertCategory: async (category): ReturnType<CurriculumStore['upsertCategory']> => {
      const saved = await wrapAsync(
        () =>
          db
            .insertInto('categories')
            .values({ id: category.id, slug: category.slug, name: category.name })
            .onConflict((oc) => oc.column('slug').doUpdateSet({ name: category.name }))
            .execute(),
        'DB_ERROR'
      );
      if (!saved.ok) return saved;
      return ok();
    },
    upsertSubject: async (subject): ReturnType<CurriculumStore['upsertSubject']> => {
      const saved = await wrapAsync(
        () =>
          db
            .insertInto('subjects')
            .values({
              id: subject.id,
              category_id: subject.categoryId,
              slug: subject.slug,
              name: subject.name,
            })
            .onConflict((oc) =>
              oc.columns(['category_id', 'slug']).doUpdateSet({ name: subject.name })
            )
            .execute(),
        'DB_ERROR'
      );
      if (!saved.ok) return saved;
      return ok();
    },
    getSubject: async (id): ReturnType<CurriculumStore['getSubject']> => {
      const row = await wrapAsync(
        () => db.selectFrom('subjects').selectAll().where('id', '=', id).executeTakeFirst(),
        'DB_ERROR'
      );
      if (!row.ok) return row;
      return ok(
        row.val
          ? {
              id,
              categoryId: brandId<'category'>(row.val.category_id),
              slug: row.val.slug,
              name: row.val.name,
            }
          : null
      );
    },

    createTrack: async (track): ReturnType<CurriculumStore['createTrack']> => {
      const saved = await wrapAsync(
        () =>
          db
            .insertInto('tracks')
            .values({
              id: track.id,
              subject_id: track.subjectId,
              title: track.title,
              summary: track.summary,
              level_min: track.levelMin,
              level_max: track.levelMax,
              language: track.language,
              visibility: track.visibility,
              authored_by: track.authoredBy,
              origin: track.origin,
              pedagogy: track.pedagogy,
            })
            .execute(),
        'DB_ERROR'
      );
      if (!saved.ok) return saved;
      return ok();
    },
    getTrack: async (id): ReturnType<CurriculumStore['getTrack']> => {
      const row = await wrapAsync(
        () => db.selectFrom('tracks').selectAll().where('id', '=', id).executeTakeFirst(),
        'DB_ERROR'
      );
      if (!row.ok) return row;
      return ok(row.val ? toTrack(row.val) : null);
    },
    listTracksInSubject: async (subjectId): ReturnType<CurriculumStore['listTracksInSubject']> => {
      const rows = await wrapAsync(
        () =>
          db
            .selectFrom('tracks')
            .selectAll()
            .where('subject_id', '=', subjectId)
            .orderBy('title')
            .execute(),
        'DB_ERROR'
      );
      if (!rows.ok) return rows;
      return ok(rows.val.map(toTrack));
    },
    listTracksByAuthor: async (authorId): ReturnType<CurriculumStore['listTracksByAuthor']> => {
      const rows = await wrapAsync(
        () =>
          db
            .selectFrom('tracks')
            .selectAll()
            .where('authored_by', '=', authorId)
            .orderBy('created_at')
            .execute(),
        'DB_ERROR'
      );
      if (!rows.ok) return rows;
      return ok(rows.val.map(toTrack));
    },
    setTrackVisibility: async (
      id,
      visibility
    ): ReturnType<CurriculumStore['setTrackVisibility']> => {
      const updated = await wrapAsync(
        () =>
          db
            .updateTable('tracks')
            .set({ visibility, updated_at: new Date() })
            .where('id', '=', id)
            .executeTakeFirst(),
        'DB_ERROR'
      );
      if (!updated.ok) return updated;
      if (updated.val.numUpdatedRows === 0n) return err('NOT_FOUND');
      return ok();
    },

    addUnit: async (unit): ReturnType<CurriculumStore['addUnit']> => {
      const saved = await wrapAsync(
        () =>
          db
            .insertInto('units')
            .values({
              id: unit.id,
              track_id: unit.trackId,
              position: unit.position,
              title: unit.title,
            })
            .execute(),
        'DB_ERROR'
      );
      if (!saved.ok) return saved;
      return ok();
    },
    listUnits: async (trackId): ReturnType<CurriculumStore['listUnits']> => {
      const rows = await wrapAsync(
        () =>
          db
            .selectFrom('units')
            .selectAll()
            .where('track_id', '=', trackId)
            .orderBy('position')
            .execute(),
        'DB_ERROR'
      );
      if (!rows.ok) return rows;
      return ok(rows.val.map(toUnit));
    },
    addLesson: async (lesson): ReturnType<CurriculumStore['addLesson']> => {
      const saved = await wrapAsync(
        () =>
          db
            .insertInto('lessons')
            .values({
              id: lesson.id,
              unit_id: lesson.unitId,
              position: lesson.position,
              title: lesson.title,
              objectives: [...lesson.objectives],
              content: lesson.content,
              estimated_minutes: lesson.estimatedMinutes,
            })
            .execute(),
        'DB_ERROR'
      );
      if (!saved.ok) return saved;
      return ok();
    },
    listLessons: async (trackId): ReturnType<CurriculumStore['listLessons']> => {
      const rows = await wrapAsync(
        () =>
          db
            .selectFrom('lessons')
            .innerJoin('units', 'units.id', 'lessons.unit_id')
            .selectAll('lessons')
            .where('units.track_id', '=', trackId)
            .orderBy('units.position')
            .orderBy('lessons.position')
            .execute(),
        'DB_ERROR'
      );
      if (!rows.ok) return rows;
      return ok(rows.val.map(toLesson));
    },
    getLesson: async (id): ReturnType<CurriculumStore['getLesson']> => {
      const row = await wrapAsync(
        () => db.selectFrom('lessons').selectAll().where('id', '=', id).executeTakeFirst(),
        'DB_ERROR'
      );
      if (!row.ok) return row;
      return ok(row.val ? toLesson(row.val) : null);
    },
    getUnit: async (id): ReturnType<CurriculumStore['getUnit']> => {
      const row = await wrapAsync(
        () => db.selectFrom('units').selectAll().where('id', '=', id).executeTakeFirst(),
        'DB_ERROR'
      );
      if (!row.ok) return row;
      return ok(row.val ? toUnit(row.val) : null);
    },

    createEnrollment: async (enrollment): ReturnType<CurriculumStore['createEnrollment']> => {
      const saved = await wrapAsync(
        () =>
          db
            .insertInto('enrollments')
            .values({
              id: enrollment.id,
              learner_id: enrollment.learnerId,
              track_id: enrollment.trackId,
              status: enrollment.status,
              enrolled_at: enrollment.enrolledAt,
            })
            .execute(),
        'DB_ERROR'
      );
      if (!saved.ok) return saved;
      return ok();
    },
    getEnrollment: async (learnerId, trackId): ReturnType<CurriculumStore['getEnrollment']> => {
      const row = await wrapAsync(
        () =>
          db
            .selectFrom('enrollments')
            .selectAll()
            .where('learner_id', '=', learnerId)
            .where('track_id', '=', trackId)
            .executeTakeFirst(),
        'DB_ERROR'
      );
      if (!row.ok) return row;
      return ok(row.val ? toEnrollment(row.val) : null);
    },
    getEnrollmentById: async (id): ReturnType<CurriculumStore['getEnrollmentById']> => {
      const row = await wrapAsync(
        () => db.selectFrom('enrollments').selectAll().where('id', '=', id).executeTakeFirst(),
        'DB_ERROR'
      );
      if (!row.ok) return row;
      return ok(row.val ? toEnrollment(row.val) : null);
    },
    listEnrollments: async (learnerId): ReturnType<CurriculumStore['listEnrollments']> => {
      const rows = await wrapAsync(
        () =>
          db
            .selectFrom('enrollments')
            .selectAll()
            .where('learner_id', '=', learnerId)
            .orderBy('enrolled_at')
            .execute(),
        'DB_ERROR'
      );
      if (!rows.ok) return rows;
      return ok(rows.val.map(toEnrollment));
    },

    upsertPacingPlan: async (plan): ReturnType<CurriculumStore['upsertPacingPlan']> => {
      const values = {
        enrollment_id: plan.enrollmentId,
        cadence: plan.cadence,
        sessions_per_period: plan.sessionsPerPeriod,
        started_at: plan.startedAt,
      };
      const saved = await wrapAsync(
        () =>
          db
            .insertInto('pacing_plans')
            .values(values)
            .onConflict((oc) => oc.column('enrollment_id').doUpdateSet(values))
            .execute(),
        'DB_ERROR'
      );
      if (!saved.ok) return saved;
      return ok();
    },
    getPacingPlan: async (enrollmentId): ReturnType<CurriculumStore['getPacingPlan']> => {
      const row = await wrapAsync(
        () =>
          db
            .selectFrom('pacing_plans')
            .selectAll()
            .where('enrollment_id', '=', enrollmentId)
            .executeTakeFirst(),
        'DB_ERROR'
      );
      if (!row.ok) return row;
      return ok(
        row.val
          ? {
              enrollmentId,
              cadence: toCadence(row.val.cadence),
              sessionsPerPeriod: row.val.sessions_per_period,
              startedAt: row.val.started_at,
            }
          : null
      );
    },

    markLessonCompleted: async (progress): ReturnType<CurriculumStore['markLessonCompleted']> => {
      const saved = await wrapAsync(
        () =>
          db
            .insertInto('lesson_progress')
            .values({
              enrollment_id: progress.enrollmentId,
              lesson_id: progress.lessonId,
              completed_at: progress.completedAt,
            })
            .onConflict((oc) => oc.columns(['enrollment_id', 'lesson_id']).doNothing())
            .execute(),
        'DB_ERROR'
      );
      if (!saved.ok) return saved;
      return ok();
    },
    listCompletedLessons: async (
      enrollmentId
    ): ReturnType<CurriculumStore['listCompletedLessons']> => {
      const rows = await wrapAsync(
        () =>
          db
            .selectFrom('lesson_progress')
            .selectAll()
            .where('enrollment_id', '=', enrollmentId)
            .execute(),
        'DB_ERROR'
      );
      if (!rows.ok) return rows;
      return ok(
        rows.val.map((row) => ({
          enrollmentId,
          lessonId: brandId<'lesson'>(row.lesson_id),
          completedAt: row.completed_at,
        }))
      );
    },
  };
}

/** Everything this package writes, for the integration tier's truncate.
 *  Seeded rows (categories, subjects, seed tracks) are left alone: tests
 *  create their own subjects. */
export const CURRICULUM_TABLES: ReadonlyArray<string> = [
  'lesson_progress',
  'pacing_plans',
  'enrollments',
];
