/**
 * Step definitions for features/session-lifecycle.feature — start, record,
 * end with a summary, mark the lesson, and who may act.
 */

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { newId, type TutorSessionId } from '@glib-glub/core';
import { featurePath } from '@glib-glub/testing';
import { expect } from 'vitest';

import { endSession, recordTurn, startSession } from './session';
import { tutorWorld, type TutorWorld } from './testing';
import { dispatchTool } from './tools';
import type { AgeBand } from '@glib-glub/identity';

const feature = await loadFeature(featurePath(import.meta.url, 'session-lifecycle.feature'));

const asBand = (value: string): AgeBand | null =>
  value === 'k-5' ||
  value === '6-8' ||
  value === '9-12' ||
  value === 'university' ||
  value === 'adult'
    ? value
    : null;

describeFeature(feature, ({ Scenario, Background }) => {
  let world: TutorWorld;
  let sessionId: TutorSessionId;
  let last: { ok: boolean; err?: { type: string } } | undefined;

  Background(({ Given, And }) => {
    Given(
      'a learner {string} in the age band {string} with the snapshot {string}',
      (_ctx: unknown, email: string, band: string, snapshot: string) => {
        world = tutorWorld();
        last = undefined;
        world.addLearner(email, asBand(band), snapshot);
      }
    );
    And(
      'a track {string} with the pedagogy {string} whose next due lesson is {string} with the notes {string}',
      (_ctx: unknown, title: string, pedagogy: string, lessonTitle: string, notes: string) => {
        world.addTrack(title, { pedagogy, lessonTitle, notes });
      }
    );
  });

  const starts = async (_ctx: unknown, email: string) => {
    const started = await startSession(world, {
      learnerId: world.userIdOf(email),
      mode: 'solo',
      transport: 'voice',
    });
    expect(started.ok).toBe(true);
    if (started.ok) sessionId = started.val.session.id;
  };
  const present = async (problem: string, expectedAnswer: string) => {
    last = await dispatchTool(world, sessionId, 'tutor_present_problem', {
      problem,
      expectedAnswer,
    });
  };
  const presents = (_ctx: unknown, _tool: string, problem: string, expectedAnswer: string) =>
    present(problem, expectedAnswer);
  const presented = (_ctx: unknown, problem: string, expectedAnswer: string) =>
    present(problem, expectedAnswer);
  const attempts = async (_ctx: unknown, attempt: string) => {
    last = await dispatchTool(world, sessionId, 'tutor_record_attempt', { attempt });
  };
  const notes = async (_ctx: unknown, misconception: string) => {
    last = await dispatchTool(world, sessionId, 'tutor_note_misconception', { misconception });
  };
  const session = async () => {
    const loaded = await world.store.getSession(sessionId);
    return loaded.ok ? loaded.val : null;
  };
  const statusIs = async (_ctx: unknown, status: string) => {
    expect((await session())?.status).toBe(status);
  };

  Scenario('Starting a session records who and what', ({ When, Then, And }) => {
    When('a solo voice session starts for {string}', starts);
    Then('the session is {string}', statusIs);
    And('the session is on the lesson {string}', async (_ctx: unknown, title: string) => {
      expect((await session())?.lessonTitle).toBe(title);
    });
    And('the session has {int} participant', async (_ctx: unknown, count: number) => {
      expect((await session())?.participants.length).toBe(count);
    });
  });

  Scenario('Tool calls and turns are recorded', ({ Given, When, Then, And }) => {
    Given('a solo voice session started for {string}', starts);
    When('the tutor calls {string} with the problem {string} and the answer {string}', presents);
    And('the learner says {string}', async (_ctx: unknown, text: string) => {
      last = await recordTurn(world, {
        sessionId,
        speaker: { kind: 'participant', participantId: 'learner' },
        text,
      });
    });
    And('the tutor records the attempt {string}', attempts);
    And('the tutor notes the misconception {string}', notes);
    Then('the session has {int} tool calls', async (_ctx: unknown, count: number) => {
      const calls = await world.store.listToolCalls(sessionId);
      expect(calls.ok && calls.val.length).toBe(count);
    });
    And('the session has {int} learner turn', async (_ctx: unknown, count: number) => {
      const turns = await world.store.listTurns(sessionId);
      expect(turns.ok && turns.val.filter((t) => t.speaker.kind === 'participant').length).toBe(
        count
      );
    });
  });

  Scenario(
    'Ending a session writes a summary and marks the lesson',
    ({ Given, When, Then, And }) => {
      Given('a solo voice session started for {string}', starts);
      And('the tutor presented the problem {string} with the answer {string}', presented);
      And('the tutor recorded the attempt {string}', attempts);
      And('the tutor noted the misconception {string}', notes);
      When('the tutor calls {string}', async (_ctx: unknown, tool: string) => {
        last = await dispatchTool(world, sessionId, tool, {});
        expect(last.ok).toBe(true);
      });
      Then('the session is {string}', statusIs);
      And('the summary lists the misconception {string}', async (_ctx: unknown, text: string) => {
        expect((await session())?.summary?.misconceptions).toContain(text);
      });
      And('the summary says {int} problem was solved', async (_ctx: unknown, count: number) => {
        expect((await session())?.summary?.problemsSolved).toBe(count);
      });
      And(
        'the lesson {string} is marked completed for {string}',
        async (_ctx: unknown, _lesson: string, email: string) => {
          expect(world.completed.some((c) => c.learnerId === world.userIdOf(email))).toBe(true);
        }
      );
    }
  );

  Scenario('The tutor adds a flashcard during a session', ({ Given, When, Then }) => {
    Given('a solo voice session started for {string}', starts);
    When(
      'the tutor calls {string} with the front {string} and the back {string}',
      async (_ctx: unknown, tool: string, front: string, back: string) => {
        last = await dispatchTool(world, sessionId, tool, { front, back });
        expect(last.ok).toBe(true);
      }
    );
    Then(
      "the learner's deck for {string} has {int} card",
      (_ctx: unknown, lesson: string, count: number) => {
        expect(world.cards.filter((c) => c.lessonTitle === lesson).length).toBe(count);
      }
    );
  });

  Scenario('Only the learner or a participant may act on a session', ({ Given, When, Then }) => {
    Given('a solo voice session started for {string}', starts);
    When('{string} tries to end the session', async () => {
      last = await endSession(world, { actorId: newId<'user'>(), sessionId });
    });
    Then('the change fails with FORBIDDEN', () => {
      expect(last && !last.ok && last.err?.type).toBe('FORBIDDEN');
    });
  });
});
