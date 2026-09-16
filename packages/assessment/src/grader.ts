/**
 * The Grader port for open answers, and its LLM implementation through
 * structured output: a score in [0, 1], feedback for the learner, and the
 * rubric points met. The prompt carries the rubric and sample answer and
 * never the learner's identity. A grader failure is GRADER_UNAVAILABLE —
 * the attempt is kept, the response waits for a grade.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import { completeJson, type LlmProvider } from '@glib-glub/ai';
import { z } from 'zod';

import type { Grade, Question } from './types';

export interface GradeRequest {
  question: Question;
  answer: string;
}

export interface Grader {
  grade(request: GradeRequest): AsyncResult<Grade, 'GRADER_UNAVAILABLE'>;
}

const gradeSchema = z.object({
  score: z.number().min(0).max(1),
  feedback: z.string().min(1).max(800),
  rubricPointsMet: z.array(z.string()).default([]),
});

export const GRADER_SYSTEM_PROMPT = `You grade one learner's answer against a rubric. Be fair, specific and encouraging; grade the reasoning, not the spelling.
Answer with JSON: {"score": number from 0 to 1, "feedback": string (1–3 sentences addressed to the learner), "rubricPointsMet": string[]}.
A score of 1 means every rubric point is met; 0 means none. Partial credit is expected.`;

export function llmGrader(llm: LlmProvider): Grader {
  return {
    grade: async ({ question, answer }): ReturnType<Grader['grade']> => {
      if (question.body.kind !== 'short_answer' && question.body.kind !== 'long_answer') {
        return err('GRADER_UNAVAILABLE', { message: 'The LLM grader only grades open answers' });
      }
      const sample = question.body.sampleAnswer
        ? `\nSample answer: ${question.body.sampleAnswer}`
        : '';
      const result = await completeJson(
        llm,
        {
          system: GRADER_SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Question: ${question.prompt}\nRubric: ${question.body.rubric}${sample}\n\nLearner's answer:\n${answer}`,
            },
          ],
          maxTokens: 400,
          temperature: 0,
        },
        gradeSchema
      );
      if (!result.ok)
        return err('GRADER_UNAVAILABLE', { message: result.err.message, cause: result.err });
      return ok({ score: result.val.value.score, feedback: result.val.value.feedback });
    },
  };
}

/** A grader that answers with a fixed grade and records what it saw. */
export interface ScriptedGrader extends Grader {
  requests: GradeRequest[];
  answerWith(grade: Grade | null): void;
}

export function scriptedGrader(initial: Grade | null = null): ScriptedGrader {
  const requests: GradeRequest[] = [];
  let next: Grade | null = initial;
  return {
    requests,
    answerWith: (grade) => {
      next = grade;
    },
    grade: async (request): ReturnType<Grader['grade']> => {
      requests.push(request);
      if (!next) return err('GRADER_UNAVAILABLE', { message: 'scripted grader is unavailable' });
      return ok(next);
    },
  };
}
