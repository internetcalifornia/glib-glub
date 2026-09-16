/**
 * In-memory SessionStore and fakes for the other ports, and the scenario
 * world the step definitions share: learners with a snapshot, a track with
 * a due lesson, a recorded summary, a flashcard deck, lesson completion.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import {
  fixedClock,
  newId,
  type LessonId,
  type TrackId,
  type TutorSessionId,
  type UserId,
} from '@glib-glub/core';
import type { AgeBand } from '@glib-glub/identity';

import type {
  Flashcards,
  Learners,
  Lessons,
  NextLesson,
  Progress,
  SessionStore,
  TutorDeps,
} from './ports';
import { recordSummariser } from './summarise';
import type { LearnerContext, SessionSummary, ToolCall, Turn, TutorSession } from './types';

export function memorySessionStore(): SessionStore {
  const sessions = new Map<TutorSessionId, TutorSession>();
  const turns: Turn[] = [];
  const calls: ToolCall[] = [];
  return {
    createSession: async (session): ReturnType<SessionStore['createSession']> => {
      sessions.set(session.id, session);
      return ok();
    },
    getSession: async (id): ReturnType<SessionStore['getSession']> => ok(sessions.get(id) ?? null),
    updateSession: async (session): ReturnType<SessionStore['updateSession']> => {
      if (!sessions.has(session.id)) return err('NOT_FOUND');
      sessions.set(session.id, session);
      return ok();
    },
    addTurn: async (turn): ReturnType<SessionStore['addTurn']> => {
      turns.push(turn);
      return ok();
    },
    listTurns: async (sessionId): ReturnType<SessionStore['listTurns']> =>
      ok(turns.filter((t) => t.sessionId === sessionId)),
    addToolCall: async (call): ReturnType<SessionStore['addToolCall']> => {
      calls.push(call);
      return ok();
    },
    listToolCalls: async (sessionId): ReturnType<SessionStore['listToolCalls']> =>
      ok(calls.filter((c) => c.sessionId === sessionId)),
    lastSummary: async (learnerId, trackId): ReturnType<SessionStore['lastSummary']> =>
      ok(
        [...sessions.values()]
          .filter(
            (s) =>
              s.learnerId === learnerId &&
              s.trackId === trackId &&
              s.status === 'ended' &&
              s.summary
          )
          .sort((a, b) => (b.endedAt?.getTime() ?? 0) - (a.endedAt?.getTime() ?? 0))[0]?.summary ??
          null
      ),
  };
}

export interface TutorWorld extends TutorDeps {
  learnerIds: Map<string, UserId>;
  contexts: Map<UserId, LearnerContext>;
  tracks: Map<string, NextLesson>;
  defaultTrack: string | null;
  completed: Array<{ learnerId: UserId; lessonId: LessonId }>;
  cards: Array<{ learnerId: UserId; lessonTitle: string; front: string; back: string }>;
  summaries: Map<string, SessionSummary>;
  addLearner(email: string, band: AgeBand | null, snapshotText: string): UserId;
  addTrack(
    title: string,
    input: { pedagogy?: string; language?: string; lessonTitle: string; notes: string }
  ): void;
  userIdOf(email: string): UserId;
}

export function tutorWorld(): TutorWorld {
  const learnerIds = new Map<string, UserId>();
  const contexts = new Map<UserId, LearnerContext>();
  const tracks = new Map<string, NextLesson>();
  const completed: TutorWorld['completed'] = [];
  const cards: TutorWorld['cards'] = [];
  const summaries = new Map<string, SessionSummary>();
  const store = memorySessionStore();

  const learners: Learners = {
    learnerContext: async (learnerId): ReturnType<Learners['learnerContext']> => {
      const context = contexts.get(learnerId);
      return context ? ok(context) : err('NOT_FOUND');
    },
  };
  const lessons: Lessons = {
    nextLesson: async (_learnerId, trackId): ReturnType<Lessons['nextLesson']> => {
      const byId = trackId ? [...tracks.values()].find((t) => t.trackId === trackId) : undefined;
      const chosen =
        byId ??
        (world.defaultTrack ? tracks.get(world.defaultTrack) : undefined) ??
        [...tracks.values()][0];
      return chosen ? ok(chosen) : err('NOTHING_DUE');
    },
  };
  const progress: Progress = {
    completeLesson: async ({ learnerId, lessonId }): ReturnType<Progress['completeLesson']> => {
      completed.push({ learnerId, lessonId });
      return ok();
    },
  };
  const flashcards: Flashcards = {
    addCard: async ({ learnerId, lessonTitle, front, back }): ReturnType<Flashcards['addCard']> => {
      cards.push({ learnerId, lessonTitle, front, back });
      return ok();
    },
  };
  const world: TutorWorld = {
    store,
    learners,
    lessons,
    progress,
    flashcards,
    summariser: {
      summarise: async (input): ReturnType<TutorDeps['summariser']['summarise']> => {
        const scripted = summaries.get(input.session.learnerId);
        return scripted ? ok(scripted) : recordSummariser.summarise(input);
      },
    },
    clock: fixedClock(new Date('2026-09-16T09:00:00Z')),
    learnerIds,
    contexts,
    tracks,
    defaultTrack: null,
    completed,
    cards,
    summaries,
    addLearner(email, band, snapshotText) {
      const id = newId<'user'>();
      learnerIds.set(email, id);
      contexts.set(id, { name: email.split('@')[0] ?? email, ageBand: band, snapshotText });
      return id;
    },
    addTrack(title, input) {
      tracks.set(title, {
        trackId: newId<'track'>(),
        track: {
          title,
          pedagogy: input.pedagogy ?? 'Ask first.',
          language: input.language ?? 'en',
        },
        lessonId: newId<'lesson'>(),
        lesson: { title: input.lessonTitle, objectives: [], notes: input.notes },
      });
      if (!world.defaultTrack) world.defaultTrack = title;
    },
    userIdOf(email) {
      return learnerIds.get(email) ?? newId<'user'>();
    },
  };
  return world;
}

export type { TrackId };
