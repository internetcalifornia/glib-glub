/**
 * The web app's logger, one per process (globalThis, for the same reason as
 * lib/env.ts). Console from the first line; Postgres once instrumentation
 * has a database to hand it.
 */

import { getDatabase } from '@glib-glub/db';
import { attachPostgresAdapter, createAppLogger, type AppLogger } from '@glib-glub/logging';
import type { Result } from '@campfhir/safe-functions/types';

import packageJson from '../package.json' with { type: 'json' };
import { getEnv } from './env';

interface LoggerSlot {
  __glibGlubLogger?: AppLogger;
  __glibGlubLoggerAttached?: boolean;
}

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- globalThis has no declared slot for our state; this is the documented split-singleton guard
const slot = globalThis as unknown as LoggerSlot;

function buildLogger(): AppLogger {
  const env = getEnv();
  return createAppLogger({
    application: packageJson.name,
    version: packageJson.version,
    // Baked into the image by the Dockerfile; the one setting read outside
    // packages/config because it describes the build, not the deployment.
    commit: process.env.GIT_COMMIT,
    consoleLevel: env.ok ? env.val.CONSOLE_LOG_LEVEL : 'info',
  });
}

export const logger: AppLogger = (slot.__glibGlubLogger ??= buildLogger());

/** Called once at boot by instrumentation.ts; idempotent across graphs. */
export function attachPersistentLogging(): Result<
  void,
  'INVALID_ENV' | 'DB_INIT_ERROR' | 'LOG_ADAPTER_ERROR'
> {
  if (slot.__glibGlubLoggerAttached) return { ok: true };
  const env = getEnv();
  if (!env.ok) return env;
  const db = getDatabase();
  if (!db.ok) return db;
  const attached = attachPostgresAdapter(logger, db.val, env.val.LOG_DB_LEVEL);
  if (!attached.ok) return attached;
  slot.__glibGlubLoggerAttached = true;
  return { ok: true };
}
