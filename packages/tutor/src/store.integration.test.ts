/**
 * The Postgres SessionStore: a session round-trips with its participants
 * and problems document, turns and tool calls come back in order, and
 * lastSummary answers with the most recent ended session on the track —
 * never a live one, never another track's.
 */

import { brandId, newId, type LessonId, type TrackId } from '@glib-glub/core';
import type { DB } from '@glib-glub/db';
import { IDENTITY_TABLES, kyselyIdentityStore } from '@glib-glub/identity';
import { connectTestDb, describeLive } from '@glib-glub/testing';
import { afterAll, beforeEach, expect, it } from 'vitest';

import { kyselySessionStore, TUTOR_TABLES } from './store';
import type { SessionSummary, TutorSession } from './types';

describeLive('SessionStore on Postgres', () => {
  const handle = connectTestDb<DB>();
  if (!handle.ok) return;
  const { db, clear, close } = handle.val;
  const store = kyselySessionStore(db);
  const identity = kyselyIdentityStore(db);

  beforeEach(async () => {
    void (await clear([...TUTOR_TABLES, ...IDENTITY_TABLES]));
  });
  afterAll(async () => {
    await close();
  });

  /** The seeded Grade 6 track and its first lesson (Decision #7 makes them present). */
  const seededLesson = async () => {
    const track = await db
      .selectFrom('tracks')
      .select(['id'])
      .where('title', '=', 'Grade 6 Mathematics')
      .executeTakeFirstOrThrow();
    const lesson = await db
      .selectFrom('lessons')
      .innerJoin('units', 'units.id', 'lessons.unit_id')
      .select(['lessons.id', 'lessons.title'])
      .where('units.track_id', '=', track.id)
      .orderBy('units.position')
      .orderBy('lessons.position')
      .executeTakeFirstOrThrow();
    return {
      trackId: brandId<'track'>(track.id),
      lessonId: brandId<'lesson'>(lesson.id),
      lessonTitle: lesson.title,
    };
  };

  const summary: SessionSummary = {
    covered: ['What a ratio says'],
    problemsPresented: 2,
    problemsSolved: 1,
    misconceptions: ['Part-to-part read as part-to-whole'],
    nextSteps: ['Retry 6 red : ? blue'],
    minutes: 18,
    narrative: 'Maya can say a ratio three ways; part-to-whole still trips her.',
  };

  const sessionOn = (
    learnerId: TutorSession['learnerId'],
    lesson: { trackId: TrackId; lessonId: LessonId; lessonTitle: string },
    overrides: Partial<TutorSession> = {}
  ): TutorSession => ({
    id: newId<'tutor_session'>(),
    learnerId,
    trackId: lesson.trackId,
    lessonId: lesson.lessonId,
    lessonTitle: lesson.lessonTitle,
    mode: 'with_guardian',
    transport: 'voice',
    status: 'live',
    participants: [
      { id: 'p1', name: 'Maya', role: 'learner', userId: learnerId },
      { id: 'p2', name: "Maya's dad", role: 'guardian', userId: null },
    ],
    problems: [],
    startedAt: new Date('2026-09-16T09:00:00Z'),
    endedAt: null,
    summary: null,
    ...overrides,
  });

  it('round-trips a session, its turns and its tool calls in order', async () => {
    const user = await identity.createUser({
      email: 'maya@example.com',
      name: 'Maya',
      emailVerified: true,
    });
    expect(user.ok).toBe(true);
    if (!user.ok) return;
    const lesson = await seededLesson();
    const session = sessionOn(user.val.id, lesson);

    const created = await store.createSession(session);
    expect(created.ok).toBe(true);
    const withProblem: TutorSession = {
      ...session,
      problems: [
        {
          id: brandId<'problem'>('problem-1'),
          text: '3 red for every 2 blue. Red to all?',
          expectedAnswer: '3:5',
          attempts: ['3:2'],
          solved: false,
          closed: false,
        },
      ],
    };
    const updated = await store.updateSession(withProblem);
    expect(updated.ok).toBe(true);
    void (await store.addTurn({
      id: newId<'turn'>(),
      sessionId: session.id,
      at: new Date('2026-09-16T09:01:00Z'),
      speaker: { kind: 'participant', participantId: 'p1' },
      text: 'Is it 3 to 2?',
    }));
    void (await store.addTurn({
      id: newId<'turn'>(),
      sessionId: session.id,
      at: new Date('2026-09-16T09:00:30Z'),
      speaker: { kind: 'tutor' },
      text: 'What does each number count?',
    }));
    void (await store.addToolCall({
      id: newId<'tool_call'>(),
      sessionId: session.id,
      at: new Date('2026-09-16T09:01:05Z'),
      name: 'tutor_record_attempt',
      args: { attempt: '3:2' },
      result: { correct: false, nextMove: 'clarify' },
    }));

    const loaded = await store.getSession(session.id);
    expect(loaded.ok && loaded.val).toEqual(withProblem);
    const turns = await store.listTurns(session.id);
    expect(turns.ok && turns.val.map((turn) => turn.text)).toEqual([
      'What does each number count?',
      'Is it 3 to 2?',
    ]);
    const calls = await store.listToolCalls(session.id);
    expect(calls.ok && calls.val.map((call) => call.result)).toEqual([
      { correct: false, nextMove: 'clarify' },
    ]);
  });

  it('answers lastSummary with the latest ended session on that track only', async () => {
    const user = await identity.createUser({
      email: 'maya@example.com',
      name: 'Maya',
      emailVerified: true,
    });
    expect(user.ok).toBe(true);
    if (!user.ok) return;
    const lesson = await seededLesson();
    const older = sessionOn(user.val.id, lesson, {
      status: 'ended',
      startedAt: new Date('2026-09-14T09:00:00Z'),
      endedAt: new Date('2026-09-14T09:20:00Z'),
      summary: { ...summary, narrative: 'older' },
    });
    const newest = sessionOn(user.val.id, lesson, {
      status: 'ended',
      startedAt: new Date('2026-09-15T09:00:00Z'),
      endedAt: new Date('2026-09-15T09:18:00Z'),
      summary,
    });
    const live = sessionOn(user.val.id, lesson, { startedAt: new Date('2026-09-16T09:00:00Z') });
    for (const session of [older, newest, live]) {
      const created = await store.createSession(session);
      expect(created.ok).toBe(true);
    }

    const last = await store.lastSummary(user.val.id, lesson.trackId);
    const otherTrack = await store.lastSummary(user.val.id, newId<'track'>());

    expect(last.ok && last.val).toEqual(summary);
    expect(otherTrack.ok && otherTrack.val).toBeNull();
    const missing = await store.updateSession(sessionOn(user.val.id, lesson));
    expect(!missing.ok && missing.err.type).toBe('NOT_FOUND');
  });
});
