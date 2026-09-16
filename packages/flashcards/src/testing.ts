/** The in-memory FlashcardStore. */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { CardId, DeckId } from '@glib-glub/core';

import type { FlashcardStore } from './ports';
import type { Card, Deck } from './types';

export function memoryFlashcardStore(): FlashcardStore {
  const decks = new Map<DeckId, Deck>();
  const cards = new Map<CardId, Card>();
  return {
    createDeck: async (deck): ReturnType<FlashcardStore['createDeck']> => {
      decks.set(deck.id, deck);
      return ok();
    },
    getDeck: async (id): ReturnType<FlashcardStore['getDeck']> => ok(decks.get(id) ?? null),
    listDecks: async (learnerId): ReturnType<FlashcardStore['listDecks']> =>
      ok([...decks.values()].filter((deck) => deck.learnerId === learnerId)),
    addCard: async (card): ReturnType<FlashcardStore['addCard']> => {
      cards.set(card.id, card);
      return ok();
    },
    listCards: async (deckId): ReturnType<FlashcardStore['listCards']> =>
      ok([...cards.values()].filter((card) => card.deckId === deckId)),
    getCard: async (id): ReturnType<FlashcardStore['getCard']> => ok(cards.get(id) ?? null),
    setSchedule: async (id, schedule): ReturnType<FlashcardStore['setSchedule']> => {
      const card = cards.get(id);
      if (!card) return err('NOT_FOUND');
      cards.set(id, { ...card, schedule });
      return ok();
    },
  };
}
