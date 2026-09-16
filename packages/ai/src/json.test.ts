/**
 * Structured output: valid JSON that matches the schema is returned typed;
 * a code fence is tolerated; anything else is MALFORMED_OUTPUT rather than
 * an exception.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { completeJson } from './json';
import { scriptedLlm } from './testing';

const schema = z.object({ score: z.number().min(0).max(1), feedback: z.string() });
const request = { system: 'grade', messages: [], maxTokens: 100 };

describe('completeJson', () => {
  it('parses and validates the model output', async () => {
    const llm = scriptedLlm(['{"score": 0.5, "feedback": "half right"}']);

    const result = await completeJson(llm, request, schema);

    expect(result.ok && result.val.value).toEqual({ score: 0.5, feedback: 'half right' });
    expect(llm.requests[0]?.json).toBe(true);
  });

  it('strips a code fence', async () => {
    const llm = scriptedLlm(['```json\n{"score": 1, "feedback": "yes"}\n```']);

    const result = await completeJson(llm, request, schema);

    expect(result.ok && result.val.value.score).toBe(1);
  });

  it('tags non-JSON and schema mismatches as MALFORMED_OUTPUT', async () => {
    const notJson = await completeJson(scriptedLlm(['nope']), request, schema);
    const wrongShape = await completeJson(scriptedLlm(['{"score": 5}']), request, schema);

    expect(!notJson.ok && notJson.err.type).toBe('MALFORMED_OUTPUT');
    expect(!wrongShape.ok && wrongShape.err.type).toBe('MALFORMED_OUTPUT');
    expect(!wrongShape.ok && wrongShape.err.message).toContain('score');
  });

  it('passes provider errors through', async () => {
    const result = await completeJson(scriptedLlm([]), request, schema);

    expect(!result.ok && result.err.type).toBe('provider_error');
  });
});
