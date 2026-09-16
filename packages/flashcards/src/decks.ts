/**
 * Decks and cards: create, add (by the learner or by the tutor at the end
 * of a session), review with a quality, and ask what is due. Access is
 * simple — a deck belongs to one learner and only they (or a caller acting
 * for them, such as the tutor gateway) touch it.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import { newId, type CardId, type DeckId, type LessonId, type UserId } from '@glib-glub/core';

import type { FlashcardStore } from './ports';
import { isDue, newSchedule, review } from './sm2';
import type { Card, Deck, Quality } from './types';

export interface DeckDeps {
  store: FlashcardStore;
}

export async function createDeck(
  deps: DeckDeps,
  input: { learnerId: UserId; title: string; lessonId?: LessonId | null }
): AsyncResult<Deck, 'VALIDATION_ERROR' | 'DB_ERROR'> {
  const title = input.title.trim();
  if (!title) return err('VALIDATION_ERROR', { message: 'A deck needs a title' });
  const deck: Deck = {
    id: newId<'deck'>(),
    learnerId: input.learnerId,
    title,
    lessonId: input.lessonId ?? null,
  };
  const saved = await deps.store.createDeck(deck);
  if (!saved.ok) return saved;
  return ok(deck);
}

async function ownedDeck(
  deps: DeckDeps,
  learnerId: UserId,
  deckId: DeckId
): AsyncResult<Deck, 'FORBIDDEN' | 'NOT_FOUND' | 'DB_ERROR'> {
  const deck = await deps.store.getDeck(deckId);
  if (!deck.ok) return deck;
  if (!deck.val) return err('NOT_FOUND', { message: 'No such deck' });
  if (deck.val.learnerId !== learnerId) return err('FORBIDDEN', { message: 'Not your deck' });
  return ok(deck.val);
}

export async function addCard(
  deps: DeckDeps,
  input: { learnerId: UserId; deckId: DeckId; front: string; back: string; now: Date }
): AsyncResult<Card, 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'DB_ERROR'> {
  const deck = await ownedDeck(deps, input.learnerId, input.deckId);
  if (!deck.ok) return deck;
  const front = input.front.trim();
  const back = input.back.trim();
  if (!front || !back)
    return err('VALIDATION_ERROR', { message: 'A card needs a front and a back' });
  const card: Card = {
    id: newId<'card'>(),
    deckId: input.deckId,
    front,
    back,
    schedule: newSchedule(input.now),
  };
  const saved = await deps.store.addCard(card);
  if (!saved.ok) return saved;
  return ok(card);
}

export async function reviewCard(
  deps: DeckDeps,
  input: { learnerId: UserId; cardId: CardId; quality: Quality; now: Date }
): AsyncResult<Card, 'FORBIDDEN' | 'NOT_FOUND' | 'DB_ERROR'> {
  const card = await deps.store.getCard(input.cardId);
  if (!card.ok) return card;
  if (!card.val) return err('NOT_FOUND', { message: 'No such card' });
  const deck = await ownedDeck(deps, input.learnerId, card.val.deckId);
  if (!deck.ok) return deck;
  const schedule = review(card.val.schedule, input.quality, input.now);
  const saved = await deps.store.setSchedule(input.cardId, schedule);
  if (!saved.ok) return saved;
  return ok({ ...card.val, schedule });
}

export async function dueCards(
  deps: DeckDeps,
  input: { learnerId: UserId; deckId: DeckId; now: Date }
): AsyncResult<Card[], 'FORBIDDEN' | 'NOT_FOUND' | 'DB_ERROR'> {
  const deck = await ownedDeck(deps, input.learnerId, input.deckId);
  if (!deck.ok) return deck;
  const cards = await deps.store.listCards(input.deckId);
  if (!cards.ok) return cards;
  return ok(
    cards.val
      .filter((card) => isDue(card.schedule, input.now))
      .sort((a, b) => a.schedule.dueAt.getTime() - b.schedule.dueAt.getTime())
  );
}
