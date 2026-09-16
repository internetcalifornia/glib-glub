/**
 * Applies pending migrations, in file order, from a directory.
 *
 * Loads only numbered files (001-init.ts, …). Kysely's FileMigrationProvider
 * imports EVERY file in the folder, which breaks on the colocated helpers the
 * moment migrations run from source instead of the compiled bundle (whose
 * build step applies the same filter, see scripts/build-migrations.js).
 *
 * Not re-exported from the package barrel: it touches fs and process.cwd,
 * which poisons the barrel for Next's edge-runtime analysis. The migrate CLI
 * imports this file directly.
 */

import { err, ok, wrapAsync } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import { Migrator, type Migration } from 'kysely/migration';
import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { getDatabase } from '../client';
import { isMigrationFile, migrationName } from './migration-files';

export type MigrationErrorTag = 'MIGRATION_ERROR';

/** The numbered migration modules in a folder, keyed by ledger name. */
async function loadMigrations(
  folder: string
): AsyncResult<Record<string, Migration>, MigrationErrorTag> {
  const listing = await wrapAsync(() => fs.readdir(folder), 'MIGRATION_ERROR');
  if (!listing.ok) return listing;

  const migrations: Record<string, Migration> = {};
  for (const file of listing.val.filter(isMigrationFile).sort()) {
    const loaded = await wrapAsync(
      (): Promise<Migration> => import(pathToFileURL(join(folder, file)).href),
      'MIGRATION_ERROR'
    );
    if (!loaded.ok) return loaded;
    migrations[migrationName(file)] = loaded.val;
  }
  return ok(migrations);
}

export interface MigrationReport {
  applied: string[];
}

export async function runMigrations(
  migrationsDir?: string,
  log: (line: string) => void = console.log
): AsyncResult<MigrationReport, MigrationErrorTag> {
  const dbResult = getDatabase();
  if (!dbResult.ok) return err('MIGRATION_ERROR', { message: dbResult.err.message });

  const migrations = await loadMigrations(
    migrationsDir ?? resolve(process.cwd(), 'src/migrations')
  );
  if (!migrations.ok) return migrations;

  const migrator = new Migrator({
    db: dbResult.val,
    // Resolved up front so the provider never fails inside Kysely.
    provider: { getMigrations: () => Promise.resolve(migrations.val) },
  });

  log('[migrations] running…');
  const outcome = await wrapAsync(() => migrator.migrateToLatest(), 'MIGRATION_ERROR');
  if (!outcome.ok) return outcome;

  const { error, results } = outcome.val;
  const applied: string[] = [];
  for (const result of results ?? []) {
    if (result.status === 'Success') {
      applied.push(result.migrationName);
      log(`[migrations] ✓ ${result.migrationName}`);
    } else {
      log(`[migrations] ✗ ${result.migrationName}: ${result.status}`);
    }
  }
  if (error) {
    return err('MIGRATION_ERROR', {
      message: error instanceof Error ? error.message : String(error),
      cause: error,
    });
  }
  log(applied.length === 0 ? '[migrations] nothing to apply' : '[migrations] done');
  return ok({ applied });
}
