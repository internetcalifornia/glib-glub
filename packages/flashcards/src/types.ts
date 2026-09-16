/**
 * Decks of cards and each card's schedule — the SM-2 state that decides
 * when it comes back.
 */

import type { CardId, DeckId, LessonId, UserId } from '@glib-glub/core';

export interface Deck {
  readonly id: DeckId;
  readonly learnerId: UserId;
  readonly title: string;
  /** The lesson this deck was derived from, if any. */
  readonly lessonId: LessonId | null;
}

export interface Schedule {
  /** SM-2 easiness factor, ≥ 1.3; starts at 2.5. */
  readonly easiness: number;
  /** Days until the next review after the last one. */
  readonly intervalDays: number;
  /** Consecutive successful reviews. */
  readonly repetitions: number;
  readonly dueAt: Date;
  readonly lastReviewedAt: Date | null;
}

export interface Card {
  readonly id: CardId;
  readonly deckId: DeckId;
  readonly front: string;
  readonly back: string;
  readonly schedule: Schedule;
}

/** 0 = blackout … 5 = perfect recall, as SM-2 defines it. */
export type Quality = 0 | 1 | 2 | 3 | 4 | 5;
