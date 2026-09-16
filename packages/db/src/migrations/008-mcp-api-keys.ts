/**
 * API keys for the MCP authoring surface (Decision #8): one row per key,
 * hashed at rest, owned by a user (the educator whose tracks the key
 * authors as), revocable, and stamped with its last use so an unused key
 * is easy to spot and remove.
 */

import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('mcp_api_keys')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('user.id').onDelete('cascade'))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('key_hash', 'text', (col) => col.notNull().unique())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('last_used_at', 'timestamptz')
    .addColumn('revoked_at', 'timestamptz')
    .execute();
  await db.schema
    .createIndex('mcp_api_keys_user_idx')
    .on('mcp_api_keys')
    .column('user_id')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('mcp_api_keys').ifExists().execute();
}
