/**
 * The Postgres SessionStore. Participants, problems, the summary, speakers
 * and tool arguments are jsonb documents validated on read — a session
 * row that no longer parses is a DB_ERROR naming the session, not a crash
 * in the middle of a lesson.
 */

import { err, ok, wrapAsync } from '@campfhir/safe-functions/helpers';
import { brandId } from '@glib-glub/core';
import type { DB } from '@glib-glub/db';
import type { Kysely } from 'kysely';
import { z } from 'zod';

import type { SessionStore } from './ports';
import type {
  Participant,
  Problem,
  SessionSummary,
  Speaker,
  ToolCall,
  Turn,
  TutorSession,
} from './types';

const participantSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['learner', 'guardian', 'educator']),
  userId: z.string().nullable(),
});
const problemSchema = z.object({
  id: z.string(),
  text: z.string(),
  expectedAnswer: z.string(),
  attempts: z.array(z.string()),
  solved: z.boolean(),
  closed: z.boolean(),
});
const summarySchema = z.object({
  covered: z.array(z.string()),
  problemsPresented: z.number(),
  problemsSolved: z.number(),
  misconceptions: z.array(z.string()),
  nextSteps: z.array(z.string()),
  minutes: z.number(),
  narrative: z.string(),
});
const speakerSchema: z.ZodType<Speaker> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('tutor') }),
  z.object({ kind: z.literal('participant'), participantId: z.string() }),
  z.object({ kind: z.literal('unknown'), label: z.string() }),
]);
const recordSchema = z.record(z.string(), z.unknown());

function toSession(row: {
  id: string;
  learner_id: string;
  track_id: string;
  lesson_id: string;
  lesson_title: string;
  mode: string;
  transport: string;
  status: string;
  participants: unknown;
  problems: unknown;
  summary: unknown;
  started_at: Date;
  ended_at: Date | null;
}): TutorSession | null {
  const participants = z.array(participantSchema).safeParse(row.participants);
  const problems = z.array(problemSchema).safeParse(row.problems);
  const summary = row.summary === null ? null : summarySchema.safeParse(row.summary);
  if (!participants.success || !problems.success || (summary && !summary.success)) return null;
  const mode =
    row.mode === 'with_guardian'
      ? 'with_guardian'
      : row.mode === 'with_educator'
        ? 'with_educator'
        : 'solo';
  const status =
    row.status === 'live'
      ? 'live'
      : row.status === 'ending'
        ? 'ending'
        : row.status === 'ended'
          ? 'ended'
          : row.status === 'failed'
            ? 'failed'
            : 'starting';
  return {
    id: brandId<'tutor_session'>(row.id),
    learnerId: brandId<'user'>(row.learner_id),
    trackId: brandId<'track'>(row.track_id),
    lessonId: brandId<'lesson'>(row.lesson_id),
    lessonTitle: row.lesson_title,
    mode,
    transport: row.transport === 'text' ? 'text' : 'voice',
    status,
    participants: participants.data.map<Participant>((p) => ({
      ...p,
      userId: p.userId ? brandId<'user'>(p.userId) : null,
    })),
    problems: problems.data.map<Problem>((p) => ({ ...p, id: brandId<'problem'>(p.id) })),
    startedAt: row.started_at,
    endedAt: row.ended_at,
    summary: summary ? summary.data : null,
  };
}

function sessionValues(session: TutorSession) {
  const summary: SessionSummary | null = session.summary;
  return {
    learner_id: session.learnerId,
    track_id: session.trackId,
    lesson_id: session.lessonId,
    lesson_title: session.lessonTitle,
    mode: session.mode,
    transport: session.transport,
    status: session.status,
    participants: JSON.stringify(session.participants),
    problems: JSON.stringify(session.problems),
    summary: summary ? JSON.stringify(summary) : null,
    started_at: session.startedAt,
    ended_at: session.endedAt,
  };
}

