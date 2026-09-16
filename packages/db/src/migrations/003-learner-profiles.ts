/**
 * The learner as a learner: profile, objectives, uploads with their
 * extractions, and the versioned personalisation snapshot the tutor reads.
 *
 * `upload_extractions` keeps the full extracted text — the snapshot only
 * ever carries the summary (packages/learner-profile/src/snapshot.ts), but
 * re-summarising later, or letting an educator read what was submitted,
 * needs the text. A rejected upload never gets a row here.
 */

import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('learner_profiles')
    .addColumn('user_id', 'uuid', (col) =>
      col.primaryKey().references('user.id').onDelete('cascade')
    )
    .addColumn('about', 'text', (col) => col.notNull().defaultTo(''))
    .addColumn('interests', sql`text[]`, (col) => col.notNull().defaultTo(sql`'{}'`))
    .addColumn('learning_styles', sql`text[]`, (col) => col.notNull().defaultTo(sql`'{}'`))
    .addColumn('preferred_language', 'text', (col) => col.notNull().defaultTo('en'))
    .addColumn('grade_label', 'text')
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable('learning_objectives')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('learner_id', 'uuid', (col) =>
      col.notNull().references('user.id').onDelete('cascade')
    )
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('active'))
    .addColumn('set_by', 'uuid', (col) => col.notNull().references('user.id'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addCheckConstraint(
      'learning_objectives_status_check',
      sql`status in ('active', 'achieved', 'archived')`
    )
    .execute();
  await db.schema
    .createIndex('learning_objectives_learner_idx')
    .on('learning_objectives')
    .columns(['learner_id', 'status'])
    .execute();

  await db.schema
    .createTable('uploads')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('learner_id', 'uuid', (col) =>
      col.notNull().references('user.id').onDelete('cascade')
    )
    .addColumn('file_name', 'text', (col) => col.notNull())
    .addColumn('mime_type', 'text', (col) => col.notNull())
    .addColumn('byte_size', 'integer', (col) => col.notNull())
    .addColumn('blob_key', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('pending'))
    .addColumn('rejection_reason', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addCheckConstraint(
      'uploads_status_check',
      sql`status in ('pending', 'extracted', 'rejected', 'failed')`
    )
    .execute();
  await db.schema.createIndex('uploads_learner_idx').on('uploads').column('learner_id').execute();

  await db.schema
    .createTable('upload_extractions')
    .addColumn('upload_id', 'uuid', (col) =>
      col.primaryKey().references('uploads.id').onDelete('cascade')
    )
    .addColumn('text', 'text', (col) => col.notNull())
    .addColumn('summary', 'text', (col) => col.notNull())
    .addColumn('tags', sql`text[]`, (col) => col.notNull().defaultTo(sql`'{}'`))
    .addColumn('extracted_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable('personalisation_snapshots')
    .addColumn('learner_id', 'uuid', (col) =>
      col.notNull().references('user.id').onDelete('cascade')
    )
    .addColumn('version', 'integer', (col) => col.notNull())
    .addColumn('digest', 'text', (col) => col.notNull())
    .addColumn('content', 'jsonb', (col) => col.notNull())
    .addColumn('built_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('personalisation_snapshots_pk', ['learner_id', 'version'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('personalisation_snapshots').execute();
  await db.schema.dropTable('upload_extractions').execute();
  await db.schema.dropTable('uploads').execute();
  await db.schema.dropTable('learning_objectives').execute();
  await db.schema.dropTable('learner_profiles').execute();
}
