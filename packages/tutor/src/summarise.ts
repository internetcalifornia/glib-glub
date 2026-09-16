/**
 * What a session leaves behind. `summaryFromRecord` derives the facts —
 * problems presented and solved, misconceptions noted, minutes — from the
 * tool calls alone, so it is exact and needs no model. `llmSummariser`
 * adds a narrative and next steps from the transcript through structured
 * output and falls back to the record if the model fails: a session must
 * never end without a summary.
 */

import { ok } from '@campfhir/safe-functions/helpers';
import { completeJson, type LlmProvider } from '@glib-glub/ai';
import { z } from 'zod';

import type { SessionSummariser, SummaryInput } from './ports';
import type { SessionSummary } from './types';

export function summaryFromRecord(input: SummaryInput): SessionSummary {
  const { session, toolCalls, now } = input;
  const misconceptions = toolCalls
    .filter((call) => call.name === 'tutor_note_misconception')
    .map((call) => String(call.args.misconception ?? ''))
    .filter(Boolean);
  const presented = session.problems.length;
  const solved = session.problems.filter((problem) => problem.solved).length;
  const minutes = Math.max(1, Math.round((now.getTime() - session.startedAt.getTime()) / 60_000));
  const nextSteps = misconceptions.length
    ? misconceptions.map((m) => `Revisit: ${m}`)
    : [`Continue past "${session.lessonTitle}"`];
  const narrative = `Covered "${session.lessonTitle}": ${solved} of ${presented} problems solved in ${minutes} minutes.${misconceptions.length ? ` Misconceptions: ${misconceptions.join('; ')}.` : ''}`;
  return {
    covered: [session.lessonTitle],
    problemsPresented: presented,
    problemsSolved: solved,
    misconceptions,
    nextSteps,
    minutes,
    narrative,
  };
}

export const recordSummariser: SessionSummariser = {
  summarise: async (input): ReturnType<SessionSummariser['summarise']> =>
    ok(summaryFromRecord(input)),
};

const narrativeSchema = z.object({
  narrative: z.string().min(1).max(1_200),
  nextSteps: z.array(z.string().min(1).max(200)).max(5),
});

export const SUMMARY_SYSTEM_PROMPT = `You summarise one tutoring session for the tutor who will run the next one. Answer with JSON: {"narrative": string (2–4 sentences: what was covered, how the learner reasoned, what to watch for), "nextSteps": string[]}. Be specific and kind. Never quote the learner at length.`;

export function llmSummariser(llm: LlmProvider): SessionSummariser {
  return {
    summarise: async (input): ReturnType<SessionSummariser['summarise']> => {
      const base = summaryFromRecord(input);
      const transcript = input.turns
        .map(
          (turn) =>
            `${turn.speaker.kind === 'tutor' ? 'Tutor' : turn.speaker.kind === 'participant' ? turn.speaker.participantId : 'Unknown'}: ${turn.text}`
        )
        .join('\n')
        .slice(0, 12_000);
      const result = await completeJson(
        llm,
        {
          system: SUMMARY_SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Lesson: ${input.session.lessonTitle}\nFacts: ${base.narrative}\n\nTranscript:\n${transcript}`,
            },
          ],
          maxTokens: 500,
          temperature: 0.2,
        },
        narrativeSchema
      );
      if (!result.ok) return ok(base);
      return ok({
        ...base,
        narrative: result.val.value.narrative,
        nextSteps: result.val.value.nextSteps.length ? result.val.value.nextSteps : base.nextSteps,
      });
    },
  };
}
