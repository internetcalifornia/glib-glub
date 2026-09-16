/**
 * The migrate CLI: `pnpm --filter @glib-glub/db migrate`, or the `migrate`
 * Docker stage. Resolves the migrations directory relative to this script,
 * not the caller's cwd, so it works from anywhere in the workspace; the CJS
 * bundle sets MIGRATIONS_DIR instead (import.meta.url is undefined there).
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { closeDatabase } from '../src/client';
import { runMigrations } from '../src/migrations/runner';

const migrationsDir = process.env.MIGRATIONS_DIR
  ? resolve(process.env.MIGRATIONS_DIR)
  : resolve(dirname(fileURLToPath(import.meta.url)), '../src/migrations');

const result = await runMigrations(migrationsDir);
void (await closeDatabase());
if (!result.ok) {
  console.error(`Migration failed: ${result.err.message ?? result.err.type}`);
  process.exit(1);
}
process.exit(0);
