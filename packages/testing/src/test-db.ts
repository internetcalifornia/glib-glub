/**
 * The Postgres handle integration tests share.
 *
 * One database, migrated ahead of the run (CI runs `pnpm db:migrate`; a
 * developer does the same once). Tests isolate themselves by clearing the
 * tables they touch in `beforeEach`, which is why the integration tier runs
 * files serially (vitest.shared.config.ts). Per-test schemas were considered
 * and rejected: they need the migrations re-run per file, and the migrations
 * are the slow part.
 *
 * `clear` deletes rather than truncates. `TRUNCATE … CASCADE` follows every
 * foreign key OUT of the named tables — clearing `user` truncated `tracks`
 * through `authored_by` and wiped the seeded catalogue (Decision #7) for the
 * whole run. Ordered deletes touch exactly the tables named; callers list
 * children before parents.
 *
 * Generic over the schema type so this package does not depend on
 * @glib-glub/db (which depends on this package for its own tests).
 */

import { err, ok, wrapAsync } from '@campfhir/safe-functions/helpers';
import type { AsyncResult, Result } from '@campfhir/safe-functions/types';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';

import { TEST_DATABASE_URL } from './describe-live';

export type TestDbErrorTag = 'NO_TEST_DATABASE' | 'TEST_DB_ERROR';

export interface TestDb<Schema> {
  db: Kysely<Schema>;
  /** Empty the given tables, in the order given (children first). */
  clear(tables: ReadonlyArray<string>): AsyncResult<void, 'TEST_DB_ERROR'>;
  close(): Promise<void>;
}

export function connectTestDb<Schema>(): Result<TestDb<Schema>, TestDbErrorTag> {
  if (!TEST_DATABASE_URL) {
    return err('NO_TEST_DATABASE', {
      message: 'Set DATABASE_URL to run integration tests (see describeLive).',
    });
  }
  const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 4 });
  const db = new Kysely<Schema>({ dialect: new PostgresDialect({ pool }) });
  return ok({
    db,
    clear: (tables) =>
      wrapAsync(async () => {
        for (const table of tables) {
          await sql.raw(`DELETE FROM "${table}"`).execute(db);
        }
      }, 'TEST_DB_ERROR'),
    close: () => db.destroy(),
  });
}
