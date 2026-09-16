/**
 * EXPECTED_MIGRATIONS mirrors the files on disk, in apply order, and the
 * status check distinguishes "no database" from "up to date".
 */

import { readdirSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import { isMigrationFile, migrationName } from './migration-files';

vi.mock('../client', () => ({
  getDatabase: () => ({ ok: false, err: { type: 'DB_INIT_ERROR' } }),
}));

const { EXPECTED_MIGRATIONS, getMigrationStatus } = await import('./status');

function migrationFilesOnDisk(): string[] {
  return readdirSync(import.meta.dirname)
    .filter((file) => file.endsWith('.ts') && isMigrationFile(file))
    .map(migrationName)
    .sort();
}

describe('EXPECTED_MIGRATIONS', () => {
  // Without this, adding 013 and forgetting to list it makes the status check
  // report a schema as up to date while the code expects a column that is not
  // there — the exact failure the status module exists to catch.
  it('lists every migration file, and only those', () => {
    expect([...EXPECTED_MIGRATIONS].sort()).toEqual(migrationFilesOnDisk());
  });

  it('is in the order the files apply in', () => {
    expect([...EXPECTED_MIGRATIONS]).toEqual([...EXPECTED_MIGRATIONS].sort());
  });
});

describe('getMigrationStatus', () => {
  it('reports the check as failed when there is no database', async () => {
    // Distinguished from "up to date": an unknown schema is not a known-good one.
    const status = await getMigrationStatus();

    expect(status.ok).toBe(false);
    expect(!status.ok && status.err).toEqual({
      type: 'MIGRATION_STATUS_ERROR',
      message: 'Database unavailable',
    });
  });
});
