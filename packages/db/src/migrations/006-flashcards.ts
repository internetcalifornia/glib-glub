/**
 * Flashcard decks and cards with their SM-2 state. `easiness` is numeric
 * (not float) so the value read back equals the value written and the
 * next interval is reproducible.
 */

import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('decks')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('learner_id', 'uuid', (col) =>
      col.notNull().references('user.id').onDelete('cascade')
    )
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('lesson_id', 'uuid', (col) => col.references('lessons.id').onDelete('set null'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema.createIndex('decks_learner_idx').on('decks').column('learner_id').execute();

  await db.schema
    .createTable('cards')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('deck_id', 'uuid', (col) => col.notNull().references('decks.id').onDelete('cascade'))
    .addColumn('front', 'text', (col) => col.notNull())
    .addColumn('back', 'text', (col) => col.notNull())
    .addColumn('easiness', 'numeric(4, 2)', (col) => col.notNull().defaultTo(2.5))
    .addColumn('interval_days', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('repetitions', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('due_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('last_reviewed_at', 'timestamptz')
    .execute();
  await db.schema
    .createIndex('cards_deck_due_idx')
    .on('cards')
    .columns(['deck_id', 'due_at'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('cards').execute();
  await db.schema.dropTable('decks').execute();
}
