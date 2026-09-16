/**
 * The log tables @campfhir/bored-logs' Postgres adapter writes to, created
 * by the library's own idempotent migrations so the schema is exactly the
 * one the adapter (and its search API) expects. Versioned here, in the
 * same ledger as everything else, rather than run on app start.
 */

import {
  down as boredLogsDown,
  up as boredLogsUp,
} from '@campfhir/bored-logs/adapters/psql/migration';
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await boredLogsUp(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await boredLogsDown(db);
}
