/**
 * The application logger: @campfhir/bored-logs with the console adapter
 * attached at construction and the Postgres adapter attached once a database
 * is available.
 *
 * Identity (application, version, commit) rides on every record as global
 * attributes — that is what lets a row in the logs table say which build of
 * which process produced it, and what the `glib-glub/log-template-fields`
 * lint rule lets a message template name without the call site repeating.
 * They are duplicated into the `attributes` bag because the console adapter
 * only prints `record.attrs`, never the reserved application/version options.
 *
 * bored-logs' own inlined `Result` (an `Error` subclass with the tag in
 * `.message`) never leaves this module: everything here returns the
 * safe-functions shape.
 */

import { ConsoleAdapter, createLogger, type Logger } from '@campfhir/bored-logs';
import { PostgresAdapter } from '@campfhir/bored-logs/adapters/psql';
import { ok, wrap } from '@campfhir/safe-functions/helpers';
import type { Result } from '@campfhir/safe-functions/types';
import type { Kysely } from 'kysely';

export type LoggingErrorTag = 'LOG_ADAPTER_ERROR';

export interface AppLoggerOptions {
  /** The workspace package name of the process (`web`, `voice-gateway`). */
  application: string;
  version: string;
  /** Git commit the build was made from; absent in bare local runs. */
  commit?: string;
  /** Minimum level printed to the console. Defaults to `info`. */
  consoleLevel?: string;
}

export type AppLogger = Logger;

export function createAppLogger(options: AppLoggerOptions): AppLogger {
  const commit = options.commit ?? 'dev';
  const version = options.commit ? `${options.version}+${options.commit}` : options.version;

  const logger = createLogger({
    application: options.application,
    version,
    attributes: { application: options.application, version, commit },
  });

  logger.addAdapter(
    new ConsoleAdapter({
      level: options.consoleLevel ?? 'info',
      showTimestamp: true,
      showLevel: true,
      maskSecure: process.env.NODE_ENV === 'production',
    })
  );

  return logger;
}

/**
 * Persist records at `level` and above to the shared database's log tables
 * (created by the `logs` migration in @glib-glub/db). Called once at boot by
 * each process; a failure is reported so a process that can only log to
 * stdout still starts.
 */
export function attachPostgresAdapter(
  logger: AppLogger,
  db: Kysely<unknown>,
  level = 'info'
): Result<void, LoggingErrorTag> {
  const attached = wrap(() => {
    logger.addAdapter(
      new PostgresAdapter({
        // bored-logs types its handle as Kysely<any>; ours is typed to our
        // schema and the adapter only touches its own tables.
        db,
        level,
        onWarning: (warning) => {
          logger.warn('log adapter warning: {warningType}', {
            component: 'logging/adapter',
            warningType: warning.type,
          });
        },
      })
    );
  }, 'LOG_ADAPTER_ERROR');
  if (!attached.ok) return attached;
  return ok();
}
