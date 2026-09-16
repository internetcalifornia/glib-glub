/**
 * Step definitions for features/attempts.feature — submitting grades every
 * response, the score follows the latest grading, educators override with
 * history, learners cannot.
 */

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import type { AssessmentId, QuestionId } from '@glib-glub/core';
import { newId } from '@glib-glub/core';
import { featurePath } from '@glib-glub/testing';
import { expect } from 'vitest';

import { attemptScore, latestGrading, overrideGrade, submitAttempt } from './attempts';
import { assessmentWorld, question, optionsOf, type AssessmentWorld } from './testing';
import type { Answer, Attempt, Question } from './types';

const feature = await loadFeature(featurePath(import.meta.url, 'attempts.feature'));

const NOW = new Date('2026-09-16T09:00:00Z');

describeFeature(feature, ({ Scenario, Background }) => {
  let world: AssessmentWorld;
  let quizId: AssessmentId;
  let questions: Question[];
  let attempt: Attempt | undefined;

  const answerFor = (q: Question, text: string): Answer => {
    switch (q.body.kind) {
      case 'single_choice':
        return { kind: 'single_choice', optionId: text };
      case 'multi_select':
        return { kind: 'multi_select', optionIds: text.split(', ') };
      case 'true_false':
        return { kind: 'true_false', value: text === 'true' };
      case 'fill_blank':
        return { kind: 'fill_blank', text };
      case 'short_answer':
        return { kind: 'short_answer', text };
      case 'long_answer':
        return { kind: 'long_answer', text };
    }
  };
  const submits = async (_ctx: unknown, email: string, _title: string, answers: string) => {
    const parts = answers.split(' | ');
    const map = new Map<QuestionId, Answer>();
    questions.forEach((q, i) => {
      const text = parts[i];
      if (text !== undefined) map.set(q.id, answerFor(q, text));
    });
    const result = await submitAttempt(world, {
      learnerId: await world.userIdOf(email),
      assessmentId: quizId,
      answers: map,
      now: NOW,
    });
    world.last = result;
    attempt = result.ok ? result.val.attempt : undefined;
  };
  const responseFor = async (prompt: string) => {
    const q = questions.find((candidate) => candidate.prompt === prompt);
    const responses = attempt ? await world.store.listResponses(attempt.id) : undefined;
    return responses?.ok ? responses.val.find((r) => r.questionId === q?.id) : undefined;
  };
  const scoreIs = async (_ctx: unknown, score: number, total: number) => {
    const scored = attempt ? await attemptScore(world, attempt.id) : undefined;
    expect(scored?.ok && scored.val).toEqual({ score, total });
  };
  const overrides = async (
    _ctx: unknown,
    email: string,
    prompt: string,
    score: number,
    feedback: string
  ) => {
    const response = await responseFor(prompt);
    world.last = await overrideGrade(world, {
      actorId: await world.userIdOf(email),
      responseId: response?.id ?? newId<'response'>(),
      score,
      feedback,
      now: new Date(NOW.getTime() + 60_000),
    });
  };

  Background(({ Given, And }) => {
    Given('{string} is a learner', async (_ctx: unknown, email: string) => {
      world = assessmentWorld();
      attempt = undefined;
      await world.person(email);
    });
    And('{string} is an educator', async (_ctx: unknown, email: string) => {
      await world.person(email, 'educator');
    });
    And(
      'a quiz {string} with a single-choice question {string} keyed {string}, a true-false question {string} keyed {string}, and a short-answer question {string} with the rubric {string}',
      async (
        _ctx: unknown,
        title: string,
        p1: string,
        k1: string,
        p2: string,
        k2: string,
        p3: string,
        rubric: string
      ) => {
        questions = [
          question(p1, {
            kind: 'single_choice',
            options: optionsOf(`${k1}, 1/4, 2/6`),
            keyOptionId: k1,
          }),
          question(p2, { kind: 'true_false', key: k2 === 'true' }),
          question(p3, { kind: 'short_answer', rubric }),
        ];
        for (const q of questions) void (await world.store.addQuestion(q));
        quizId = newId<'assessment'>();
        void (await world.store.createAssessment({
          id: quizId,
          title,
          purpose: 'quiz',
          subjectId: null,
          trackId: null,
          lessonId: null,
          questionIds: questions.map((q) => q.id),
          status: 'ready',
          createdBy: null,
        }));
      }
    );
    And(
      'the grader will answer with a score of {number} and the feedback {string}',
      (_ctx: unknown, score: number, feedback: string) => {
        world.grader.answerWith({ score, feedback });
      }
    );
  });

  Scenario('Submitting an attempt grades every response', ({ When, Then, And }) => {
    When('{string} submits {string} with the answers {string}', submits);
    Then('the attempt score is {number} out of {int}', scoreIs);
    And(
      'the response to {string} was graded by {string}',
      async (_ctx: unknown, prompt: string, grader: string) => {
        const response = await responseFor(prompt);
        const gradings = response ? await world.store.listGradings(response.id) : undefined;
        expect(gradings?.ok && latestGrading(gradings.val)?.grader).toBe(grader);
      }
    );
  });

  Scenario(
    'An educator overrides a model grade and the history is kept',
    ({ Given, When, Then, And }) => {
      Given('{string} submitted {string} with the answers {string}', submits);
      When(
        '{string} overrides the grade for {string} to {int} with the feedback {string}',
        overrides
      );
      Then('the attempt score is {int} out of {int}', scoreIs);
      And(
        'the response to {string} has {int} gradings',
        async (_ctx: unknown, prompt: string, count: number) => {
          const response = await responseFor(prompt);
          const gradings = response ? await world.store.listGradings(response.id) : undefined;
          expect(gradings?.ok && gradings.val.length).toBe(count);
        }
      );
      And('the latest grading was by {string}', async (_ctx: unknown, grader: string) => {
        const response = await responseFor('Why is 3/6 one half?');
        const gradings = response ? await world.store.listGradings(response.id) : undefined;
        const latest = gradings?.ok ? latestGrading(gradings.val) : null;
        expect(latest?.grader).toBe(grader);
        expect(latest?.overrideOf).not.toBeNull();
      });
    }
  );

  Scenario('A learner cannot override grades', ({ Given, When, Then }) => {
    Given('{string} submitted {string} with the answers {string}', submits);
    When(
      '{string} overrides the grade for {string} to {int} with the feedback {string}',
      overrides
    );
    Then('the change fails with FORBIDDEN', () => {
      expect(world.last && !world.last.ok && world.last.err?.type).toBe('FORBIDDEN');
    });
  });

  Scenario('Missing answers score zero', ({ When, Then }) => {
    When('{string} submits {string} with the answers {string}', submits);
    Then('the attempt score is {int} out of {int}', scoreIs);
  });
});
