/**
 * The in-memory AssessmentStore, builders for questions, and the scenario
 * world the step definitions share.
 */

import { ok } from '@campfhir/safe-functions/helpers';
import {
  newId,
  type AssessmentId,
  type AttemptId,
  type QuestionId,
  type SubjectId,
  type UserId,
} from '@glib-glub/core';
import { identityWorld, type IdentityStore, type IdentityWorld } from '@glib-glub/identity';

import { scriptedGrader, type ScriptedGrader } from './grader';
import type { AssessmentDeps, AssessmentStore, Roles } from './ports';
import type {
  Assessment,
  Attempt,
  Grading,
  LevelEstimate,
  Question,
  QuestionBody,
  Response,
  ResponseId,
} from './types';

export function rolesFromIdentity(store: IdentityStore): Roles {
  return { rolesOf: (userId) => store.getRoles(userId) };
}

export function memoryAssessmentStore(): AssessmentStore {
  const questions = new Map<QuestionId, Question>();
  const assessments = new Map<AssessmentId, Assessment>();
  const attempts = new Map<AttemptId, Attempt>();
  const responses = new Map<ResponseId, Response>();
  const gradings: Grading[] = [];
  const estimates = new Map<string, LevelEstimate>();
  const key = (learnerId: UserId, subjectId: SubjectId) => `${learnerId}/${subjectId}`;

  return {
    addQuestion: async (question): ReturnType<AssessmentStore['addQuestion']> => {
      questions.set(question.id, question);
      return ok();
    },
    getQuestions: async (ids): ReturnType<AssessmentStore['getQuestions']> =>
      ok(
        ids.flatMap((id) => {
          const found = questions.get(id);
          return found ? [found] : [];
        })
      ),
    createAssessment: async (assessment): ReturnType<AssessmentStore['createAssessment']> => {
      assessments.set(assessment.id, assessment);
      return ok();
    },
    getAssessment: async (id): ReturnType<AssessmentStore['getAssessment']> =>
      ok(assessments.get(id) ?? null),
    createAttempt: async (attempt): ReturnType<AssessmentStore['createAttempt']> => {
      attempts.set(attempt.id, attempt);
      return ok();
    },
    getAttempt: async (id): ReturnType<AssessmentStore['getAttempt']> =>
      ok(attempts.get(id) ?? null),
    listAttempts: async (learnerId, assessmentId): ReturnType<AssessmentStore['listAttempts']> =>
      ok(
        [...attempts.values()].filter(
          (a) => a.learnerId === learnerId && a.assessmentId === assessmentId
        )
      ),
    addResponse: async (response): ReturnType<AssessmentStore['addResponse']> => {
      responses.set(response.id, response);
      return ok();
    },
    listResponses: async (attemptId): ReturnType<AssessmentStore['listResponses']> =>
      ok([...responses.values()].filter((r) => r.attemptId === attemptId)),
    getResponse: async (id): ReturnType<AssessmentStore['getResponse']> =>
      ok(responses.get(id) ?? null),
    addGrading: async (grading): ReturnType<AssessmentStore['addGrading']> => {
      gradings.push(grading);
      return ok();
    },
    listGradings: async (responseId): ReturnType<AssessmentStore['listGradings']> =>
      ok(gradings.filter((g) => g.responseId === responseId)),
    upsertLevelEstimate: async (estimate): ReturnType<AssessmentStore['upsertLevelEstimate']> => {
      estimates.set(key(estimate.learnerId, estimate.subjectId), estimate);
      return ok();
    },
    listLevelEstimates: async (learnerId): ReturnType<AssessmentStore['listLevelEstimates']> =>
      ok([...estimates.values()].filter((e) => e.learnerId === learnerId)),
    getLevelEstimate: async (
      learnerId,
      subjectId
    ): ReturnType<AssessmentStore['getLevelEstimate']> =>
      ok(estimates.get(key(learnerId, subjectId)) ?? null),
  };
}

export function question(prompt: string, body: QuestionBody, points = 1): Question {
  return { id: newId<'question'>(), prompt, body, points };
}

/** Options from "a, b, c": ids are the texts themselves, which keeps scenarios readable. */
export function optionsOf(list: string): Array<{ id: string; text: string }> {
  return list.split(', ').map((text) => ({ id: text, text }));
}

export interface AssessmentWorld extends AssessmentDeps {
  identity: IdentityWorld;
  grader: ScriptedGrader;
  last: { ok: boolean; err?: { type: string } } | undefined;
  person(email: string, role?: 'educator' | 'admin'): Promise<UserId>;
  userIdOf(email: string): Promise<UserId>;
}

export function assessmentWorld(): AssessmentWorld {
  const identity = identityWorld();
  return {
    identity,
    store: memoryAssessmentStore(),
    grader: scriptedGrader(),
    roles: rolesFromIdentity(identity.store),
    last: undefined,
    async person(email, role) {
      const existing = await identity.store.findUserByEmail(email);
      if (!existing.ok || !existing.val) await identity.signUp(email, 'correct horse battery');
      const id = await identity.userIdOf(email);
      if (role) void (await identity.store.addRole(id, role));
      return id;
    },
    userIdOf: (email) => identity.userIdOf(email),
  };
}
