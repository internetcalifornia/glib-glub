/**
 * Tutoring sessions: who, what, mode, status, the problems presented (a
 * jsonb document the hint ladder updates), every turn as text with its
 * speaker, every tool call, and the summary the next session starts from.
 * Transcripts only — no column exists for audio (Decision #5).
 */

import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('tutor_sessions')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('learner_id', 'uuid', (col) =>
      col.notNull().references('user.id').onDelete('cascade')
    )
    .addColumn('track_id', 'uuid', (col) => col.notNull().references('tracks.id'))
    .addColumn('lesson_id', 'uuid', (col) => col.notNull().references('lessons.id'))
    .addColumn('lesson_title', 'text', (col) => col.notNull())
    .addColumn('mode', 'text', (col) => col.notNull())
    .addColumn('transport', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('participants', 'jsonb', (col) => col.notNull().defaultTo(sql`'[]'`))
    .addColumn('problems', 'jsonb', (col) => col.notNull().defaultTo(sql`'[]'`))
    .addColumn('summary', 'jsonb')
    .addColumn('started_at', 'timestamptz', (col) => col.notNull())
    .addColumn('ended_at', 'timestamptz')
    .addCheckConstraint(
      'tutor_sessions_mode_check',
      sql`mode in ('solo', 'with_guardian', 'with_educator')`
    )
    .addCheckConstraint('tutor_sessions_transport_check', sql`transport in ('voice', 'text')`)
    .addCheckConstraint(
      'tutor_sessions_status_check',
      sql`status in ('starting', 'live', 'ending', 'ended', 'failed')`
    )
    .execute();
  await db.schema
    .createIndex('tutor_sessions_learner_idx')
    .on('tutor_sessions')
    .columns(['learner_id', 'track_id', 'ended_at'])
    .execute();

  await db.schema
    .createTable('session_turns')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('session_id', 'uuid', (col) =>
      col.notNull().references('tutor_sessions.id').onDelete('cascade')
    )
    .addColumn('at', 'timestamptz', (col) => col.notNull())
    .addColumn('speaker', 'jsonb', (col) => col.notNull())
    .addColumn('text', 'text', (col) => col.notNull())
    .execute();
  await db.schema
    .createIndex('session_turns_session_idx')
    .on('session_turns')
    .columns(['session_id', 'at'])
    .execute();

  await db.schema
    .createTable('session_tool_calls')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('session_id', 'uuid', (col) =>
      col.notNull().references('tutor_sessions.id').onDelete('cascade')
    )
    .addColumn('at', 'timestamptz', (col) => col.notNull())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('args', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'`))
    .addColumn('result', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'`))
    .execute();
  await db.schema
    .createIndex('session_tool_calls_session_idx')
    .on('session_tool_calls')
    .columns(['session_id', 'at'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('session_tool_calls').execute();
  await db.schema.dropTable('session_turns').execute();
  await db.schema.dropTable('tutor_sessions').execute();
}
