/**
 * Quiz generation: the model's proposal is validated into the six kinds,
 * a key that names a missing option is refused, and the lesson's notes
 * reach the prompt.
 */

import { scriptedLlm } from '@glib-glub/ai';
import { describe, expect, it } from 'vitest';

import { generateQuiz } from './quiz-generation';
import { memoryAssessmentStore } from './testing';

const lesson = {
  title: 'Unit rates',
  objectives: ['Find a unit rate'],
  content: 'Price per pencil.',
};

describe('generateQuiz', () => {
  it('stores validated questions and a draft quiz', async () => {
    const llm = scriptedLlm([
      JSON.stringify({
        questions: [
          {
            kind: 'single_choice',
            prompt: '5 for $2.50 → each?',
            options: [
              { id: 'a', text: '$0.50' },
              { id: 'b', text: '$2' },
            ],
            keyOptionId: 'a',
          },
          { kind: 'true_false', prompt: 'A unit rate has 1 on the bottom', key: true },
          { kind: 'short_answer', prompt: 'Why compare unit rates?', rubric: 'same basis' },
        ],
      }),
    ]);
    const store = memoryAssessmentStore();

    const result = await generateQuiz({ store, llm }, { lesson, count: 3 });

    expect(result.ok && result.val.questions.map((q) => q.body.kind)).toEqual([
      'single_choice',
      'true_false',
      'short_answer',
    ]);
    expect(result.ok && result.val.assessment.status).toBe('draft');
    expect(llm.requests[0]?.messages[0]?.content).toContain('Price per pencil');
  });

  it('refuses a key that is not an option', async () => {
    const llm = scriptedLlm([
      JSON.stringify({
        questions: [
          {
            kind: 'single_choice',
            prompt: 'x',
            options: [
              { id: 'a', text: 'a' },
              { id: 'b', text: 'b' },
            ],
            keyOptionId: 'z',
          },
        ],
      }),
    ]);

    const result = await generateQuiz(
      { store: memoryAssessmentStore(), llm },
      { lesson, count: 1 }
    );

    expect(!result.ok && result.err.type).toBe('VALIDATION_ERROR');
  });

  it('reports a malformed proposal as GENERATION_FAILED', async () => {
    const result = await generateQuiz(
      { store: memoryAssessmentStore(), llm: scriptedLlm(['not json']) },
      { lesson, count: 2 }
    );

    expect(!result.ok && result.err.type).toBe('GENERATION_FAILED');
  });
});
