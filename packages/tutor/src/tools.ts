/**
 * The tutor's tools: declared once in the JSON-schema shape Voice Live's
 * function calling expects, dispatched here against the session. Every
 * call is recorded as a ToolCall, and the hint ladder lives inside
 * `tutor_record_attempt` — the model asks, this decides.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import { newId, type TutorSessionId, type UserId } from '@glib-glub/core';
import { z } from 'zod';

import { recordAttempt } from './hint-ladder';
import type { TutorDeps } from './ports';
import { endSession } from './session';
import type { Problem, ToolCall, TutorSession } from './types';

export interface ToolDefinition {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const TOOL_DEFINITIONS: ReadonlyArray<ToolDefinition> = [
  {
    type: 'function',
    name: 'tutor_get_lesson_context',
    description:
      "Today's lesson: title, objectives and your teaching notes. Call once near the start if you need to re-read them.",
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    type: 'function',
    name: 'tutor_present_problem',
    description:
      'Register a problem you are about to pose, with its expected answer, so attempts can be tracked. Call before asking it.',
    parameters: {
      type: 'object',
      properties: {
        problem: { type: 'string', description: 'The problem exactly as you will pose it' },
        expectedAnswer: {
          type: 'string',
          description: 'The answer you will accept (numbers or a short phrase)',
        },
      },
      required: ['problem', 'expectedAnswer'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'tutor_record_attempt',
    description:
      "Record the learner's answer to the open problem. Returns whether it was correct and the ONE move you must make next.",
    parameters: {
      type: 'object',
      properties: {
        attempt: { type: 'string', description: "The learner's answer, as they said it" },
      },
      required: ['attempt'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'tutor_note_misconception',
    description: 'Note a misconception you observed, in one sentence, for the session summary.',
    parameters: {
      type: 'object',
      properties: { misconception: { type: 'string' } },
      required: ['misconception'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'tutor_add_flashcard',
    description:
      "Add a flashcard to the learner's deck for this lesson: a short prompt on the front, the answer on the back.",
    parameters: {
      type: 'object',
      properties: { front: { type: 'string' }, back: { type: 'string' } },
      required: ['front', 'back'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'tutor_end_session',
    description:
      'End the session when the lesson is done or the learner wants to stop. Say goodbye first.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
];

export const TOOL_NAMES = TOOL_DEFINITIONS.map((tool) => tool.name);

const presentArgs = z.object({ problem: z.string().min(1), expectedAnswer: z.string().min(1) });
const attemptArgs = z.object({ attempt: z.string() });
const misconceptionArgs = z.object({ misconception: z.string().min(1) });
const flashcardArgs = z.object({ front: z.string().min(1), back: z.string().min(1) });

export type ToolErrorTag =
  | 'UNKNOWN_TOOL'
  | 'VALIDATION_ERROR'
  | 'NO_OPEN_PROBLEM'
  | 'SESSION_NOT_LIVE'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'SUMMARY_FAILED'
  | 'DB_ERROR';

export async function dispatchTool(
  deps: TutorDeps,
  sessionId: TutorSessionId,
  name: string,
  args: Record<string, unknown>
): AsyncResult<Record<string, unknown>, ToolErrorTag> {
  const loaded = await deps.store.getSession(sessionId);
  if (!loaded.ok) return loaded;
  if (!loaded.val) return err('NOT_FOUND', { message: 'No such session' });
  const session = loaded.val;
  if (session.status !== 'live')
    return err('SESSION_NOT_LIVE', { message: `Session is ${session.status}` });

  const outcome = await run(deps, session, name, args);
  if (!outcome.ok) return outcome;

  const call: ToolCall = {
    id: newId<'tool_call'>(),
    sessionId,
    at: deps.clock.now(),
    name,
    args,
    result: outcome.val.result,
  };
  const recorded = await deps.store.addToolCall(call);
  if (!recorded.ok) return recorded;
  if (outcome.val.session !== session) {
    const saved = await deps.store.updateSession(outcome.val.session);
    if (!saved.ok) return saved;
  }
  return ok(outcome.val.result);
}

interface RunOutcome {
  result: Record<string, unknown>;
  session: TutorSession;
}

async function run(
  deps: TutorDeps,
  session: TutorSession,
  name: string,
  args: Record<string, unknown>
): AsyncResult<RunOutcome, ToolErrorTag> {
  switch (name) {
    case 'tutor_get_lesson_context': {
      const lesson = await deps.lessons.nextLesson(session.learnerId, session.trackId);
      if (!lesson.ok) {
        // "Nothing due" is a scheduling fact, not a tool failure: the model just hears there is no lesson.
        return err(lesson.err.type === 'NOTHING_DUE' ? 'NOT_FOUND' : lesson.err.type, {
          message: lesson.err.message,
        });
      }
      return ok({
        result: {
          title: lesson.val.lesson.title,
          objectives: [...lesson.val.lesson.objectives],
          notes: lesson.val.lesson.notes,
        },
        session,
      });
    }
    case 'tutor_present_problem': {
      const parsed = presentArgs.safeParse(args);
      if (!parsed.success)
        return err('VALIDATION_ERROR', { message: 'problem and expectedAnswer are required' });
      // Presenting a new problem closes any open one.
      const closed = session.problems.map((problem) => ({ ...problem, closed: true }));
      const problem: Problem = {
        id: newId<'problem'>(),
        text: parsed.data.problem,
        expectedAnswer: parsed.data.expectedAnswer,
        attempts: [],
        solved: false,
        closed: false,
      };
      return ok({
        result: { problemId: problem.id, registered: true },
        session: { ...session, problems: [...closed, problem] },
      });
    }
    case 'tutor_record_attempt': {
      const parsed = attemptArgs.safeParse(args);
      if (!parsed.success) return err('VALIDATION_ERROR', { message: 'attempt is required' });
      const open = session.problems.find((problem) => !problem.closed);
      if (!open)
        return err('NO_OPEN_PROBLEM', { message: 'Present a problem before recording an attempt' });
      const outcome = recordAttempt(open, parsed.data.attempt);
      if (!outcome.ok) return outcome;
      const problems = session.problems.map((problem) =>
        problem.id === open.id ? outcome.val.problem : problem
      );
      return ok({
        result: {
          correct: outcome.val.correct,
          nextMove: outcome.val.nextMove,
          attempts: outcome.val.problem.attempts.length,
        },
        session: { ...session, problems },
      });
    }
    case 'tutor_note_misconception': {
      const parsed = misconceptionArgs.safeParse(args);
      if (!parsed.success) return err('VALIDATION_ERROR', { message: 'misconception is required' });
      return ok({ result: { noted: true }, session });
    }
    case 'tutor_add_flashcard': {
      const parsed = flashcardArgs.safeParse(args);
      if (!parsed.success)
        return err('VALIDATION_ERROR', { message: 'front and back are required' });
      const added = await deps.flashcards.addCard({
        learnerId: session.learnerId,
        lessonId: session.lessonId,
        lessonTitle: session.lessonTitle,
        front: parsed.data.front,
        back: parsed.data.back,
        now: deps.clock.now(),
      });
      if (!added.ok) return added;
      return ok({ result: { added: true }, session });
    }
    case 'tutor_end_session': {
      // The tutor ends on the learner's behalf.
      const ended = await endSession(deps, { actorId: session.learnerId, sessionId: session.id });
      if (!ended.ok) return ended;
      return ok({
        result: { ended: true, summary: ended.val.summary?.narrative ?? '' },
        session: ended.val,
      });
    }
    default:
      return err('UNKNOWN_TOOL', { message: `No tool named ${name}` });
  }
}

export type { UserId };
