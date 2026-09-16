/**
 * Test doubles for the AI ports. `scriptedLlm` answers each call with the
 * next scripted text (and records the requests), so a test can assert on
 * the prompt a module built as well as on what it did with the answer.
 * `keywordSafety` blocks text containing a marker, so a scenario can say
 * "unsafe content" without the test knowing what Azure would flag.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';

import type { LlmProvider, LlmRequest, LlmResponse } from './contract';
import type { ContentSafety, SafetyVerdict } from './content-safety';

export interface ScriptedLlm extends LlmProvider {
  requests: LlmRequest[];
  /** Push more answers after construction. */
  answer(text: string): void;
}

export function scriptedLlm(answers: string[] = []): ScriptedLlm {
  const queue = [...answers];
  const requests: LlmRequest[] = [];
  return {
    requests,
    answer: (text) => {
      queue.push(text);
    },
    async complete(request) {
      requests.push(request);
      const text = queue.shift();
      if (text === undefined) {
        return err('provider_error', { message: 'scriptedLlm ran out of answers' });
      }
      const response: LlmResponse = {
        text,
        stopReason: 'end_turn',
        usage: { inputTokens: request.system.length, outputTokens: text.length },
        model: 'scripted',
      };
      return ok(response);
    },
  };
}

/** Answers every call by applying `fn` to the last user message. */
export function functionLlm(
  fn: (lastUserMessage: string, request: LlmRequest) => string
): LlmProvider {
  return {
    async complete(request) {
      const last = [...request.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
      const text = fn(last, request);
      return ok({
        text,
        stopReason: 'end_turn',
        usage: { inputTokens: 0, outputTokens: 0 },
        model: 'fn',
      });
    },
  };
}

export const allowAllSafety: ContentSafety = {
  screenText: async (): ReturnType<ContentSafety['screenText']> => ok({ allowed: true }),
};

export function keywordSafety(marker = '[unsafe content]'): ContentSafety {
  const blocked: SafetyVerdict = {
    allowed: false,
    categories: [{ category: 'Violence', severity: 6 }],
  };
  const allowed: SafetyVerdict = { allowed: true };
  return {
    screenText: async (text): ReturnType<ContentSafety['screenText']> =>
      ok(text.includes(marker) ? blocked : allowed),
  };
}
