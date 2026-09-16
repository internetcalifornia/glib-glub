/**
 * The loader's contract beyond the feature file: defaults fill in, blank
 * strings count as unset, and every problem is reported in one message.
 */

import { describe, expect, it } from 'vitest';

import { loadEnv, voiceGatewayEnvSchema, webEnvSchema } from './env';

const base = {
  DATABASE_URL: 'postgres://u:p@localhost/db',
  APP_ORIGIN: 'http://localhost:3000',
  AUTH_SECRET: '0123456789abcdef0123456789abcdef',
};

describe('loadEnv', () => {
  it('fills defaults for optional settings', () => {
    const result = loadEnv(webEnvSchema, base);

    expect(result.ok && result.val.AZURE_CHAT_DEPLOYMENT).toBe('gpt-4.1-mini');
    expect(result.ok && result.val.VOICE_LIVE_MODEL).toBe('gpt-realtime');
    expect(result.ok && result.val.BLOB_CONTAINER).toBe('uploads');
  });

  it('treats a blank value as unset — .env templates ship KEY= lines', () => {
    const result = loadEnv(webEnvSchema, { ...base, GOOGLE_CLIENT_ID: '   ' });

    expect(result.ok && result.val.GOOGLE_CLIENT_ID).toBeUndefined();
  });

  it('names every offending variable in one message, not just the first', () => {
    const result = loadEnv(webEnvSchema, { DATABASE_URL: '', APP_ORIGIN: 'nope' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.err.message).toContain('DATABASE_URL');
    expect(result.err.message).toContain('APP_ORIGIN');
    expect(result.err.message).toContain('AUTH_SECRET');
  });

  it('coerces the gateway port from the string the environment carries', () => {
    const result = loadEnv(voiceGatewayEnvSchema, {
      DATABASE_URL: 'postgres://x',
      VOICE_GATEWAY_PORT: '9000',
    });

    expect(result.ok && result.val.VOICE_GATEWAY_PORT).toBe(9000);
  });
});
