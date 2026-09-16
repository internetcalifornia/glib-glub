/**
 * @glib-glub/db — the single Postgres instance, shared by every process.
 *
 * Exposes the Kysely client, the generated schema types, and the migration
 * status. The migration runner is deliberately NOT re-exported: it touches fs
 * and process.cwd, which poisons this barrel for Next's edge-runtime analysis.
 * The migrate CLI imports ./migrations/runner directly.
 */

export { closeDatabase, getDatabase, getPool, initDatabase } from './client';
export type { DbCloseErrorTag, DbErrorTag } from './client';
export type * from './db.types';
export { EXPECTED_MIGRATIONS, getMigrationStatus, MIGRATION_COMMAND } from './migrations/status';
export type { MigrationStatus, MigrationStatusErrorTag } from './migrations/status';
