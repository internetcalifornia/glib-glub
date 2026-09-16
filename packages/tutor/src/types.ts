/**
 * A tutoring session: who is in it, what it is about, every turn and tool
 * call, and the summary it leaves behind for the next one.
 */

import type { Brand, LessonId, TrackId, TutorSessionId, UserId } from '@glib-glub/core';
import type { AgeBand } from '@glib-glub/identity';

export type SessionMode = 'solo' | 'with_guardian' | 'with_educator';
export type Transport = 'voice' | 'text';
export type SessionStatus = 'starting' | 'live' | 'ending' | 'ended' | 'failed';

export type ParticipantRole = 'learner' | 'guardian' | 'educator';

export interface Participant {
  readonly id: string;
  readonly name: string;
  readonly role: ParticipantRole;
  /** The platform account behind this participant, when signed in. */
  readonly userId: UserId | null;
}

export type ProblemId = Brand<string, 'problem'>;

export interface Problem {
  readonly id: ProblemId;
  readonly text: string;
  readonly expectedAnswer: string;
  readonly attempts: ReadonlyArray<string>;
  readonly solved: boolean;
  readonly closed: boolean;
}

export type Speaker =
  | { kind: 'tutor' }
  | { kind: 'participant'; participantId: string }
  | { kind: 'unknown'; label: string };

export type TurnId = Brand<string, 'turn'>;

export interface Turn {
  readonly id: TurnId;
  readonly sessionId: TutorSessionId;
  readonly at: Date;
  readonly speaker: Speaker;
  readonly text: string;
}

export type ToolCallId = Brand<string, 'tool_call'>;

export interface ToolCall {
  readonly id: ToolCallId;
  readonly sessionId: TutorSessionId;
  readonly at: Date;
  readonly name: string;
  readonly args: Record<string, unknown>;
  readonly result: Record<string, unknown>;
}

export interface SessionSummary {
  readonly covered: ReadonlyArray<string>;
  readonly problemsPresented: number;
  readonly problemsSolved: number;
  readonly misconceptions: ReadonlyArray<string>;
  readonly nextSteps: ReadonlyArray<string>;
  readonly minutes: number;
  /** Free text for the next session's instructions. */
  readonly narrative: string;
}

export interface TutorSession {
  readonly id: TutorSessionId;
  readonly learnerId: UserId;
  readonly trackId: TrackId;
  readonly lessonId: LessonId;
  readonly lessonTitle: string;
  readonly mode: SessionMode;
  readonly transport: Transport;
  readonly status: SessionStatus;
  readonly participants: ReadonlyArray<Participant>;
  /** Problems presented so far; the open one is the last with closed = false. */
  readonly problems: ReadonlyArray<Problem>;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly summary: SessionSummary | null;
}

/** What instruction assembly needs to know about the learner. */
export interface LearnerContext {
  readonly name: string;
  readonly ageBand: AgeBand | null;
  readonly snapshotText: string;
}

export interface LessonContext {
  readonly title: string;
  readonly objectives: ReadonlyArray<string>;
  readonly notes: string;
}

export interface TrackContext {
  readonly title: string;
  readonly pedagogy: string;
  readonly language: string;
}
