/**
 * The hint ladder (Decision #6): what the tutor may do next, decided in
 * code from how many attempts the learner has made on the open problem.
 * The prompt is told to obey the returned move; the model cannot skip a
 * rung, because it never learns the answer is due until this says so.
 *
 * Answers are compared leniently — "$0.5", "0.50" and " .5 " are the same
 * answer to a sixth grader and to us. Text answers compare by normalised
 * words.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { Result } from '@campfhir/safe-functions/types';

import type { Problem } from './types';

export const MOVES = [
  'clarify',
  'hint',
  'parallel_example',
  'reveal_with_explanation',
  'celebrate_and_explain',
] as const;
export type Move = (typeof MOVES)[number];

/** The move after the n-th wrong attempt (1-based). */
export function moveAfterWrongAttempt(wrongAttempts: number): Move {
  if (wrongAttempts <= 1) return 'clarify';
  if (wrongAttempts === 2) return 'hint';
  if (wrongAttempts === 3) return 'parallel_example';
  return 'reveal_with_explanation';
}

function normalise(text: string): string {
  const trimmed = text
    .trim()
    .toLowerCase()
    .replace(/[$€£¥,]/g, '')
    .replace(/\s+/g, ' ');
  const asNumber = Number(trimmed);
  if (trimmed !== '' && Number.isFinite(asNumber)) return String(asNumber);
  return trimmed.replace(/[.!?]+$/, '');
}

export function answersMatch(expected: string, given: string): boolean {
  const left = normalise(expected);
  const right = normalise(given);
  if (left === right) return true;
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return Math.abs(leftNumber - rightNumber) < 1e-9;
  }
  return false;
}

export interface AttemptOutcome {
  correct: boolean;
  nextMove: Move;
  problem: Problem;
}

export function recordAttempt(
  problem: Problem,
  given: string
): Result<AttemptOutcome, 'NO_OPEN_PROBLEM'> {
  if (problem.closed) return err('NO_OPEN_PROBLEM', { message: 'The problem is already closed' });
  const attempts = [...problem.attempts, given];
  const correct = answersMatch(problem.expectedAnswer, given);
  if (correct) {
    return ok({
      correct,
      nextMove: 'celebrate_and_explain',
      problem: { ...problem, attempts, solved: true, closed: true },
    });
  }
  const nextMove = moveAfterWrongAttempt(attempts.length);
  // After the reveal there is nothing left to attempt; the problem closes.
  const closed = nextMove === 'reveal_with_explanation';
  return ok({ correct, nextMove, problem: { ...problem, attempts, closed } });
}

/** The contract sentence the instructions carry, in the model's terms. */
export const HINT_LADDER_CONTRACT = `Problems and attempts go through tools. After you present a problem with tutor_present_problem, record every answer the learner gives with tutor_record_attempt and do exactly the move it returns:
- clarify: ask what they tried and restate the question in their words; do not hint yet.
- hint: give one small hint that points at the method, not the answer.
- parallel_example: work a similar problem with different numbers out loud, step by step, then hand the original back.
- reveal_with_explanation: give the answer and explain why, then ask them to explain it back.
- celebrate_and_explain: say what they did right and ask them to explain their reasoning.
Never state the answer to an open problem unless the move is reveal_with_explanation.`;
