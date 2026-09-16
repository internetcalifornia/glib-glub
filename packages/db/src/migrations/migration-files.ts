/**
 * Which files in the migrations directory are migrations. The directory also
 * holds the runner, the status module, and tests — importing those as
 * migrations detonates (a test references vitest at module scope), so both the
 * runtime provider and the production bundle build filter with this.
 */

export function isMigrationFile(name: string): boolean {
  return /^\d{3}-.*\.(ts|js|mjs|cjs)$/.test(name);
}

/** The name Kysely records in its ledger: the file name without extension. */
export function migrationName(file: string): string {
  return file.replace(/\.[^.]+$/, '');
}
