import type { AsyncResult } from '@campfhir/safe-functions/types';
import type { CardId, DeckId, UserId } from '@glib-glub/core';

import type { Card, Deck, Schedule } from './types';

export interface FlashcardStore {
  createDeck(deck: Deck): AsyncResult<void, 'DB_ERROR'>;
  getDeck(id: DeckId): AsyncResult<Deck | null, 'DB_ERROR'>;
  listDecks(learnerId: UserId): AsyncResult<Deck[], 'DB_ERROR'>;
  addCard(card: Card): AsyncResult<void, 'DB_ERROR'>;
  listCards(deckId: DeckId): AsyncResult<Card[], 'DB_ERROR'>;
  getCard(id: CardId): AsyncResult<Card | null, 'DB_ERROR'>;
  setSchedule(id: CardId, schedule: Schedule): AsyncResult<void, 'DB_ERROR' | 'NOT_FOUND'>;
}
