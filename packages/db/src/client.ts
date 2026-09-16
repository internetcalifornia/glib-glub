/**
 * The one Postgres pool per process.
 *
 * Connection state is anchored on globalThis, not the module cache. Next
 * bundles instrumentation.ts, the server routes, and the proxy as separate
 * compilation graphs; each evaluates this module separately, so plain
 * module-level state would mean one pool per graph. One process, one pool.
 *
 * Deliberately raw process.env, not @glib-glub/config: this package is shared
 * by the web app, the voice gateway and the migrate CLI, and DATABASE_URL is
 * the only setting it needs. Each app validates its own fuller config.
 */

import { err, ok, wrapAsync } from '@campfhir/safe-functions/helpers';
import type { AsyncResult, Result } from '@campfhir/safe-functions/types';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

import type { DB } from './db.types';

export type DbErrorTag = 'DB_INIT_ERROR';
export type DbCloseErrorTag = 'DB_CLOSE_ERROR';

interface DbState {
  db: Kysely<DB> | null;
  pool: Pool | null;
}

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- globalThis has no declared slot for our state; this is the documented split-singleton guard
const globalForDb = globalThis as unknown as { __glibGlubDbState?: DbState };
const state: DbState = (globalForDb.__glibGlubDbState ??= { db: null, pool: null });

export function initDatabase(
  connectionString = process.env.DATABASE_URL
): Result<Pool, DbErrorTag> {
  if (state.pool) return ok(state.pool);

  if (!connectionString) {
    return err('DB_INIT_ERROR', { message: 'DATABASE_URL is not set' });
  }

  const pool = new Pool({ connectionString });
  // An IDLE connection dying (Postgres restart, network drop, server-side
  // reap) emits the pool's 'error' event. Without a listener Node treats it
  // as an unhandled 'error' and kills the process. Handled, pg-pool discards
  // the dead client and the next query checks out a fresh connection.
  // console.error, not a logger: this package sits below the logging stack.
  pool.on('error', (error) => {
    console.error(`[db] idle connection error (recovering): ${error.message}`);
  });
  state.pool = pool;
  return ok(pool);
}

export function getDatabase(): Result<Kysely<DB>, DbErrorTag> {
  if (state.db) return ok(state.db);

  const poolResult = initDatabase();
  if (!poolResult.ok) return poolResult;

  state.db = new Kysely<DB>({ dialect: new PostgresDialect({ pool: poolResult.val }) });
  return ok(state.db);
}

export function getPool(): Result<Pool, DbErrorTag> {
  return state.pool ? ok(state.pool) : initDatabase();
}

export async function closeDatabase(): AsyncResult<void, DbCloseErrorTag> {
  const { db, pool } = state;
  state.db = null;
  state.pool = null;
  if (db) {
    // Kysely's destroy ends the pool it wraps — the same pool state.pool
    // held — and pg-pool throws on a second end(). So a built db means
    // destroy alone closes everything.
    return wrapAsync(() => db.destroy(), 'DB_CLOSE_ERROR');
  }
  if (pool) {
    return wrapAsync(() => pool.end(), 'DB_CLOSE_ERROR');
  }
  return ok();
}
