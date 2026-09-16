/**
 * Environment schemas, one per process, and the loader that applies them.
 *
 * `process.env` is read here and nowhere else (packages/db is the one
 * exception, for DATABASE_URL alone, because the migrate CLI runs without an
 * app around it). Each app calls `loadEnv(<its schema>)` once at boot and
 * threads the typed object down; a module that needs a setting takes it as a
 * parameter. That is what makes every module testable with a literal config
 * and what makes "which variables exist" answerable by reading this file.
 *
 * Zod's `safeParse` never throws, so the loader is a plain Result. The failure
 * message lists every offending variable at once — an operator fixing a
 * deployment should not have to restart three times to learn three names.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { Result } from '@campfhir/safe-functions/types';
import { z } from 'zod';

import type { ConfigErrorTag } from './errors';

/** A blank string counts as unset: `.env` templates ship `KEY=` lines. */
const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().optional()
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.url().optional()
);

const port = z.coerce.number().int().min(1).max(65_535);

export const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
});

export const azureEnvSchema = z.object({
  AZURE_FOUNDRY_ENDPOINT: optionalUrl,
  AZURE_FOUNDRY_API_KEY: optionalString,
  AZURE_CHAT_DEPLOYMENT: z.string().default('gpt-4.1-mini'),
  VOICE_LIVE_MODEL: z.string().default('gpt-realtime'),
  VOICE_LIVE_API_VERSION: z.string().default('2026-04-10'),
  VOICE_LIVE_FAKE: z.preprocess(
    (value) => value === '1' || value === 'true',
    z.boolean().default(false)
  ),
});

const socialProviderSchema = z.object({
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  MICROSOFT_CLIENT_ID: optionalString,
  MICROSOFT_CLIENT_SECRET: optionalString,
  MICROSOFT_TENANT_ID: z.string().default('common'),
  FACEBOOK_CLIENT_ID: optionalString,
  FACEBOOK_CLIENT_SECRET: optionalString,
});

export const webEnvSchema = databaseEnvSchema
  .extend({
    APP_ORIGIN: z.url(),
    AUTH_SECRET: z.string().min(32),
    VOICE_GATEWAY_URL: z.string().default('ws://localhost:8787'),
    AZURE_STORAGE_CONNECTION_STRING: optionalString,
    BLOB_CONTAINER: z.string().default('uploads'),
    CONSOLE_LOG_LEVEL: z.string().default('info'),
    LOG_DB_LEVEL: z.string().default('info'),
  })
  .extend(socialProviderSchema.shape)
  .extend(azureEnvSchema.shape);

export const voiceGatewayEnvSchema = databaseEnvSchema
  .extend({
    VOICE_GATEWAY_PORT: port.default(8787),
    /** Shared with the web app: it signs gateway tickets, the gateway verifies them. */
    AUTH_SECRET: z.string().min(32),
    APP_ORIGIN: z.url().default('http://localhost:3000'),
    CONSOLE_LOG_LEVEL: z.string().default('info'),
    LOG_DB_LEVEL: z.string().default('info'),
  })
  .extend(azureEnvSchema.shape);

export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;
export type VoiceGatewayEnv = z.infer<typeof voiceGatewayEnvSchema>;
export type AzureEnv = z.infer<typeof azureEnvSchema>;

/** A social provider is on only when both halves of its credential are set. */
export interface SocialProviders {
  google: { clientId: string; clientSecret: string } | null;
  microsoft: { clientId: string; clientSecret: string; tenantId: string } | null;
  facebook: { clientId: string; clientSecret: string } | null;
}

export function socialProvidersOf(env: WebEnv): SocialProviders {
  return {
    google:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
        : null,
    microsoft:
      env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET
        ? {
            clientId: env.MICROSOFT_CLIENT_ID,
            clientSecret: env.MICROSOFT_CLIENT_SECRET,
            tenantId: env.MICROSOFT_TENANT_ID,
          }
        : null,
    facebook:
      env.FACEBOOK_CLIENT_ID && env.FACEBOOK_CLIENT_SECRET
        ? { clientId: env.FACEBOOK_CLIENT_ID, clientSecret: env.FACEBOOK_CLIENT_SECRET }
        : null,
  };
}

export type EnvSource = Record<string, string | undefined>;

export function loadEnv<T extends z.ZodType>(
  schema: T,
  source: EnvSource = process.env
): Result<z.output<T>, ConfigErrorTag> {
  const parsed = schema.safeParse(source);
  if (parsed.success) return ok(parsed.data);

  const problems = parsed.error.issues.map((issue) => {
    const name = issue.path.map(String).join('.') || '(root)';
    return `${name}: ${issue.message}`;
  });
  return err('INVALID_ENV', {
    message: `Invalid environment — ${problems.join('; ')}`,
    cause: parsed.error,
  });
}
