/**
 * Questions of six kinds, assessments made of them, a learner's attempt
 * with its responses, and gradings — each a fact with a history, never a
 * mutable cell.
 */

import type {
  AssessmentId,
  AttemptId,
  Brand,
  GradingId,
  LessonId,
  QuestionId,
  SubjectId,
  TrackId,
  UserId,
} from '@glib-glub/core';

export const QUESTION_KINDS = [
  'single_choice',
  'multi_select',
  'true_false',
  'fill_blank',
  'short_answer',
  'long_answer',
] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

export interface Option {
  readonly id: string;
  readonly text: string;
}

/** Kind-specific body: what is asked, and the key or rubric. */
export type QuestionBody =
  | { kind: 'single_choice'; options: ReadonlyArray<Option>; keyOptionId: string }
  | { kind: 'multi_select'; options: ReadonlyArray<Option>; keyOptionIds: ReadonlyArray<string> }
  | { kind: 'true_false'; key: boolean }
  | { kind: 'fill_blank'; accepted: ReadonlyArray<string>; tolerance?: number }
  | { kind: 'short_answer'; rubric: string; sampleAnswer?: string; maxWords?: number }
  | { kind: 'long_answer'; rubric: string; sampleAnswer?: string; minWords?: number };

export interface Question {
  readonly id: QuestionId;
  readonly prompt: string;
  readonly body: QuestionBody;
  /** Points this question is worth. Default 1. */
  readonly points: number;
}

/** What a learner submitted for one question. */
export type Answer =
  | { kind: 'single_choice'; optionId: string }
  | { kind: 'multi_select'; optionIds: ReadonlyArray<string> }
  | { kind: 'true_false'; value: boolean }
  | { kind: 'fill_blank'; text: string }
  | { kind: 'short_answer'; text: string }
  | { kind: 'long_answer'; text: string };

export type AssessmentPurpose = 'baseline' | 'quiz' | 'test';

export interface Assessment {
  readonly id: AssessmentId;
  readonly title: string;
  readonly purpose: AssessmentPurpose;
  readonly subjectId: SubjectId | null;
  readonly trackId: TrackId | null;
  readonly lessonId: LessonId | null;
  readonly questionIds: ReadonlyArray<QuestionId>;
  readonly status: 'draft' | 'ready';
  readonly createdBy: UserId | null;
}

export interface Attempt {
  readonly id: AttemptId;
  readonly assessmentId: AssessmentId;
  readonly learnerId: UserId;
  readonly submittedAt: Date;
}

export type ResponseId = Brand<string, 'response'>;

export interface Response {
  readonly id: ResponseId;
  readonly attemptId: AttemptId;
  readonly questionId: QuestionId;
  readonly answer: Answer | null;
}

export type GraderKind = 'auto' | 'llm' | 'educator';

export interface Grading {
  readonly id: GradingId;
  readonly responseId: ResponseId;
  readonly grader: GraderKind;
  /** 0–1, a fraction of the question's points. */
  readonly score: number;
  readonly feedback: string;
  readonly overrideOf: GradingId | null;
  readonly gradedBy: UserId | null;
  readonly gradedAt: Date;
}

export const LEVELS = ['beginning', 'developing', 'proficient', 'advanced'] as const;
export type Level = (typeof LEVELS)[number];

export interface LevelEstimate {
  readonly learnerId: UserId;
  readonly subjectId: SubjectId;
  readonly level: Level;
  readonly score: number;
  readonly attemptId: AttemptId;
  readonly estimatedAt: Date;
}

export interface Grade {
  readonly score: number;
  readonly feedback: string;
}
