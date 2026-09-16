/**
 * Objective grading: exact, deterministic, explainable. Each kind has one
 * rule, spelled out here and pinned by features/grading.feature. Open kinds
 * (short and long answer) are not graded here — they go to the Grader port.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { Result } from '@campfhir/safe-functions/types';

import type { Answer, Grade, Question } from './types';

export function isObjective(question: Question): boolean {
  return question.body.kind !== 'short_answer' && question.body.kind !== 'long_answer';
}

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function sameSet(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((item) => right.has(item));
}

export function gradeObjective(
  question: Question,
  answer: Answer
): Result<Grade, 'NOT_OBJECTIVE' | 'VALIDATION_ERROR'> {
  const body = question.body;
  if (body.kind !== answer.kind) {
    return err('VALIDATION_ERROR', {
      message: `Answer kind ${answer.kind} does not match question kind ${body.kind}`,
    });
  }
  switch (body.kind) {
    case 'single_choice': {
      if (answer.kind !== 'single_choice') return err('VALIDATION_ERROR');
      const right = answer.optionId === body.keyOptionId;
      return ok({ score: right ? 1 : 0, feedback: right ? 'Correct.' : 'Not this one.' });
    }
    case 'multi_select': {
      if (answer.kind !== 'multi_select') return err('VALIDATION_ERROR');
      const right = sameSet(answer.optionIds, body.keyOptionIds);
      return ok({
        score: right ? 1 : 0,
        feedback: right ? 'Correct.' : 'The selection does not match exactly.',
      });
    }
    case 'true_false': {
      if (answer.kind !== 'true_false') return err('VALIDATION_ERROR');
      const right = answer.value === body.key;
      return ok({ score: right ? 1 : 0, feedback: right ? 'Correct.' : 'Not quite.' });
    }
    case 'fill_blank': {
      if (answer.kind !== 'fill_blank') return err('VALIDATION_ERROR');
      const given = normalise(answer.text);
      const textMatch = body.accepted.some((accepted) => normalise(accepted) === given);
      const numericMatch =
        body.tolerance !== undefined &&
        Number.isFinite(Number(given)) &&
        body.accepted.some(
          (accepted) =>
            Number.isFinite(Number(accepted)) &&
            Math.abs(Number(accepted) - Number(given)) <= (body.tolerance ?? 0)
        );
      const right = textMatch || numericMatch;
      return ok({
        score: right ? 1 : 0,
        feedback: right ? 'Correct.' : 'Not the expected answer.',
      });
    }
    case 'short_answer':
    case 'long_answer':
      return err('NOT_OBJECTIVE');
  }
}

export function answerText(answer: Answer | null): string {
  if (!answer) return '';
  switch (answer.kind) {
    case 'single_choice':
      return answer.optionId;
    case 'multi_select':
      return answer.optionIds.join(', ');
    case 'true_false':
      return String(answer.value);
    default:
      return answer.text;
  }
}
