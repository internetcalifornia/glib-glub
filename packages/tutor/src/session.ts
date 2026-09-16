/**
 * Session lifecycle: start with everything the tutor needs, record turns,
 * end with a summary — and mark the lesson done, because a session that
 * reached its end is the platform's definition of "did the lesson".
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import { newId, type TrackId, type TutorSessionId, type UserId } from '@glib-glub/core';

import { buildInstructions } from './instructions';
import type { TutorDeps } from './ports';
import type {
  Participant,
  ParticipantRole,
  SessionMode,
  Speaker,
  Transport,
  Turn,
  TutorSession,
} from './types';
import { voiceProfile, type VoiceProfile } from './voice';

export interface ParticipantInput {
  name: string;
  role: ParticipantRole;
  userId?: UserId | null;
}

export interface StartInput {
  learnerId: UserId;
  trackId?: TrackId | null;
  mode: SessionMode;
  transport: Transport;
  /** The learner is added automatically; list the others. */
  others?: ReadonlyArray<ParticipantInput>;
}

export interface StartedSession {
  session: TutorSession;
  instructions: string;
  voice: VoiceProfile;
}

export async function startSession(
  deps: TutorDeps,
  input: StartInput
): AsyncResult<StartedSession, 'NOT_FOUND' | 'NOTHING_DUE' | 'VALIDATION_ERROR' | 'DB_ERROR'> {
  const learner = await deps.learners.learnerContext(input.learnerId);
  if (!learner.ok) return learner;
  const next = await deps.lessons.nextLesson(input.learnerId, input.trackId ?? null);
  if (!next.ok) return next;
  const lastSummary = await deps.store.lastSummary(input.learnerId, next.val.trackId);
  if (!lastSummary.ok) return lastSummary;

  const others = input.others ?? [];
  if (input.mode === 'solo' && others.length > 0)
    return err('VALIDATION_ERROR', { message: 'A solo session has no other participants' });
  if (input.mode === 'with_guardian' && !others.some((p) => p.role === 'guardian'))
    return err('VALIDATION_ERROR', { message: 'A guardian session needs a guardian' });
  if (input.mode === 'with_educator' && !others.some((p) => p.role === 'educator'))
    return err('VALIDATION_ERROR', { message: 'An educator session needs an educator' });

  const participants: Participant[] = [
    { id: 'learner', name: learner.val.name, role: 'learner', userId: input.learnerId },
    ...others.map<Participant>((p, index) => ({
      id: `${p.role}-${index + 1}`,
      name: p.name,
      role: p.role,
      userId: p.userId ?? null,
    })),
  ];

  const session: TutorSession = {
    id: newId<'tutor_session'>(),
    learnerId: input.learnerId,
    trackId: next.val.trackId,
    lessonId: next.val.lessonId,
    lessonTitle: next.val.lesson.title,
    mode: input.mode,
    transport: input.transport,
    status: 'live',
    participants,
    problems: [],
    startedAt: deps.clock.now(),
    endedAt: null,
    summary: null,
  };
  const saved = await deps.store.createSession(session);
  if (!saved.ok) return saved;

  return ok({
    session,
    instructions: buildInstructions({
      learner: learner.val,
      track: next.val.track,
      lesson: next.val.lesson,
      mode: input.mode,
      participants,
      lastSummary: lastSummary.val,
    }),
    voice: voiceProfile({
      ageBand: learner.val.ageBand,
      language: next.val.track.language,
      mode: input.mode,
    }),
  });
}

export async function recordTurn(
  deps: TutorDeps,
  input: { sessionId: TutorSessionId; speaker: Speaker; text: string }
): AsyncResult<Turn, 'NOT_FOUND' | 'SESSION_NOT_LIVE' | 'DB_ERROR'> {
  const session = await deps.store.getSession(input.sessionId);
  if (!session.ok) return session;
  if (!session.val) return err('NOT_FOUND');
  if (session.val.status !== 'live') return err('SESSION_NOT_LIVE');
  const turn: Turn = {
    id: newId<'turn'>(),
    sessionId: input.sessionId,
    at: deps.clock.now(),
    speaker: input.speaker,
    text: input.text,
  };
  const saved = await deps.store.addTurn(turn);
  if (!saved.ok) return saved;
  return ok(turn);
}

function mayAct(session: TutorSession, actorId: UserId): boolean {
  return session.learnerId === actorId || session.participants.some((p) => p.userId === actorId);
}

export async function endSession(
  deps: TutorDeps,
  input: { actorId: UserId; sessionId: TutorSessionId }
): AsyncResult<
  TutorSession,
  'FORBIDDEN' | 'NOT_FOUND' | 'SESSION_NOT_LIVE' | 'SUMMARY_FAILED' | 'DB_ERROR'
> {
  const loaded = await deps.store.getSession(input.sessionId);
  if (!loaded.ok) return loaded;
  if (!loaded.val) return err('NOT_FOUND');
  const session = loaded.val;
  if (!mayAct(session, input.actorId))
    return err('FORBIDDEN', { message: 'Only the learner or a participant may end the session' });
  if (session.status !== 'live') return err('SESSION_NOT_LIVE');

  const turns = await deps.store.listTurns(session.id);
  if (!turns.ok) return turns;
  const toolCalls = await deps.store.listToolCalls(session.id);
  if (!toolCalls.ok) return toolCalls;
  const now = deps.clock.now();
  const summary = await deps.summariser.summarise({
    session,
    turns: turns.val,
    toolCalls: toolCalls.val,
    now,
  });
  if (!summary.ok) return summary;

  const ended: TutorSession = { ...session, status: 'ended', endedAt: now, summary: summary.val };
  const saved = await deps.store.updateSession(ended);
  if (!saved.ok) return saved;
  const completed = await deps.progress.completeLesson({
    learnerId: session.learnerId,
    trackId: session.trackId,
    lessonId: session.lessonId,
    now,
  });
  if (!completed.ok && completed.err.type !== 'NOT_FOUND') return completed;
  return ok(ended);
}

export async function failSession(
  deps: TutorDeps,
  sessionId: TutorSessionId,
  reason: string
): AsyncResult<void, 'NOT_FOUND' | 'DB_ERROR'> {
  const loaded = await deps.store.getSession(sessionId);
  if (!loaded.ok) return loaded;
  if (!loaded.val) return err('NOT_FOUND');
  if (loaded.val.status === 'ended') return ok();
  const failed: TutorSession = {
    ...loaded.val,
    status: 'failed',
    endedAt: deps.clock.now(),
    summary: loaded.val.summary ?? {
      covered: [],
      problemsPresented: 0,
      problemsSolved: 0,
      misconceptions: [],
      nextSteps: [],
      minutes: 0,
      narrative: `Session failed: ${reason}`,
    },
  };
  const saved = await deps.store.updateSession(failed);
  if (!saved.ok) return saved;
  return ok();
}
