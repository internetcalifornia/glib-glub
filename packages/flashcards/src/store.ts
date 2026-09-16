/** The Postgres FlashcardStore. */

import { err, ok, wrapAsync } from '@campfhir/safe-functions/helpers';
import { brandId } from '@glib-glub/core';
import type { DB } from '@glib-glub/db';
import type { Kysely } from 'kysely';

import type { FlashcardStore } from './ports';
import type { Card, Deck } from './types';

function toCard(row: {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  /** numeric(4,2) arrives as a string from pg. */
  easiness: string | number;
  interval_days: number;
  repetitions: number;
  due_at: Date;
  last_reviewed_at: Date | null;
}): Card {
  return {
    id: brandId<'card'>(row.id),
    deckId: brandId<'deck'>(row.deck_id),
    front: row.front,
    back: row.back,
    schedule: {
      easiness: Number(row.easiness),
      intervalDays: row.interval_days,
      repetitions: row.repetitions,
      dueAt: row.due_at,
      lastReviewedAt: row.last_reviewed_at,
    },
  };
}

function toDeck(row: {
  id: string;
  learner_id: string;
  title: string;
  lesson_id: string | null;
}): Deck {
  return {
    id: brandId<'deck'>(row.id),
    learnerId: brandId<'user'>(row.learner_id),
    title: row.title,
    lessonId: row.lesson_id ? brandId<'lesson'>(row.lesson_id) : null,
  };
}

export function kyselyFlashcardStore(db: Kysely<DB>): FlashcardStore {
  return {
    createDeck: async (deck): ReturnType<FlashcardStore['createDeck']> => {
      const saved = await wrapAsync(
        () =>
          db
            .insertInto('decks')
            .values({
              id: deck.id,
              learner_id: deck.learnerId,
              title: deck.title,
              lesson_id: deck.lessonId,
            })
            .execute(),
        'DB_ERROR'
      );
      if (!saved.ok) return saved;
      return ok();
    },
    getDeck: async (id): ReturnType<FlashcardStore['getDeck']> => {
      const row = await wrapAsync(
        () => db.selectFrom('decks').selectAll().where('id', '=', id).executeTakeFirst(),
        'DB_ERROR'
      );
      if (!row.ok) return row;
      return ok(row.val ? toDeck(row.val) : null);
    },
    listDecks: async (learnerId): ReturnType<FlashcardStore['listDecks']> => {
      const rows = await wrapAsync(
        () =>
          db
            .selectFrom('decks')
            .selectAll()
            .where('learner_id', '=', learnerId)
            .orderBy('title')
            .execute(),
        'DB_ERROR'
      );
      if (!rows.ok) return rows;
      return ok(rows.val.map(toDeck));
    },
    addCard: async (card): ReturnType<FlashcardStore['addCard']> => {
      const saved = await wrapAsync(
        () =>
          db
            .insertInto('cards')
            .values({
              id: card.id,
              deck_id: card.deckId,
              front: card.front,
              back: card.back,
              easiness: card.schedule.easiness,
              interval_days: card.schedule.intervalDays,
              repetitions: card.schedule.repetitions,
              due_at: card.schedule.dueAt,
              last_reviewed_at: card.schedule.lastReviewedAt,
            })
            .execute(),
        'DB_ERROR'
      );
      if (!saved.ok) return saved;
      return ok();
    },
    listCards: async (deckId): ReturnType<FlashcardStore['listCards']> => {
      const rows = await wrapAsync(
        () =>
          db
            .selectFrom('cards')
            .selectAll()
            .where('deck_id', '=', deckId)
            .orderBy('due_at')
            .execute(),
        'DB_ERROR'
      );
      if (!rows.ok) return rows;
      return ok(rows.val.map(toCard));
    },
    getCard: async (id): ReturnType<FlashcardStore['getCard']> => {
      const row = await wrapAsync(
        () => db.selectFrom('cards').selectAll().where('id', '=', id).executeTakeFirst(),
        'DB_ERROR'
      );
      if (!row.ok) return row;
      return ok(row.val ? toCard(row.val) : null);
    },
    setSchedule: async (id, schedule): ReturnType<FlashcardStore['setSchedule']> => {
      const updated = await wrapAsync(
        () =>
          db
            .updateTable('cards')
            .set({
              easiness: schedule.easiness,
              interval_days: schedule.intervalDays,
              repetitions: schedule.repetitions,
              due_at: schedule.dueAt,
              last_reviewed_at: schedule.lastReviewedAt,
            })
            .where('id', '=', id)
            .executeTakeFirst(),
        'DB_ERROR'
      );
      if (!updated.ok) return updated;
      if (updated.val.numUpdatedRows === 0n) return err('NOT_FOUND');
      return ok();
    },
  };
}

export const FLASHCARD_TABLES: ReadonlyArray<string> = ['cards', 'decks'];
