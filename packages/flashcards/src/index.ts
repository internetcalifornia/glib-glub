/**
 * @glib-glub/flashcards — decks, cards and SM-2 scheduling.
 */

export { addCard, createDeck, dueCards, reviewCard } from './decks';
export type { DeckDeps } from './decks';
export type { FlashcardErrorTag } from './errors';
export type { FlashcardStore } from './ports';
export { isDue, newSchedule, parseQuality, review } from './sm2';
export { FLASHCARD_TABLES, kyselyFlashcardStore } from './store';
export { memoryFlashcardStore } from './testing';
export type { Card, Deck, Quality, Schedule } from './types';
