/**
 * Structured output: ask the model for JSON, parse it, validate it with a
 * Zod schema. Every AI-backed decision in the platform (a grade, a summary,
 * a generated quiz) goes through this so a malformed answer is a tagged
 * error the caller handles, never a thrown SyntaxError three frames up.
 *
 * Models occasionally wrap JSON in a code fence even in JSON mode; the
 * fence is stripped before parsing.
 */

import { err, ok, wrap } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import type { z } from 'zod';

import type { LlmErrorKind, LlmProvider, LlmRequest, LlmUsage } from './contract';

export type StructuredErrorTag = LlmErrorKind | 'MALFORMED_OUTPUT';

export interface Structured<T> {
  value: T;
  usage: LlmUsage;
  model: string;
}

function stripFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced?.[1] ?? trimmed;
}

export async function completeJson<T extends z.ZodType>(
  provider: LlmProvider,
  request: Omit<LlmRequest, 'json'>,
  schema: T
): AsyncResult<Structured<z.output<T>>, StructuredErrorTag> {
  const response = await provider.complete({ ...request, json: true });
  if (!response.ok) return response;

  const parsed = wrap((): unknown => JSON.parse(stripFence(response.val.text)), 'MALFORMED_OUTPUT');
  if (!parsed.ok) {
    return err('MALFORMED_OUTPUT', {
      message: 'Model output was not JSON',
      cause: parsed.err.cause,
    });
  }
  const validated = schema.safeParse(parsed.val);
  if (!validated.success) {
    return err('MALFORMED_OUTPUT', {
      message: `Model output did not match the schema: ${validated.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}`,
      cause: validated.error,
    });
  }
  return ok({ value: validated.data, usage: response.val.usage, model: response.val.model });
}
