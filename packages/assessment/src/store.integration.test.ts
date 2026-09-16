/**
 * The Postgres AssessmentStore: a quiz round-trips its questions in order,
 * a submitted attempt's responses and gradings come back, and an override
 * is a second row that wins.
 */

import { newId } from '@glib-glub/core';
import type { DB } from '@glib-glub/db';
import { IDENTITY_TABLES, kyselyIdentityStore } from '@glib-glub/identity';
import { connectTestDb, describeLive } from '@glib-glub/testing';
import { afterAll, beforeEach, expect, it } from 'vitest';

import { attemptScore, overrideGrade, submitAttempt } from './attempts';
import { scriptedGrader } from './grader';
import { kyselyAssessmentStore, ASSESSMENT_TABLES } from './store';
import { optionsOf, question } from './testing';
import type { Answer, Question } from './types';

describeLive('AssessmentStore on Postgres', () => {
  const handle = connectTestDb<DB>();
  if (!handle.ok) return;
  const { db, clear, close } = handle.val;
  const store = kyselyAssessmentStore(db);
  const identity = kyselyIdentityStore(db);

  beforeEach(async () => {
    void (await clear([...ASSESSMENT_TABLES, ...IDENTITY_TABLES]));
  });
  afterAll(async () => {
    await close();
  });

  it('round-trips a quiz, an attempt, its gradings and an override', async () => {
    const learner = await identity.createUser({
      email: 'maya@example.com',
      name: 'Maya',
      emailVerified: true,
    });
    const educator = await identity.createUser({
      email: 'ed@example.com',
      name: 'Ed',
      emailVerified: true,
    });
    expect(learner.ok && educator.ok).toBe(true);
    if (!learner.ok || !educator.ok) return;
    void (await identity.addRole(educator.val.id, 'educator'));

    const questions: Question[] = [
      question('1/2 + 1/4 = ?', {
        kind: 'single_choice',
        options: optionsOf('3/4, 1/4'),
        keyOptionId: '3/4',
      }),
      question('Why is 3/6 one half?', { kind: 'short_answer', rubric: 'divides by 3' }),
    ];
    for (const q of questions) void (await store.addQuestion(q));
    const assessmentId = newId<'assessment'>();
    void (await store.createAssessment({
      id: assessmentId,
      title: 'Fractions check',
      purpose: 'quiz',
      subjectId: null,
      trackId: null,
      lessonId: null,
      questionIds: questions.map((q) => q.id),
      status: 'ready',
      createdBy: educator.val.id,
    }));
    const loaded = await store.getAssessment(assessmentId);
    expect(loaded.ok && loaded.val?.questionIds).toEqual(questions.map((q) => q.id));

    const grader = scriptedGrader({ score: 0.5, feedback: 'Half there' });
    const deps = {
      store,
      grader,
      roles: { rolesOf: (id: typeof learner.val.id) => identity.getRoles(id) },
    };
    const answers = new Map<Question['id'], Answer>([
      [questions[0]!.id, { kind: 'single_choice', optionId: '3/4' }],
      [questions[1]!.id, { kind: 'short_answer', text: 'because 3 is half of 6' }],
    ]);
    const submitted = await submitAttempt(deps, {
      learnerId: learner.val.id,
      assessmentId,
      answers,
      now: new Date('2026-09-16T09:00:00Z'),
    });
    expect(submitted.ok && submitted.val.score).toBe(1.5);

    const responses = submitted.ok
      ? await store.listResponses(submitted.val.attempt.id)
      : undefined;
    const open = responses?.ok
      ? responses.val.find((r) => r.questionId === questions[1]!.id)
      : undefined;
    expect(open?.answer).toEqual({ kind: 'short_answer', text: 'because 3 is half of 6' });
    if (!open || !submitted.ok) return;

    const overridden = await overrideGrade(deps, {
      actorId: educator.val.id,
      responseId: open.id,
      score: 1,
      feedback: 'Right',
      now: new Date('2026-09-16T10:00:00Z'),
    });
    expect(overridden.ok).toBe(true);
    const score = await attemptScore(deps, submitted.val.attempt.id);
    expect(score.ok && score.val).toEqual({ score: 2, total: 2 });
  });
});
