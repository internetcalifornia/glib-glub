/**
 * The Postgres AssessmentStore. Question bodies and answers are jsonb and
 * are re-validated on read — a row that does not parse is a DB_ERROR with
 * the id in the message, not a silent shape mismatch at grading time.
 */

import { err, ok, wrapAsync } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import { brandId } from '@glib-glub/core';
import type { DB } from '@glib-glub/db';
import type { Kysely } from 'kysely';
import { z } from 'zod';

import type { AssessmentStore } from './ports';
import {
  LEVELS,
  QUESTION_KINDS,
  type Answer,
  type Assessment,
  type Attempt,
  type Grading,
  type Level,
  type LevelEstimate,
  type Question,
  type QuestionBody,
  type Response,
} from './types';

const option = z.object({ id: z.string(), text: z.string() });
const bodySchema: z.ZodType<QuestionBody> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('single_choice'), options: z.array(option), keyOptionId: z.string() }),
  z.object({
    kind: z.literal('multi_select'),
    options: z.array(option),
    keyOptionIds: z.array(z.string()),
  }),
  z.object({ kind: z.literal('true_false'), key: z.boolean() }),
  z.object({
    kind: z.literal('fill_blank'),
    accepted: z.array(z.string()),
    tolerance: z.number().optional(),
  }),
  z.object({
    kind: z.literal('short_answer'),
    rubric: z.string(),
    sampleAnswer: z.string().optional(),
    maxWords: z.number().optional(),
  }),
  z.object({
    kind: z.literal('long_answer'),
    rubric: z.string(),
    sampleAnswer: z.string().optional(),
    minWords: z.number().optional(),
  }),
]);
const answerSchema: z.ZodType<Answer> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('single_choice'), optionId: z.string() }),
  z.object({ kind: z.literal('multi_select'), optionIds: z.array(z.string()) }),
  z.object({ kind: z.literal('true_false'), value: z.boolean() }),
  z.object({ kind: z.literal('fill_blank'), text: z.string() }),
  z.object({ kind: z.literal('short_answer'), text: z.string() }),
  z.object({ kind: z.literal('long_answer'), text: z.string() }),
]);

function toLevel(value: string): Level {
  return LEVELS.find((level) => level === value) ?? 'beginning';
}

function toGrading(row: {
  id: string;
  response_id: string;
  grader: string;
  score: string | number;
  feedback: string;
  override_of: string | null;
  graded_by: string | null;
  graded_at: Date;
}): Grading {
  return {
    id: brandId<'grading'>(row.id),
    responseId: brandId<'response'>(row.response_id),
    grader: row.grader === 'llm' ? 'llm' : row.grader === 'educator' ? 'educator' : 'auto',
    score: Number(row.score),
    feedback: row.feedback,
    overrideOf: row.override_of ? brandId<'grading'>(row.override_of) : null,
    gradedBy: row.graded_by ? brandId<'user'>(row.graded_by) : null,
    gradedAt: row.graded_at,
  };
}