export function kyselySessionStore(db: Kysely<DB>): SessionStore {
  return {
    createSession: async (session): ReturnType<SessionStore['createSession']> => {
      const saved = await wrapAsync(
        () =>
          db
            .insertInto('tutor_sessions')
            .values({ id: session.id, ...sessionValues(session) })
            .execute(),
        'DB_ERROR'
      );
      if (!saved.ok) return saved;
      return ok();
    },
    getSession: async (id): ReturnType<SessionStore['getSession']> => {
      const row = await wrapAsync(
        () => db.selectFrom('tutor_sessions').selectAll().where('id', '=', id).executeTakeFirst(),
        'DB_ERROR'
      );
      if (!row.ok) return row;
      if (!row.val) return ok(null);
      const session = toSession(row.val);
      if (!session) return err('DB_ERROR', { message: `Session ${id} has an unreadable document` });
      return ok(session);
    },
    updateSession: async (session): ReturnType<SessionStore['updateSession']> => {
      const updated = await wrapAsync(
        () =>
          db
            .updateTable('tutor_sessions')
            .set(sessionValues(session))
            .where('id', '=', session.id)
            .executeTakeFirst(),
        'DB_ERROR'
      );
      if (!updated.ok) return updated;
      if (updated.val.numUpdatedRows === 0n) return err('NOT_FOUND');
      return ok();
    },
    addTurn: async (turn): ReturnType<SessionStore['addTurn']> => {
      const saved = await wrapAsync(
        () =>
          db
            .insertInto('session_turns')
            .values({
              id: turn.id,
              session_id: turn.sessionId,
              at: turn.at,
              speaker: JSON.stringify(turn.speaker),
              text: turn.text,
            })
            .execute(),
        'DB_ERROR'
      );
      if (!saved.ok) return saved;
      return ok();
    },
    listTurns: async (sessionId): ReturnType<SessionStore['listTurns']> => {
      const rows = await wrapAsync(
        () =>
          db
            .selectFrom('session_turns')
            .selectAll()
            .where('session_id', '=', sessionId)
            .orderBy('at')
            .execute(),
        'DB_ERROR'
      );
      if (!rows.ok) return rows;
      const turns: Turn[] = [];
      for (const row of rows.val) {
        const speaker = speakerSchema.safeParse(row.speaker);
        if (!speaker.success)
          return err('DB_ERROR', { message: `Turn ${row.id} has an unreadable speaker` });
        turns.push({
          id: brandId<'turn'>(row.id),
          sessionId,
          at: row.at,
          speaker: speaker.data,
          text: row.text,
        });
      }
      return ok(turns);
    },
    addToolCall: async (call): ReturnType<SessionStore['addToolCall']> => {
      const saved = await wrapAsync(
        () =>
          db
            .insertInto('session_tool_calls')
            .values({
              id: call.id,
              session_id: call.sessionId,
              at: call.at,
              name: call.name,
              args: JSON.stringify(call.args),
              result: JSON.stringify(call.result),
            })
            .execute(),
        'DB_ERROR'
      );
      if (!saved.ok) return saved;
      return ok();
    },
    listToolCalls: async (sessionId): ReturnType<SessionStore['listToolCalls']> => {
      const rows = await wrapAsync(
        () =>
          db
            .selectFrom('session_tool_calls')
            .selectAll()
            .where('session_id', '=', sessionId)
            .orderBy('at')
            .execute(),
        'DB_ERROR'
      );
      if (!rows.ok) return rows;
      const calls: ToolCall[] = [];
      for (const row of rows.val) {
        const args = recordSchema.safeParse(row.args);
        const result = recordSchema.safeParse(row.result);
        if (!args.success || !result.success)
          return err('DB_ERROR', { message: `Tool call ${row.id} has an unreadable document` });
        calls.push({
          id: brandId<'tool_call'>(row.id),
          sessionId,
          at: row.at,
          name: row.name,
          args: args.data,
          result: result.data,
        });
      }
      return ok(calls);
    },
    lastSummary: async (learnerId, trackId): ReturnType<SessionStore['lastSummary']> => {
      const row = await wrapAsync(
        () =>
          db
            .selectFrom('tutor_sessions')
            .select('summary')
            .where('learner_id', '=', learnerId)
            .where('track_id', '=', trackId)
            .where('status', '=', 'ended')
            .orderBy('ended_at', 'desc')
            .executeTakeFirst(),
        'DB_ERROR'
      );
      if (!row.ok) return row;
      if (!row.val || row.val.summary === null) return ok(null);
      const summary = summarySchema.safeParse(row.val.summary);
      return ok(summary.success ? summary.data : null);
    },
  };
}

export const TUTOR_TABLES: ReadonlyArray<string> = [
  'session_tool_calls',
  'session_turns',
  'tutor_sessions',
];
