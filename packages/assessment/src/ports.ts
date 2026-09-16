import type { AsyncResult } from '@campfhir/safe-functions/types';
import type { AssessmentId, AttemptId, QuestionId, SubjectId, UserId } from '@glib-glub/core';
import type { Role } from '@glib-glub/identity';

import type { Grader } from './grader';
import type {
  Assessment,
  Attempt,
  Grading,
  LevelEstimate,
  Question,
  Response,
  ResponseId,
} from './types';

export interface Roles {
  rolesOf(userId: UserId): AsyncResult<Role[], 'DB_ERROR'>;
}

export interface AssessmentStore {
  addQuestion(question: Question): AsyncResult<void, 'DB_ERROR'>;
  getQuestions(ids: ReadonlyArray<QuestionId>): AsyncResult<Question[], 'DB_ERROR'>;

  createAssessment(assessment: Assessment): AsyncResult<void, 'DB_ERROR'>;
  getAssessment(id: AssessmentId): AsyncResult<Assessment | null, 'DB_ERROR'>;

  createAttempt(attempt: Attempt): AsyncResult<void, 'DB_ERROR'>;
  getAttempt(id: AttemptId): AsyncResult<Attempt | null, 'DB_ERROR'>;
  listAttempts(learnerId: UserId, assessmentId: AssessmentId): AsyncResult<Attempt[], 'DB_ERROR'>;

  addResponse(response: Response): AsyncResult<void, 'DB_ERROR'>;
  listResponses(attemptId: AttemptId): AsyncResult<Response[], 'DB_ERROR'>;
  getResponse(id: ResponseId): AsyncResult<Response | null, 'DB_ERROR'>;

  addGrading(grading: Grading): AsyncResult<void, 'DB_ERROR'>;
  listGradings(responseId: ResponseId): AsyncResult<Grading[], 'DB_ERROR'>;

  upsertLevelEstimate(estimate: LevelEstimate): AsyncResult<void, 'DB_ERROR'>;
  listLevelEstimates(learnerId: UserId): AsyncResult<LevelEstimate[], 'DB_ERROR'>;
  getLevelEstimate(
    learnerId: UserId,
    subjectId: SubjectId
  ): AsyncResult<LevelEstimate | null, 'DB_ERROR'>;
}

export interface AssessmentDeps {
  store: AssessmentStore;
  grader: Grader;
  roles: Roles;
}