export function kyselyAssessmentStore(db: Kysely<DB>): AssessmentStore {
  const questionIdsOf = async (assessmentId: string): AsyncResult<string[], 'DB_ERROR'> => {
    const rows = await wrapAsync(
      () =>
        db
          .selectFrom('assessment_questions')
          .select('question_id')
          .where('assessment_id', '=', assessmentId)
          .orderBy('position')
          .execute(),
      'DB_ERROR'
    );
    if (!rows.ok) return rows;
    return ok(rows.val.map((row) => row.question_id));
  };

  return {
    addQuestion: async (question): ReturnType<AssessmentStore['addQuestion']> => {
      if (!QUESTION_KINDS.includes(question.body.kind))
        return err('DB_ERROR', { message: 'Unknown question kind' });
      const saved = await wrapAsync(
        () =>
          db
            .insertInto('questions')
            .values({
              id: question.id,
              kind: question.body.kind,
              prompt: question.prompt,
              body: JSON.stringify(question.body),
              points: question.points,
            })
            .execute(),
        'DB_ERROR'
      );
      if (!saved.ok) return saved;
      return ok();
    },
    getQuestions: async (ids): ReturnType<AssessmentStore['getQuestions']> => {
      if (ids.length === 0) return ok([]);
      const rows = await wrapAsync(
        () =>
          db
            .selectFrom('questions')
            .selectAll()
            .where('id', 'in', [...ids])
            .execute(),
        'DB_ERROR'
      );
      if (!rows.ok) return rows;
      const byId = new Map(rows.val.map((row) => [row.id, row]));
      const questions: Question[] = [];
      for (const id of ids) {
        const row = byId.get(id);
        if (!row) continue;
        const body = bodySchema.safeParse(row.body);
        if (!body.success)
          return err('DB_ERROR', { message: `Question ${id} has an unreadable body` });
        questions.push({
          id: brandId<'question'>(row.id),
          prompt: row.prompt,
          body: body.data,
          points: row.points,
        });
      }
      return ok(questions);
    },

    createAssessment: async (assessment): ReturnType<AssessmentStore['createAssessment']> => {
      const saved = await wrapAsync(async () => {
        await db
          .insertInto('assessments')
          .values({
            id: assessment.id,
            title: assessment.title,
            purpose: assessment.purpose,
            subject_id: assessment.subjectId,
            track_id: assessment.trackId,
            lesson_id: assessment.lessonId,
            status: assessment.status,
            created_by: assessment.createdBy,
          })
          .execute();
        if (assessment.questionIds.length > 0) {
          await db
            .insertInto('assessment_questions')
            .values(
              assessment.questionIds.map((questionId, index) => ({
                assessment_id: assessment.id,
                question_id: questionId,
                position: index + 1,
              }))
            )
            .execute();
        }
      }, 'DB_ERROR');
      if (!saved.ok) return saved;
      return ok();
    },
    getAssessment: async (id): ReturnType<AssessmentStore['getAssessment']> => {
      const row = await wrapAsync(
        () => db.selectFrom('assessments').selectAll().where('id', '=', id).executeTakeFirst(),
        'DB_ERROR'
      );
      if (!row.ok) return row;
      if (!row.val) return ok(null);
      const questionIds = await questionIdsOf(id);
      if (!questionIds.ok) return questionIds;
      const assessment: Assessment = {
        id,
        title: row.val.title,
        purpose:
          row.val.purpose === 'baseline'
            ? 'baseline'
            : row.val.purpose === 'test'
              ? 'test'
              : 'quiz',
        subjectId: row.val.subject_id ? brandId<'subject'>(row.val.subject_id) : null,
        trackId: row.val.track_id ? brandId<'track'>(row.val.track_id) : null,
        lessonId: row.val.lesson_id ? brandId<'lesson'>(row.val.lesson_id) : null,
        questionIds: questionIds.val.map((questionId) => brandId<'question'>(questionId)),
        status: row.val.status === 'ready' ? 'ready' : 'draft',
        createdBy: row.val.created_by ? brandId<'user'>(row.val.created_by) : null,
      };
      return ok(assessment);
    },

    createAttempt: async (attempt): ReturnType<AssessmentStore['createAttempt']> => {
      const saved = await wrapAsync(
        () =>
          db
            .insertInto('attempts')
            .values({
              id: attempt.id,
              assessment_id: attempt.assessmentId,
              learner_id: attempt.learnerId,
              submitted_at: attempt.submittedAt,
            })
            .execute(),
        'DB_ERROR'
      );
      if (!saved.ok) return saved;
      return ok();
    },
    getAttempt: async (id): ReturnType<AssessmentStore['getAttempt']> => {
      const row = await wrapAsync(
        () => db.selectFrom('attempts').selectAll().where('id', '=', id).executeTakeFirst(),
        'DB_ERROR'
      );
      if (!row.ok) return row;
      if (!row.val) return ok(null);
      const attempt: Attempt = {
        id,
        assessmentId: brandId<'assessment'>(row.val.assessment_id),
        learnerId: brandId<'user'>(row.val.learner_id),
        submittedAt: row.val.submitted_at,
      };
      return ok(attempt);
    },
    listAttempts: async (learnerId, assessmentId): ReturnType<AssessmentStore['listAttempts']> => {
      const rows = await wrapAsync(
        () =>
          db
            .selectFrom('attempts')
            .selectAll()
            .where('learner_id', '=', learnerId)
            .where('assessment_id', '=', assessmentId)
            .orderBy('submitted_at')
            .execute(),
        'DB_ERROR'
      );
      if (!rows.ok) return rows;
      return ok(
        rows.val.map<Attempt>((row) => ({
          id: brandId<'attempt'>(row.id),
          assessmentId,
          learnerId,
          submittedAt: row.submitted_at,
        }))
      );
    },

    addResponse: async (response): ReturnType<AssessmentStore['addResponse']> => {
      const saved = await wrapAsync(
        () =>
          db
            .insertInto('responses')
            .values({
              id: response.id,
              attempt_id: response.attemptId,
              question_id: response.questionId,
              answer: response.answer ? JSON.stringify(response.answer) : null,
            })
            .execute(),
        'DB_ERROR'
      );
      if (!saved.ok) return saved;
      return ok();
    },
    listResponses: async (attemptId): ReturnType<AssessmentStore['listResponses']> => {
      const rows = await wrapAsync(
        () => db.selectFrom('responses').selectAll().where('attempt_id', '=', attemptId).execute(),
        'DB_ERROR'
      );
      if (!rows.ok) return rows;
      const responses: Response[] = [];
      for (const row of rows.val) {
        const parsed = row.answer === null ? null : answerSchema.safeParse(row.answer);
        if (parsed && !parsed.success)
          return err('DB_ERROR', { message: `Response ${row.id} has an unreadable answer` });
        responses.push({
          id: brandId<'response'>(row.id),
          attemptId,
          questionId: brandId<'question'>(row.question_id),
          answer: parsed ? parsed.data : null,
        });
      }
      return ok(responses);
    },
    getResponse: async (id): ReturnType<AssessmentStore['getResponse']> => {
      const row = await wrapAsync(
        () => db.selectFrom('responses').selectAll().where('id', '=', id).executeTakeFirst(),
        'DB_ERROR'
      );
      if (!row.ok) return row;
      if (!row.val) return ok(null);
      const parsed = row.val.answer === null ? null : answerSchema.safeParse(row.val.answer);
      if (parsed && !parsed.success)
        return err('DB_ERROR', { message: `Response ${id} has an unreadable answer` });
      return ok({
        id,
        attemptId: brandId<'attempt'>(row.val.attempt_id),
        questionId: brandId<'question'>(row.val.question_id),
        answer: parsed ? parsed.data : null,
      });
    },

    addGrading: async (grading): ReturnType<AssessmentStore['addGrading']> => {
      const saved = await wrapAsync(
        () =>
          db
            .insertInto('gradings')
            .values({
              id: grading.id,
              response_id: grading.responseId,
              grader: grading.grader,
              score: grading.score,
              feedback: grading.feedback,
              override_of: grading.overrideOf,
              graded_by: grading.gradedBy,
              graded_at: grading.gradedAt,
            })
            .execute(),
        'DB_ERROR'
      );
      if (!saved.ok) return saved;
      return ok();
    },
    listGradings: async (responseId): ReturnType<AssessmentStore['listGradings']> => {
      const rows = await wrapAsync(
        () =>
          db
            .selectFrom('gradings')
            .selectAll()
            .where('response_id', '=', responseId)
            .orderBy('graded_at')
            .execute(),
        'DB_ERROR'
      );
      if (!rows.ok) return rows;
      return ok(rows.val.map(toGrading));
    },

    upsertLevelEstimate: async (estimate): ReturnType<AssessmentStore['upsertLevelEstimate']> => {
      const values = {
        learner_id: estimate.learnerId,
        subject_id: estimate.subjectId,
        level: estimate.level,
        score: estimate.score,
        attempt_id: estimate.attemptId,
        estimated_at: estimate.estimatedAt,
      };
      const saved = await wrapAsync(
        () =>
          db
            .insertInto('level_estimates')
            .values(values)
            .onConflict((oc) => oc.columns(['learner_id', 'subject_id']).doUpdateSet(values))
            .execute(),
        'DB_ERROR'
      );
      if (!saved.ok) return saved;
      return ok();
    },
    listLevelEstimates: async (learnerId): ReturnType<AssessmentStore['listLevelEstimates']> => {
      const rows = await wrapAsync(
        () =>
          db
            .selectFrom('level_estimates')
            .selectAll()
            .where('learner_id', '=', learnerId)
            .execute(),
        'DB_ERROR'
      );
      if (!rows.ok) return rows;
      return ok(
        rows.val.map<LevelEstimate>((row) => ({
          learnerId,
          subjectId: brandId<'subject'>(row.subject_id),
          level: toLevel(row.level),
          score: Number(row.score),
          attemptId: brandId<'attempt'>(row.attempt_id),
          estimatedAt: row.estimated_at,
        }))
      );
    },
    getLevelEstimate: async (
      learnerId,
      subjectId
    ): ReturnType<AssessmentStore['getLevelEstimate']> => {
      const row = await wrapAsync(
        () =>
          db
            .selectFrom('level_estimates')
            .selectAll()
            .where('learner_id', '=', learnerId)
            .where('subject_id', '=', subjectId)
            .executeTakeFirst(),
        'DB_ERROR'
      );
      if (!row.ok) return row;
      if (!row.val) return ok(null);
      return ok({
        learnerId,
        subjectId,
        level: toLevel(row.val.level),
        score: Number(row.val.score),
        attemptId: brandId<'attempt'>(row.val.attempt_id),
        estimatedAt: row.val.estimated_at,
      });
    },
  };
}

export const ASSESSMENT_TABLES: ReadonlyArray<string> = [
  'level_estimates',
  'gradings',
  'responses',
  'attempts',
  'assessment_questions',
  'assessments',
  'questions',
];
