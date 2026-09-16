/**
 * The seams the tutor is built on. Each is the narrow slice of another
 * package this one needs, so the session logic is testable with fakes and
 * the apps wire the real modules.
 */

import type { AsyncResult } from '@campfhir/safe-functions/types';
import type { Clock, LessonId, TrackId, TutorSessionId, UserId } from '@glib-glub/core';

import type {
  LearnerContext,
  LessonContext,
  SessionSummary,
  ToolCall,
  TrackContext,
  Turn,
  TutorSession,
} from './types';

export interface SessionStore {
  createSession(session: TutorSession): AsyncResult<void, 'DB_ERROR'>;
  getSession(id: TutorSessionId): AsyncResult<TutorSession | null, 'DB_ERROR'>;
  updateSession(session: TutorSession): AsyncResult<void, 'DB_ERROR' | 'NOT_FOUND'>;
  addTurn(turn: Turn): AsyncResult<void, 'DB_ERROR'>;
  listTurns(sessionId: TutorSessionId): AsyncResult<Turn[], 'DB_ERROR'>;
  addToolCall(call: ToolCall): AsyncResult<void, 'DB_ERROR'>;
  listToolCalls(sessionId: TutorSessionId): AsyncResult<ToolCall[], 'DB_ERROR'>;
  /** The most recent ended session's summary for this learner on this track. */
  lastSummary(learnerId: UserId, trackId: TrackId): AsyncResult<SessionSummary | null, 'DB_ERROR'>;
}

export interface Learners {
  learnerContext(learnerId: UserId): AsyncResult<LearnerContext, 'NOT_FOUND' | 'DB_ERROR'>;
}

export interface NextLesson {
  trackId: TrackId;
  track: TrackContext;
  lessonId: LessonId;
  lesson: LessonContext;
}

export interface Lessons {
  /** What the learner should work on now — on a given track, or their first active enrollment. */
  nextLesson(
    learnerId: UserId,
    trackId: TrackId | null
  ): AsyncResult<NextLesson, 'NOTHING_DUE' | 'NOT_FOUND' | 'DB_ERROR'>;
}

export interface Progress {
  completeLesson(input: {
    learnerId: UserId;
    trackId: TrackId;
    lessonId: LessonId;
    now: Date;
  }): AsyncResult<void, 'NOT_FOUND' | 'DB_ERROR'>;
}

export interface Flashcards {
  addCard(input: {
    learnerId: UserId;
    lessonId: LessonId;
    lessonTitle: string;
    front: string;
    back: string;
    now: Date;
  }): AsyncResult<void, 'VALIDATION_ERROR' | 'DB_ERROR'>;
}

export interface SummaryInput {
  session: TutorSession;
  turns: ReadonlyArray<Turn>;
  toolCalls: ReadonlyArray<ToolCall>;
  now: Date;
}

export interface SessionSummariser {
  summarise(input: SummaryInput): AsyncResult<SessionSummary, 'SUMMARY_FAILED'>;
}

export interface TutorDeps {
  store: SessionStore;
  learners: Learners;
  lessons: Lessons;
  progress: Progress;
  flashcards: Flashcards;
  summariser: SessionSummariser;
  clock: Clock;
}
