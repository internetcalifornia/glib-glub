/**
 * Step definitions for features/grading.feature — one rule per kind, and
 * the grader port for open answers.
 */

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import type { Result } from '@campfhir/safe-functions/types';
import { featurePath } from '@glib-glub/testing';
import { expect } from 'vitest';

import { scriptedGrader, type ScriptedGrader } from './grader';
import { gradeObjective } from './grading';
import { optionsOf, question } from './testing';
import type { Grade, Question } from './types';

const feature = await loadFeature(featurePath(import.meta.url, 'grading.feature'));

describeFeature(feature, ({ Scenario, ScenarioOutline, BeforeEachScenario }) => {
  let current: Question;
  let grader: ScriptedGrader;
  let outcome: Result<Grade, string> | undefined;

  BeforeEachScenario(() => {
    grader = scriptedGrader();
    outcome = undefined;
  });

  const scoreIs = (_ctx: unknown, score: number) => {
    expect(outcome?.ok && outcome.val.score).toBe(score);
  };
  const gradeText = async (text: string) => {
    if (current.body.kind === 'short_answer' || current.body.kind === 'long_answer') {
      outcome = await grader.grade({ question: current, answer: text });
    } else if (current.body.kind === 'true_false') {
      outcome = gradeObjective(current, { kind: 'true_false', value: text === 'true' });
    } else if (current.body.kind === 'single_choice') {
      outcome = gradeObjective(current, { kind: 'single_choice', optionId: text });
    } else {
      outcome = gradeObjective(current, { kind: 'fill_blank', text });
    }
  };

  ScenarioOutline(
    'A single-choice answer is right or wrong',
    ({ Given, When, Then }, variables) => {
      Given(
        'a single-choice question {string} with options {string} and the key {string}',
        (_ctx: unknown, prompt: string, options: string, key: string) => {
          current = question(prompt, {
            kind: 'single_choice',
            options: optionsOf(options),
            keyOptionId: key,
          });
        }
      );
      When('the answer {string} is graded', () => gradeText(String(variables.answer)));
      Then('the score is <score>', (ctx: unknown) => scoreIs(ctx, Number(variables.score)));
    }
  );

  ScenarioOutline(
    'A multi-select answer must match the whole key',
    ({ Given, When, Then }, variables) => {
      Given(
        'a multi-select question {string} with options {string} and the keys {string}',
        (_ctx: unknown, prompt: string, options: string, keys: string) => {
          current = question(prompt, {
            kind: 'multi_select',
            options: optionsOf(options),
            keyOptionIds: keys.split(', '),
          });
        }
      );
      When('the answers {string} are graded', () => {
        outcome = gradeObjective(current, {
          kind: 'multi_select',
          optionIds: String(variables.answers).split(', '),
        });
      });
      Then('the score is <score>', (ctx: unknown) => scoreIs(ctx, Number(variables.score)));
    }
  );

  Scenario('A true/false answer', ({ Given, When, Then }) => {
    Given(
      'a true-false question {string} with the key {string}',
      (_ctx: unknown, prompt: string, key: string) => {
        current = question(prompt, { kind: 'true_false', key: key === 'true' });
      }
    );
    When('the answer {string} is graded', (_ctx: unknown, text: string) => gradeText(text));
    Then('the score is {int}', scoreIs);
  });

  ScenarioOutline(
    'A fill-in-the-blank answer ignores case and spacing and accepts alternatives',
    ({ Given, When, Then }, variables) => {
      Given(
        'a fill-blank question {string} accepting {string}',
        (_ctx: unknown, prompt: string, accepted: string) => {
          current = question(prompt, { kind: 'fill_blank', accepted: accepted.split(', ') });
        }
      );
      When('the answer {string} is graded', () => gradeText(` ${String(variables.answer)} `));
      Then('the score is <score>', (ctx: unknown) => scoreIs(ctx, Number(variables.score)));
    }
  );

  Scenario('A numeric blank accepts a tolerance', ({ Given, When, Then }) => {
    Given(
      'a fill-blank question {string} accepting {string} with a tolerance of {number}',
      (_ctx: unknown, prompt: string, accepted: string, tolerance: number) => {
        current = question(prompt, {
          kind: 'fill_blank',
          accepted: accepted.split(', '),
          tolerance,
        });
      }
    );
    When('the answer {string} is graded', (_ctx: unknown, text: string) => gradeText(text));
    Then('the score is {int}', scoreIs);
  });

  Scenario('A short answer goes to the grader with the rubric', ({ Given, When, Then, And }) => {
    Given(
      'a short-answer question {string} with the rubric {string}',
      (_ctx: unknown, prompt: string, rubric: string) => {
        current = question(prompt, { kind: 'short_answer', rubric });
      }
    );
    And(
      'the grader will answer with a score of {number} and the feedback {string}',
      (_ctx: unknown, score: number, feedback: string) => {
        grader.answerWith({ score, feedback });
      }
    );
    When('the answer {string} is graded', (_ctx: unknown, text: string) => gradeText(text));
    Then('the score is {number}', scoreIs);
    And('the feedback is {string}', (_ctx: unknown, feedback: string) => {
      expect(outcome?.ok && outcome.val.feedback).toBe(feedback);
    });
    And('the grader saw the rubric', () => {
      const body = grader.requests[0]?.question.body;
      expect(body?.kind === 'short_answer' && body.rubric).toContain('numerator');
    });
  });

  Scenario('A grader failure is a value, not a grade', ({ Given, When, Then, And }) => {
    Given(
      'a short-answer question {string} with the rubric {string}',
      (_ctx: unknown, prompt: string, rubric: string) => {
        current = question(prompt, { kind: 'short_answer', rubric });
      }
    );
    And('the grader is unavailable', () => {
      grader.answerWith(null);
    });
    When('the answer {string} is graded', (_ctx: unknown, text: string) => gradeText(text));
    Then('grading fails with GRADER_UNAVAILABLE', () => {
      expect(outcome && !outcome.ok && outcome.err.type).toBe('GRADER_UNAVAILABLE');
    });
  });
});
