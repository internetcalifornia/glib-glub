/**
 * A quiz from a lesson: the model proposes questions of mixed kinds from
 * the lesson's objectives and the tutor's notes, validated by schema into
 * the six question kinds, stored as a `quiz` assessment.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import { completeJson, type LlmProvider } from '@glib-glub/ai';
import { newId, type LessonId, type SubjectId, type TrackId, type UserId } from '@glib-glub/core';
import { z } from 'zod';

import type { AssessmentStore } from './ports';
import type { Assessment, Question, QuestionBody } from './types';

const option = z.object({ id: z.string().min(1).max(8), text: z.string().min(1).max(300) });

const proposedQuestion = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('single_choice'),
    prompt: z.string().min(1),
    options: z.array(option).min(2).max(6),
    keyOptionId: z.string(),
  }),
  z.object({
    kind: z.literal('multi_select'),
    prompt: z.string().min(1),
    options: z.array(option).min(2).max(6),
    keyOptionIds: z.array(z.string()).min(1),
  }),
  z.object({ kind: z.literal('true_false'), prompt: z.string().min(1), key: z.boolean() }),
  z.object({
    kind: z.literal('fill_blank'),
    prompt: z.string().min(1),
    accepted: z.array(z.string().min(1)).min(1),
    tolerance: z.number().min(0).optional(),
  }),
  z.object({
    kind: z.literal('short_answer'),
    prompt: z.string().min(1),
    rubric: z.string().min(1),
    sampleAnswer: z.string().optional(),
  }),
  z.object({
    kind: z.literal('long_answer'),
    prompt: z.string().min(1),
    rubric: z.string().min(1),
    sampleAnswer: z.string().optional(),
  }),
]);

const proposalSchema = z.object({ questions: z.array(proposedQuestion).min(1).max(20) });

export const QUIZ_SYSTEM_PROMPT = `You write a short quiz for one lesson, for the learner to check what stuck. Mix kinds: single_choice, multi_select, true_false, fill_blank, short_answer (and long_answer only if asked). Every objective question must have exactly one defensible key; every open question a rubric of 1–3 concrete points. Match the lesson's level and language.
Answer with JSON: {"questions": [...]} where each question is one of:
{"kind":"single_choice","prompt":string,"options":[{"id":"a","text":string},...],"keyOptionId":"a"}
{"kind":"multi_select","prompt":string,"options":[...],"keyOptionIds":["a","c"]}
{"kind":"true_false","prompt":string,"key":true}
{"kind":"fill_blank","prompt":string,"accepted":[string,...],"tolerance":number?}
{"kind":"short_answer","prompt":string,"rubric":string,"sampleAnswer":string?}
{"kind":"long_answer","prompt":string,"rubric":string,"sampleAnswer":string?}`;

export interface QuizLesson {
  title: string;
  objectives: ReadonlyArray<string>;
  content: string;
}

export interface GenerateQuizInput {
  lesson: QuizLesson;
  count: number;
  subjectId?: SubjectId | null;
  trackId?: TrackId | null;
  lessonId?: LessonId | null;
  createdBy?: UserId | null;
  /** `ready` for self-directed use; `draft` until an educator approves. */
  status?: Assessment['status'];
}

export async function generateQuiz(
  deps: { store: AssessmentStore; llm: LlmProvider },
  input: GenerateQuizInput
): AsyncResult<
  { assessment: Assessment; questions: Question[] },
  'GENERATION_FAILED' | 'VALIDATION_ERROR' | 'DB_ERROR'
> {
  const count = Math.max(1, Math.min(20, Math.floor(input.count)));
  const proposal = await completeJson(
    deps.llm,
    {
      system: QUIZ_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Write ${count} questions.\n\nLesson: ${input.lesson.title}\nObjectives:\n${input.lesson.objectives.map((o) => `- ${o}`).join('\n')}\n\nTutor notes:\n${input.lesson.content}`,
        },
      ],
      maxTokens: 2_500,
      temperature: 0.3,
    },
    proposalSchema
  );
  if (!proposal.ok)
    return err('GENERATION_FAILED', { message: proposal.err.message, cause: proposal.err });

  const questions: Question[] = [];
  for (const proposed of proposal.val.value.questions.slice(0, count)) {
    const body = toBody(proposed);
    if (!body.ok) return body;
    const question: Question = {
      id: newId<'question'>(),
      prompt: proposed.prompt,
      body: body.val,
      points: 1,
    };
    const saved = await deps.store.addQuestion(question);
    if (!saved.ok) return saved;
    questions.push(question);
  }
  const assessment: Assessment = {
    id: newId<'assessment'>(),
    title: `Quiz: ${input.lesson.title}`,
    purpose: 'quiz',
    subjectId: input.subjectId ?? null,
    trackId: input.trackId ?? null,
    lessonId: input.lessonId ?? null,
    questionIds: questions.map((question) => question.id),
    status: input.status ?? 'draft',
    createdBy: input.createdBy ?? null,
  };
  const saved = await deps.store.createAssessment(assessment);
  if (!saved.ok) return saved;
  return ok({ assessment, questions });
}

function toBody(proposed: z.output<typeof proposedQuestion>): ReturnType<typeof validateBody> {
  return validateBody(proposed);
}

function validateBody(proposed: z.output<typeof proposedQuestion>) {
  switch (proposed.kind) {
    case 'single_choice': {
      if (!proposed.options.some((o) => o.id === proposed.keyOptionId)) {
        return err('VALIDATION_ERROR', { message: 'The key is not one of the options' });
      }
      const body: QuestionBody = {
        kind: 'single_choice',
        options: proposed.options,
        keyOptionId: proposed.keyOptionId,
      };
      return ok(body);
    }
    case 'multi_select': {
      if (!proposed.keyOptionIds.every((id) => proposed.options.some((o) => o.id === id))) {
        return err('VALIDATION_ERROR', { message: 'A key is not one of the options' });
      }
      const body: QuestionBody = {
        kind: 'multi_select',
        options: proposed.options,
        keyOptionIds: proposed.keyOptionIds,
      };
      return ok(body);
    }
    case 'true_false': {
      const body: QuestionBody = { kind: 'true_false', key: proposed.key };
      return ok(body);
    }
    case 'fill_blank': {
      const body: QuestionBody = {
        kind: 'fill_blank',
        accepted: proposed.accepted,
        ...(proposed.tolerance === undefined ? {} : { tolerance: proposed.tolerance }),
      };
      return ok(body);
    }
    case 'short_answer': {
      const body: QuestionBody = {
        kind: 'short_answer',
        rubric: proposed.rubric,
        ...(proposed.sampleAnswer === undefined ? {} : { sampleAnswer: proposed.sampleAnswer }),
      };
      return ok(body);
    }
    case 'long_answer': {
      const body: QuestionBody = {
        kind: 'long_answer',
        rubric: proposed.rubric,
        ...(proposed.sampleAnswer === undefined ? {} : { sampleAnswer: proposed.sampleAnswer }),
      };
      return ok(body);
    }
  }
}
