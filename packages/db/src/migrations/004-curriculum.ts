/**
 * The catalogue: categories → subjects → tracks → units → lessons, and a
 * learner's enrollment, pacing plan and lesson progress.
 *
 * `authored_by` is nullable: seeded tracks (migrations 010, 011) belong to
 * the platform, not to a user. Positions are unique within their parent so
 * teaching order is a property of the data, not of insertion order.
 */

import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('categories')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('slug', 'text', (col) => col.notNull().unique())
    .addColumn('name', 'text', (col) => col.notNull())
    .execute();

  await db.schema
    .createTable('subjects')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('category_id', 'uuid', (col) =>
      col.notNull().references('categories.id').onDelete('cascade')
    )
    .addColumn('slug', 'text', (col) => col.notNull())
    .addColumn('name', 'text', (col) => col.notNull())
    .addUniqueConstraint('subjects_category_slug_unique', ['category_id', 'slug'])
    .execute();

  await db.schema
    .createTable('tracks')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('subject_id', 'uuid', (col) => col.notNull().references('subjects.id'))
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('summary', 'text', (col) => col.notNull().defaultTo(''))
    .addColumn('level_min', 'text', (col) => col.notNull())
    .addColumn('level_max', 'text', (col) => col.notNull())
    .addColumn('language', 'text', (col) => col.notNull().defaultTo('en'))
    .addColumn('visibility', 'text', (col) => col.notNull().defaultTo('draft'))
    .addColumn('authored_by', 'uuid', (col) => col.references('user.id').onDelete('set null'))
    .addColumn('origin', 'text', (col) => col.notNull())
    .addColumn('pedagogy', 'text', (col) => col.notNull().defaultTo(''))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addCheckConstraint(
      'tracks_visibility_check',
      sql`visibility in ('draft', 'published', 'archived')`
    )
    .addCheckConstraint(
      'tracks_origin_check',
      sql`origin in ('educator', 'mcp', 'self_directed', 'seed')`
    )
    .execute();
  await db.schema
    .createIndex('tracks_subject_idx')
    .on('tracks')
    .columns(['subject_id', 'visibility'])
    .execute();
  await db.schema.createIndex('tracks_author_idx').on('tracks').column('authored_by').execute();

  await db.schema
    .createTable('units')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('track_id', 'uuid', (col) =>
      col.notNull().references('tracks.id').onDelete('cascade')
    )
    .addColumn('position', 'integer', (col) => col.notNull())
    .addColumn('title', 'text', (col) => col.notNull())
    .addUniqueConstraint('units_track_position_unique', ['track_id', 'position'])
    .execute();

  await db.schema
    .createTable('lessons')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('unit_id', 'uuid', (col) => col.notNull().references('units.id').onDelete('cascade'))
    .addColumn('position', 'integer', (col) => col.notNull())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('objectives', sql`text[]`, (col) => col.notNull().defaultTo(sql`'{}'`))
    .addColumn('content', 'text', (col) => col.notNull().defaultTo(''))
    .addColumn('estimated_minutes', 'integer', (col) => col.notNull().defaultTo(20))
    .addUniqueConstraint('lessons_unit_position_unique', ['unit_id', 'position'])
    .execute();

  await db.schema
    .createTable('enrollments')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('learner_id', 'uuid', (col) =>
      col.notNull().references('user.id').onDelete('cascade')
    )
    .addColumn('track_id', 'uuid', (col) =>
      col.notNull().references('tracks.id').onDelete('cascade')
    )
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('active'))
    .addColumn('enrolled_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint('enrollments_learner_track_unique', ['learner_id', 'track_id'])
    .addCheckConstraint(
      'enrollments_status_check',
      sql`status in ('active', 'completed', 'dropped')`
    )
    .execute();

  await db.schema
    .createTable('pacing_plans')
    .addColumn('enrollment_id', 'uuid', (col) =>
      col.primaryKey().references('enrollments.id').onDelete('cascade')
    )
    .addColumn('cadence', 'text', (col) => col.notNull())
    .addColumn('sessions_per_period', 'integer', (col) => col.notNull())
    .addColumn('started_at', 'timestamptz', (col) => col.notNull())
    .addCheckConstraint('pacing_plans_cadence_check', sql`cadence in ('daily', 'weekly')`)
    .execute();

  await db.schema
    .createTable('lesson_progress')
    .addColumn('enrollment_id', 'uuid', (col) =>
      col.notNull().references('enrollments.id').onDelete('cascade')
    )
    .addColumn('lesson_id', 'uuid', (col) =>
      col.notNull().references('lessons.id').onDelete('cascade')
    )
    .addColumn('completed_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('lesson_progress_pk', ['enrollment_id', 'lesson_id'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table of [
    'lesson_progress',
    'pacing_plans',
    'enrollments',
    'lessons',
    'units',
    'tracks',
    'subjects',
    'categories',
  ]) {
    await db.schema.dropTable(table).execute();
  }
}
