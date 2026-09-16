/**
 * Step definitions for features/hint-ladder.feature — the ladder through
 * the tool the model actually calls.
 */

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import type { TutorSessionId } from '@glib-glub/core';
import { featurePath } from '@glib-glub/testing';
import { expect } from 'vitest';

import { startSession } from './session';
import { tutorWorld, type TutorWorld } from './testing';
import { dispatchTool } from './tools';

const feature = await loadFeature(featurePath(import.meta.url, 'hint-ladder.feature'));

describeFeature(feature, ({ Scenario, Background }) => {
  let world: TutorWorld;
  let sessionId: TutorSessionId;
  let last: Awaited<ReturnType<typeof dispatchTool>> | undefined;

  const attempt = async (text: string) => {
    last = await dispatchTool(world, sessionId, 'tutor_record_attempt', { attempt: text });
  };
  const attempted = (_ctx: unknown, text: string) => attempt(text);
  // vitest-cucumber keys steps by expression, so a scenario cannot repeat the
  // same `And`; several prior attempts are declared in one step instead.
  const attemptedAll = async (_ctx: unknown, ...texts: string[]) => {
    for (const text of texts) await attempt(text);
  };
  const nextMoveIs = (_ctx: unknown, move: string) => {
    expect(last?.ok && last.val.nextMove).toBe(move);
  };

  Background(({ Given, And }) => {
    Given('a live solo session for {string}', async (_ctx: unknown, email: string) => {
      world = tutorWorld();
      last = undefined;
      world.addLearner(email, '6-8', 'Visual learner');
      world.addTrack('Grade 6 Mathematics', {
        lessonTitle: 'Unit rates',
        notes: 'Price per pencil.',
      });
      const started = await startSession(world, {
        learnerId: world.userIdOf(email),
        mode: 'solo',
        transport: 'voice',
      });
      expect(started.ok).toBe(true);
      if (started.ok) sessionId = started.val.session.id;
    });
    And(
      'the tutor presented the problem {string} with the expected answer {string}',
      async (_ctx: unknown, problem: string, expectedAnswer: string) => {
        const result = await dispatchTool(world, sessionId, 'tutor_present_problem', {
          problem,
          expectedAnswer,
        });
        expect(result.ok).toBe(true);
      }
    );
  });

  Scenario('A wrong first attempt gets a clarifying question', ({ When, Then, And }) => {
    When('the learner attempts {string}', attempted);
    Then('the attempt is marked incorrect', () => {
      expect(last?.ok && last.val.correct).toBe(false);
    });
    And('the next move is {string}', nextMoveIs);
  });

  Scenario('A second wrong attempt gets a hint', ({ Given, When, Then }) => {
    Given('the learner attempted {string}', attempted);
    When('the learner attempts {string}', attempted);
    Then('the next move is {string}', nextMoveIs);
  });

  Scenario('A third wrong attempt gets a parallel worked example', ({ Given, When, Then }) => {
    Given('the learner attempted {string} and {string}', attemptedAll);
    When('the learner attempts {string}', attempted);
    Then('the next move is {string}', nextMoveIs);
  });

  Scenario(
    'Only after three wrong attempts may the answer be revealed',
    ({ Given, When, Then }) => {
      Given('the learner attempted {string}, {string} and {string}', attemptedAll);
      When('the learner attempts {string}', attempted);
      Then('the next move is {string}', nextMoveIs);
    }
  );

  Scenario(
    'A correct attempt closes the problem with an explanation',
    ({ Given, When, Then, And }) => {
      Given('the learner attempted {string}', attempted);
      When('the learner attempts {string}', attempted);
      Then('the attempt is marked correct', () => {
        expect(last?.ok && last.val.correct).toBe(true);
      });
      And('the next move is {string}', nextMoveIs);
      And('the problem is closed', async () => {
        const session = await world.store.getSession(sessionId);
        expect(session.ok && session.val?.problems.every((p) => p.closed)).toBe(true);
      });
    }
  );

  Scenario('Answers are compared leniently', ({ When, Then }) => {
    When('the learner attempts {string}', attempted);
    Then('the attempt is marked correct', () => {
      expect(last?.ok && last.val.correct).toBe(true);
    });
  });

  Scenario('The tutor cannot record an attempt without a problem', ({ Given, When, Then }) => {
    Given('the problem was closed', async () => {
      await attempt('0.50');
    });
    When('the learner attempts {string}', attempted);
    Then('recording fails with NO_OPEN_PROBLEM', () => {
      expect(last && !last.ok && last.err.type).toBe('NO_OPEN_PROBLEM');
    });
  });
});
