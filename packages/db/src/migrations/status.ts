/**
 * Whether the database schema is as new as the code expecting it.
 *
 * Migrations run as a deliberate, separate step — the migrate image sits
 * behind a compose profile so that starting the app never applies them as a
 * side effect. The gap that leaves is an operator pulling new images and
 * starting the app without running it. So the app checks at startup and
 * reports it on /api/health, where a deploy or a healthcheck can gate on it.
 * It does not migrate anything and does not refuse to boot.
 *
 * The expected set is a list in code rather than a read of the directory:
 * the directory is not in the server bundle. The list cannot drift unnoticed
 * — status.test.ts compares it against the files on disk.
 */

import { err, ok, wrapAsync } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import { sql } from 'kysely';

import { getDatabase } from '../client';

/**
 * Every migration this build expects, in order. Add a migration, add it
 * here; the test guards the pairing.
 */
export const EXPECTED_MIGRATIONS: ReadonlyArray<string> = [];

export type MigrationStatusErrorTag = 'MIGRATION_STATUS_ERROR';

export interface MigrationStatus {
  /** Expected by this build, absent from this database. */
  pending: string[];
  applied: number;
}

/**
 * A failure here means UNKNOWN, not up to date: the caller (the health route)
 * must report degraded, never healthy.
 */
export async function getMigrationStatus(): AsyncResult<MigrationStatus, MigrationStatusErrorTag> {
  const dbResult = getDatabase();
  if (!dbResult.ok) {
    return err('MIGRATION_STATUS_ERROR', { message: 'Database unavailable' });
  }

  // Kysely's own ledger. A fresh database has no such table, which means
  // nothing has been applied rather than that the check failed.
  const rows = await wrapAsync(
    () => sql<{ name: string }>`SELECT name FROM kysely_migration`.execute(dbResult.val),
    'MIGRATION_STATUS_ERROR'
  );
  if (!rows.ok) {
    // 42P01: the ledger table does not exist. Nothing has ever been migrated.
    if (rows.err.message?.includes('kysely_migration')) {
      return ok({ pending: [...EXPECTED_MIGRATIONS], applied: 0 });
    }
    return rows;
  }

  const applied = new Set(rows.val.rows.map((row) => row.name));
  return ok({
    pending: EXPECTED_MIGRATIONS.filter((name) => !applied.has(name)),
    applied: applied.size,
  });
}

/** The one-line instruction an operator needs, kept next to the check. */
export const MIGRATION_COMMAND =
  'pnpm db:migrate  (or: docker compose -f docker-compose.yaml run --rm migrate)';
