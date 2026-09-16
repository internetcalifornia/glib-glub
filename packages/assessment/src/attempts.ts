/**
 * An attempt: one learner sitting one assessment. Every question gets a
 * response row (null when unanswered) and, where possible, a grading row:
 * `auto` for objective kinds and missing answers, `llm` for open kinds. A
 * grader outage leaves the response pending rather than failing the
 * submission — the learner's answers are never lost to a model hiccup.
 *
 * The score of an attempt is the latest grading per response, weighted by
 * the question's points. An educator override is a new grading row
 * pointing at the one it replaces; nothing is ever edited in place.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import {
  newId,
  type AssessmentId,
  type AttemptId,
  type QuestionId,
  type UserId,
} from '@glib-glub/core';

import { answerText, gradeObjective, isObjective } from './grading';
import type { AssessmentDeps, AssessmentStore } from './ports';
import type { Answer, Attempt, Grading, Question, Response, ResponseId } from './types';

export interface SubmitInput {
  learnerId: UserId;
  assessmentId: AssessmentId;
  answers: ReadonlyMap<QuestionId, Answer>;
  now: Date;
}

export interface SubmitOutcome {
  attempt: Attempt;
  score: number;
  total: number;
  /** Responses that could not be graded yet (grader unavailable). */
  pending: number;
}

export async function submitAttempt(
  deps: AssessmentDeps,
  input: SubmitInput
): AsyncResult<SubmitOutcome, 'NOT_FOUND' | 'DB_ERROR'> {
  const assessment = await deps.store.getAssessment(input.assessmentId);
  if (!assessment.ok) return assessment;
  if (!assessment.val) return err('NOT_FOUND', { message: 'No such assessment' });
  const questions = await deps.store.getQuestions(assessment.val.questionIds);
  if (!questions.ok) return questions;

  const attempt: Attempt = {
    id: newId<'attempt'>(),
    assessmentId: input.assessmentId,
    learnerId: input.learnerId,
    submittedAt: input.now,
  };
  const created = await deps.store.createAttempt(attempt);
  if (!created.ok) return created;

  let pending = 0;
  for (const question of questions.val) {
    const answer = input.answers.get(question.id) ?? null;
    const response: Response = {
      id: newId<'response'>(),
      attemptId: attempt.id,
      questionId: question.id,
      answer,
    };
    const saved = await deps.store.addResponse(response);
    if (!saved.ok) return saved;

    const grading = await gradeResponse(deps, question, response, input.now);
    if (!grading.ok) return grading;
    if (grading.val === null) pending += 1;
  }

  const scored = await attemptScore(deps, attempt.id);
  if (!scored.ok) return scored;
  return ok({ attempt, score: scored.val.score, total: scored.val.total, pending });
}

/** Null means "pending": the grader was unavailable. */
async function gradeResponse(
  deps: AssessmentDeps,
  question: Question,
  response: Response,
  now: Date
): AsyncResult<Grading | null, 'DB_ERROR'> {
  const base = {
    id: newId<'grading'>(),
    responseId: response.id,
    overrideOf: null,
    gradedBy: null,
    gradedAt: now,
  };
  let grading: Grading;
  if (!response.answer) {
    grading = { ...base, grader: 'auto', score: 0, feedback: 'No answer given.' };
  } else if (isObjective(question)) {
    const graded = gradeObjective(question, response.answer);
    grading = graded.ok
      ? { ...base, grader: 'auto', score: graded.val.score, feedback: graded.val.feedback }
      : { ...base, grader: 'auto', score: 0, feedback: 'The answer did not match the question.' };
  } else {
    const graded = await deps.grader.grade({ question, answer: answerText(response.answer) });
    if (!graded.ok) return ok(null);
    grading = { ...base, grader: 'llm', score: graded.val.score, feedback: graded.val.feedback };
  }
  const saved = await deps.store.addGrading(grading);
  if (!saved.ok) return saved;
  return ok(grading);
}

export function latestGrading(gradings: ReadonlyArray<Grading>): Grading | null {
  // The newest row is the one nothing overrides.
  const overridden = new Set(
    gradings.map((g) => g.overrideOf).filter((id): id is Grading['id'] => id !== null)
  );
  const live = gradings.filter((g) => !overridden.has(g.id));
  return live.sort((a, b) => b.gradedAt.getTime() - a.gradedAt.getTime())[0] ?? null;
}

export async function attemptScore(
  deps: { store: AssessmentStore },
  attemptId: AttemptId
): AsyncResult<{ score: number; total: number }, 'NOT_FOUND' | 'DB_ERROR'> {
  const attempt = await deps.store.getAttempt(attemptId);
  if (!attempt.ok) return attempt;
  if (!attempt.val) return err('NOT_FOUND', { message: 'No such attempt' });
  const assessment = await deps.store.getAssessment(attempt.val.assessmentId);
  if (!assessment.ok) return assessment;
  if (!assessment.val) return err('NOT_FOUND', { message: 'No such assessment' });
  const questions = await deps.store.getQuestions(assessment.val.questionIds);
  if (!questions.ok) return questions;
  const responses = await deps.store.listResponses(attemptId);
  if (!responses.ok) return responses;

  const points = new Map(questions.val.map((question) => [question.id, question.points]));
  let score = 0;
  let total = 0;
  for (const question of questions.val) total += question.points;
  for (const response of responses.val) {
    const gradings = await deps.store.listGradings(response.id);
    if (!gradings.ok) return gradings;
    const latest = latestGrading(gradings.val);
    if (latest) score += latest.score * (points.get(response.questionId) ?? 1);
  }
  return ok({ score, total });
}

export async function overrideGrade(
  deps: AssessmentDeps,
  input: { actorId: UserId; responseId: ResponseId; score: number; feedback: string; now: Date }
): AsyncResult<Grading, 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'DB_ERROR'> {
  const roles = await deps.roles.rolesOf(input.actorId);
  if (!roles.ok) return roles;
  if (!roles.val.includes('educator') && !roles.val.includes('admin')) {
    return err('FORBIDDEN', { message: 'Only an educator can override a grade' });
  }
  if (input.score < 0 || input.score > 1)
    return err('VALIDATION_ERROR', { message: 'A score is between 0 and 1' });
  const response = await deps.store.getResponse(input.responseId);
  if (!response.ok) return response;
  if (!response.val) return err('NOT_FOUND', { message: 'No such response' });
  const gradings = await deps.store.listGradings(input.responseId);
  if (!gradings.ok) return gradings;
  const grading: Grading = {
    id: newId<'grading'>(),
    responseId: input.responseId,
    grader: 'educator',
    score: input.score,
    feedback: input.feedback,
    overrideOf: latestGrading(gradings.val)?.id ?? null,
    gradedBy: input.actorId,
    gradedAt: input.now,
  };
  const saved = await deps.store.addGrading(grading);
  if (!saved.ok) return saved;
  return ok(grading);
}
