/**
 * Only numbered files are migrations; the helpers sharing the directory are
 * never imported as one.
 */

import { describe, expect, it } from 'vitest';

import { isMigrationFile, migrationName } from './migration-files';

describe('isMigrationFile', () => {
  it('accepts NNN-name with a script extension', () => {
    expect(isMigrationFile('001-identity.ts')).toBe(true);
    expect(isMigrationFile('010-seed-6th-grade-math.cjs')).toBe(true);
  });

  it('rejects the runner, the status module and tests', () => {
    expect(isMigrationFile('runner.ts')).toBe(false);
    expect(isMigrationFile('status.test.ts')).toBe(false);
    expect(isMigrationFile('01-too-short.ts')).toBe(false);
  });
});

describe('migrationName', () => {
  it('is the file name without its extension', () => {
    expect(migrationName('001-identity.ts')).toBe('001-identity');
  });
});
