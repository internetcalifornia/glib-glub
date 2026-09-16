/**
 * The Postgres FlashcardStore: a card's SM-2 state survives a round trip
 * with its easiness intact (numeric, not float), and due ordering holds.
 */

import type { DB } from '@glib-glub/db';
import { IDENTITY_TABLES, kyselyIdentityStore } from '@glib-glub/identity';
import { connectTestDb, describeLive } from '@glib-glub/testing';
import { afterAll, beforeEach, expect, it } from 'vitest';

import { addCard, createDeck, dueCards, reviewCard } from './decks';
import { FLASHCARD_TABLES, kyselyFlashcardStore } from './store';

describeLive('FlashcardStore on Postgres', () => {
  const handle = connectTestDb<DB>();
  if (!handle.ok) return;
  const { db, clear, close } = handle.val;
  const store = kyselyFlashcardStore(db);
  const identity = kyselyIdentityStore(db);

  beforeEach(async () => {
    void (await clear([...FLASHCARD_TABLES, ...IDENTITY_TABLES]));
  });
  afterAll(async () => {
    await close();
  });

  it('keeps SM-2 state across reviews', async () => {
    const user = await identity.createUser({
      email: 'maya@example.com',
      name: 'Maya',
      emailVerified: true,
    });
    expect(user.ok).toBe(true);
    if (!user.ok) return;
    const learnerId = user.val.id;
    const deck = await createDeck({ store }, { learnerId, title: 'Fractions' });
    expect(deck.ok).toBe(true);
    if (!deck.ok) return;
    const day = (n: number) => new Date(Date.UTC(2026, 8, n, 9));
    const card = await addCard(
      { store },
      { learnerId, deckId: deck.val.id, front: '1/2', back: '0.5', now: day(16) }
    );
    expect(card.ok).toBe(true);
    if (!card.ok) return;

    void (await reviewCard(
      { store },
      { learnerId, cardId: card.val.id, quality: 5, now: day(16) }
    ));
    const second = await reviewCard(
      { store },
      { learnerId, cardId: card.val.id, quality: 5, now: day(17) }
    );

    expect(second.ok && second.val.schedule.intervalDays).toBe(6);
    expect(second.ok && second.val.schedule.easiness).toBeCloseTo(2.7, 5);
    const due = await dueCards({ store }, { learnerId, deckId: deck.val.id, now: day(20) });
    expect(due.ok && due.val).toEqual([]);
    const later = await dueCards({ store }, { learnerId, deckId: deck.val.id, now: day(24) });
    expect(later.ok && later.val.map((c) => c.front)).toEqual(['1/2']);
  });
});
