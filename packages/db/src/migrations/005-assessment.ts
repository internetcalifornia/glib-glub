/**
 * Questions, assessments, attempts, responses, gradings and level
 * estimates. A grading is append-only: an override is a new row whose
 * `override_of` names the row it replaces, so a grade always has a history.
 * Question bodies are jsonb — six kinds with different keys and rubrics —
 * validated by the package, never queried by field.
 */

import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('questions')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('kind', 'text', (col) => col.notNull())
    .addColumn('prompt', 'text', (col) => col.notNull())
    .addColumn('body', 'jsonb', (col) => col.notNull())
    .addColumn('points', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addCheckConstraint(
      'questions_kind_check',
      sql`kind in ('single_choice', 'multi_select', 'true_false', 'fill_blank', 'short_answer', 'long_answer')`
    )
    .execute();

  await db.schema
    .createTable('assessments')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('purpose', 'text', (col) => col.notNull())
    .addColumn('subject_id', 'uuid', (col) => col.references('subjects.id').onDelete('set null'))
    .addColumn('track_id', 'uuid', (col) => col.references('tracks.id').onDelete('set null'))
    .addColumn('lesson_id', 'uuid', (col) => col.references('lessons.id').onDelete('set null'))
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('draft'))
    .addColumn('created_by', 'uuid', (col) => col.references('user.id').onDelete('set null'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addCheckConstraint('assessments_purpose_check', sql`purpose in ('baseline', 'quiz', 'test')`)
    .addCheckConstraint('assessments_status_check', sql`status in ('draft', 'ready')`)
    .execute();

  await db.schema
    .createTable('assessment_questions')
    .addColumn('assessment_id', 'uuid', (col) =>
      col.notNull().references('assessments.id').onDelete('cascade')
    )
    .addColumn('question_id', 'uuid', (col) =>
      col.notNull().references('questions.id').onDelete('cascade')
    )
    .addColumn('position', 'integer', (col) => col.notNull())
    .addPrimaryKeyConstraint('assessment_questions_pk', ['assessment_id', 'question_id'])
    .execute();

  await db.schema
    .createTable('attempts')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('assessment_id', 'uuid', (col) =>
      col.notNull().references('assessments.id').onDelete('cascade')
    )
    .addColumn('learner_id', 'uuid', (col) =>
      col.notNull().references('user.id').onDelete('cascade')
    )
    .addColumn('submitted_at', 'timestamptz', (col) => col.notNull())
    .execute();
  await db.schema
    .createIndex('attempts_learner_idx')
    .on('attempts')
    .columns(['learner_id', 'assessment_id'])
    .execute();

  await db.schema
    .createTable('responses')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('attempt_id', 'uuid', (col) =>
      col.notNull().references('attempts.id').onDelete('cascade')
    )
    .addColumn('question_id', 'uuid', (col) => col.notNull().references('questions.id'))
    .addColumn('answer', 'jsonb')
    .execute();
  await db.schema
    .createIndex('responses_attempt_idx')
    .on('responses')
    .column('attempt_id')
    .execute();

  await db.schema
    .createTable('gradings')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('response_id', 'uuid', (col) =>
      col.notNull().references('responses.id').onDelete('cascade')
    )
    .addColumn('grader', 'text', (col) => col.notNull())
    .addColumn('score', 'numeric(5, 4)', (col) => col.notNull())
    .addColumn('feedback', 'text', (col) => col.notNull().defaultTo(''))
    .addColumn('override_of', 'uuid', (col) => col.references('gradings.id'))
    .addColumn('graded_by', 'uuid', (col) => col.references('user.id').onDelete('set null'))
    .addColumn('graded_at', 'timestamptz', (col) => col.notNull())
    .addCheckConstraint('gradings_grader_check', sql`grader in ('auto', 'llm', 'educator')`)
    .addCheckConstraint('gradings_score_check', sql`score >= 0 and score <= 1`)
    .execute();
  await db.schema
    .createIndex('gradings_response_idx')
    .on('gradings')
    .column('response_id')
    .execute();

  await db.schema
    .createTable('level_estimates')
    .addColumn('learner_id', 'uuid', (col) =>
      col.notNull().references('user.id').onDelete('cascade')
    )
    .addColumn('subject_id', 'uuid', (col) =>
      col.notNull().references('subjects.id').onDelete('cascade')
    )
    .addColumn('level', 'text', (col) => col.notNull())
    .addColumn('score', 'numeric(5, 4)', (col) => col.notNull())
    .addColumn('attempt_id', 'uuid', (col) =>
      col.notNull().references('attempts.id').onDelete('cascade')
    )
    .addColumn('estimated_at', 'timestamptz', (col) => col.notNull())
    .addPrimaryKeyConstraint('level_estimates_pk', ['learner_id', 'subject_id'])
    .addCheckConstraint(
      'level_estimates_level_check',
      sql`level in ('beginning', 'developing', 'proficient', 'advanced')`
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table of [
    'level_estimates',
    'gradings',
    'responses',
    'attempts',
    'assessment_questions',
    'assessments',
    'questions',
  ]) {
    await db.schema.dropTable(table).execute();
  }
}
