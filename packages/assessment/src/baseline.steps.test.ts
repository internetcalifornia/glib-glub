/**
 * Step definitions for features/baseline.feature — a baseline attempt's
 * ratio becomes one of four levels, and a later baseline replaces it.
 */

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { newId, type AssessmentId, type QuestionId, type SubjectId } from '@glib-glub/core';
import { featurePath } from '@glib-glub/testing';
import { expect } from 'vitest';

import { submitAttempt } from './attempts';
import { recordBaseline } from './baseline';
import { assessmentWorld, question, type AssessmentWorld } from './testing';
import type { Answer, Question } from './types';

const feature = await loadFeature(featurePath(import.meta.url, 'baseline.feature'));

describeFeature(feature, ({ Scenario, ScenarioOutline, BeforeEachScenario }) => {
  let world: AssessmentWorld;
  let testId: AssessmentId;
  let subjectId: SubjectId;
  let questions: Question[];
  let sittings = 0;

  BeforeEachScenario(() => {
    world = assessmentWorld();
    sittings = 0;
  });

  const isLearner = async (_ctx: unknown, email: string) => {
    await world.person(email);
  };
  const baselineTest = async (
    _ctx: unknown,
    title: string,
    _subject: string,
    count: number,
    key: string
  ) => {
    subjectId = newId<'subject'>();
    questions = Array.from({ length: count }, (_, i) =>
      question(`Statement ${i + 1}`, { kind: 'true_false', key: key === 'true' })
    );
    for (const q of questions) void (await world.store.addQuestion(q));
    testId = newId<'assessment'>();
    void (await world.store.createAssessment({
      id: testId,
      title,
      purpose: 'baseline',
      subjectId,
      trackId: null,
      lessonId: null,
      questionIds: questions.map((q) => q.id),
      status: 'ready',
      createdBy: null,
    }));
  };
  const answersCorrectly = async (email: string, correct: number) => {
    const answers = new Map<QuestionId, Answer>();
    questions.forEach((q, i) => answers.set(q.id, { kind: 'true_false', value: i < correct }));
    sittings += 1;
    const now = new Date(Date.UTC(2026, 8, 16 + sittings, 9));
    const submitted = await submitAttempt(world, {
      learnerId: await world.userIdOf(email),
      assessmentId: testId,
      answers,
      now,
    });
    expect(submitted.ok).toBe(true);
    if (submitted.ok) {
      const recorded = await recordBaseline(world, submitted.val.attempt.id, now);
      expect(recorded.ok).toBe(true);
    }
  };
  const levelIs = async (_ctx: unknown, email: string, _subject: string, level: string) => {
    const estimate = await world.store.getLevelEstimate(await world.userIdOf(email), subjectId);
    expect(estimate.ok && estimate.val?.level).toBe(level);
  };

  ScenarioOutline('Scores map to levels', ({ Given, When, Then, And }, variables) => {
    Given('{string} is a learner', isLearner);
    And(
      'a baseline test {string} for the subject {string} with {int} true-false questions all keyed {string}',
      baselineTest
    );
    When('{string} answers <correct> of them correctly', (_ctx: unknown, email: string) =>
      answersCorrectly(email, Number(variables.correct))
    );
    Then(
      'the level estimate of {string} in {string} is {string}',
      (ctx: unknown, email: string, subject: string) =>
        levelIs(ctx, email, subject, String(variables.level))
    );
  });

  Scenario('A later baseline replaces the estimate', ({ Given, When, Then, And }) => {
    Given('{string} is a learner', isLearner);
    And(
      'a baseline test {string} for the subject {string} with {int} true-false questions all keyed {string}',
      baselineTest
    );
    And(
      '{string} answered {int} of them correctly',
      (_ctx: unknown, email: string, correct: number) => answersCorrectly(email, correct)
    );
    When(
      '{string} answers {int} of them correctly',
      (_ctx: unknown, email: string, correct: number) => answersCorrectly(email, correct)
    );
    Then('the level estimate of {string} in {string} is {string}', levelIs);
    And(
      '{string} has {int} level estimate',
      async (_ctx: unknown, email: string, count: number) => {
        const estimates = await world.store.listLevelEstimates(await world.userIdOf(email));
        expect(estimates.ok && estimates.val.length).toBe(count);
      }
    );
  });
});
