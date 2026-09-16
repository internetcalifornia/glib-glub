/**
 * The Azure adapter's wire contract, against a fetch stub: the URL and
 * headers it sends, how it reads a reply, and how HTTP failures become
 * error kinds — a dead key is `auth` even when a gateway says 503.
 */

import { describe, expect, it } from 'vitest';

import { azureOpenAiProvider } from './azure-openai';
import type { LlmRequest } from './contract';

const request: LlmRequest = {
  system: 'You grade answers.',
  messages: [{ role: 'user', content: '2+2?' }],
  maxTokens: 50,
};

function stubFetch(status: number, body: unknown, capture?: { url?: string; init?: RequestInit }) {
  return async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    if (capture) {
      capture.url = String(url);
      capture.init = init;
    }
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  };
}

describe('azureOpenAiProvider', () => {
  it('posts to the v1 chat-completions route with both credential headers', async () => {
    const capture: { url?: string; init?: RequestInit } = {};
    const provider = azureOpenAiProvider({
      endpoint: 'https://res.services.ai.azure.com/',
      deployment: 'gpt-4.1-mini',
      apiKey: 'k',
      fetch: stubFetch(
        200,
        {
          choices: [{ message: { content: '4' } }],
          usage: { prompt_tokens: 3, completion_tokens: 1 },
          model: 'gpt-4.1-mini',
        },
        capture
      ),
    });

    const result = await provider.complete(request);

    expect(capture.url).toBe('https://res.services.ai.azure.com/openai/v1/chat/completions');
    const headers = new Headers(capture.init?.headers);
    expect(headers.get('authorization')).toBe('Bearer k');
    expect(headers.get('api-key')).toBe('k');
    const body = JSON.parse(String(capture.init?.body));
    expect(body.model).toBe('gpt-4.1-mini');
    expect(body.max_completion_tokens).toBe(50);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'You grade answers.' });
    expect(result).toEqual({
      ok: true,
      val: {
        text: '4',
        stopReason: 'end_turn',
        usage: { inputTokens: 3, outputTokens: 1 },
        model: 'gpt-4.1-mini',
      },
    });
  });

  it('asks for JSON mode when the request wants JSON', async () => {
    const capture: { init?: RequestInit } = {};
    const provider = azureOpenAiProvider({
      endpoint: 'https://res.openai.azure.com',
      deployment: 'd',
      apiKey: 'k',
      fetch: stubFetch(200, { choices: [{ message: { content: '{}' } }] }, capture),
    });

    void (await provider.complete({ ...request, json: true }));

    expect(JSON.parse(String(capture.init?.body)).response_format).toEqual({ type: 'json_object' });
  });

  it('classifies a rejected credential as auth even behind a 503', async () => {
    const provider = azureOpenAiProvider({
      endpoint: 'https://res.openai.azure.com',
      deployment: 'd',
      apiKey: 'k',
      fetch: stubFetch(503, 'credential validation failed'),
    });

    const result = await provider.complete(request);

    expect(!result.ok && result.err.type).toBe('auth');
  });

  it('classifies 429 as rate_limit and 404 as invalid_request', async () => {
    const limited = azureOpenAiProvider({
      endpoint: 'https://x',
      deployment: 'd',
      apiKey: 'k',
      fetch: stubFetch(429, '{}'),
    });
    const missing = azureOpenAiProvider({
      endpoint: 'https://x',
      deployment: 'd',
      apiKey: 'k',
      fetch: stubFetch(404, '{}'),
    });

    const a = await limited.complete(request);
    const b = await missing.complete(request);

    expect(!a.ok && a.err.type).toBe('rate_limit');
    expect(!b.ok && b.err.type).toBe('invalid_request');
  });

  it('refuses to call without a credential', async () => {
    const provider = azureOpenAiProvider({
      endpoint: 'https://x',
      deployment: 'd',
      fetch: stubFetch(200, {}),
    });

    const result = await provider.complete(request);

    expect(!result.ok && result.err.type).toBe('auth');
  });
});
