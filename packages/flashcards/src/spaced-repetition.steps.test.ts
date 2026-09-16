/**
 * Step definitions for features/spaced-repetition.feature — SM-2 through
 * the deck functions: new cards due now, successes spacing out, a failure
 * resetting, and the tutor adding a card.
 */

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { newId, type DeckId, type UserId } from '@glib-glub/core';
import { featurePath } from '@glib-glub/testing';
import { expect } from 'vitest';

import { addCard, createDeck, dueCards, reviewCard } from './decks';
import { parseQuality } from './sm2';
import { memoryFlashcardStore } from './testing';
import type { Card, FlashcardStore } from './index';

const feature = await loadFeature(featurePath(import.meta.url, 'spaced-repetition.feature'));

const at = (day: string) => new Date(`${day}T09:00:00Z`);
const dayOf = (date: Date) => date.toISOString().slice(0, 10);

describeFeature(feature, ({ Scenario, ScenarioOutline, Background }) => {
  let store: FlashcardStore;
  let learnerId: UserId;
  let deckId: DeckId;
  let due: Card[] = [];

  const cardByFront = async (front: string) => {
    const cards = await store.listCards(deckId);
    return cards.ok ? cards.val.find((card) => card.front === front) : undefined;
  };
  const reviewOn = async (front: string, quality: number, day: string) => {
    const card = await cardByFront(front);
    const q = parseQuality(quality);
    expect(card && q !== null).toBe(true);
    if (card && q !== null) {
      const result = await reviewCard(
        { store },
        { learnerId, cardId: card.id, quality: q, now: at(day) }
      );
      expect(result.ok).toBe(true);
    }
  };
  const reviewedOnDays = async (_ctx: unknown, front: string, quality: number, days: string) => {
    for (const day of days.split(', ')) await reviewOn(front, quality, day);
  };
  const nextDueOn = async (_ctx: unknown, front: string, day: string) => {
    expect(dayOf((await cardByFront(front))?.schedule.dueAt ?? new Date(0))).toBe(day);
  };
  const computeDue = async (_ctx: unknown, day: string) => {
    const result = await dueCards({ store }, { learnerId, deckId, now: at(day) });
    due = result.ok ? result.val : [];
  };
  const dueCount = (_ctx: unknown, count: number) => {
    expect(due.length).toBe(count);
  };

  Background(({ Given, And }) => {
    Given(
      '{string} is a learner with a deck {string}',
      async (_ctx: unknown, _email: string, title: string) => {
        store = memoryFlashcardStore();
        learnerId = newId<'user'>();
        due = [];
        const deck = await createDeck({ store }, { learnerId, title });
        expect(deck.ok).toBe(true);
        if (deck.ok) deckId = deck.val.id;
      }
    );
    And('the deck has the cards {string}', async (_ctx: unknown, spec: string) => {
      for (const pair of spec.split('; ')) {
        const [front = '', back = ''] = pair.split('=');
        void (await addCard({ store }, { learnerId, deckId, front, back, now: at('2026-09-16') }));
      }
    });
  });

  Scenario('New cards are all due', ({ When, Then }) => {
    When('the due cards are computed on {string}', computeDue);
    Then('{int} cards are due', dueCount);
  });

  ScenarioOutline(
    'A card recalled well is scheduled further out each time',
    ({ Given, Then }, variables) => {
      Given(
        '{string} was reviewed with quality {int} on the days {string}',
        (ctx: unknown, front: string, quality: number) =>
          reviewedOnDays(ctx, front, quality, String(variables.days))
      );
      Then('{string} is next due on {string}', (ctx: unknown, front: string) =>
        nextDueOn(ctx, front, String(variables.due))
      );
    }
  );

  Scenario('A forgotten card starts over', ({ Given, When, Then, And }) => {
    Given('{string} was reviewed with quality {int} on the days {string}', reviewedOnDays);
    When(
      '{string} is reviewed with quality {int} on {string}',
      async (_ctx: unknown, front: string, quality: number, day: string) => {
        await reviewOn(front, quality, day);
      }
    );
    Then('{string} is next due on {string}', nextDueOn);
    And(
      '{string} has {int} successful repetitions',
      async (_ctx: unknown, front: string, count: number) => {
        expect((await cardByFront(front))?.schedule.repetitions).toBe(count);
      }
    );
  });

  Scenario('Only due cards are offered', ({ Given, When, Then, And }) => {
    Given('{string} was reviewed with quality {int} on the days {string}', reviewedOnDays);
    When('the due cards are computed on {string}', computeDue);
    Then('{int} cards are due', dueCount);
    And('{string} is not among them', (_ctx: unknown, front: string) => {
      expect(due.map((card) => card.front)).not.toContain(front);
    });
  });

  Scenario('The tutor adds a card from a session', ({ When, Then, And }) => {
    When(
      'the tutor adds the card {string} with the back {string} to the deck {string}',
      async (_ctx: unknown, front: string, back: string) => {
        const result = await addCard(
          { store },
          { learnerId, deckId, front, back, now: at('2026-09-16') }
        );
        expect(result.ok).toBe(true);
      }
    );
    Then('the deck has {int} cards', async (_ctx: unknown, count: number) => {
      const cards = await store.listCards(deckId);
      expect(cards.ok && cards.val.length).toBe(count);
    });
    And('{string} is due now', async (_ctx: unknown, front: string) => {
      const result = await dueCards({ store }, { learnerId, deckId, now: at('2026-09-16') });
      expect(result.ok && result.val.map((card) => card.front)).toContain(front);
    });
  });
});
