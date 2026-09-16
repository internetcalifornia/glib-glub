/**
 * API keys for the MCP authoring surface (Decision #8). A key is shown once
 * at creation and stored only as a SHA-256 digest; the secret has 256 bits
 * of entropy, so the digest needs no salt or slow hash. Every key belongs
 * to a user and acts with that user's roles — the tools' own policy decides
 * what an educator may do, this file only says who is calling.
 */

import { err, ok, wrapAsync } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import { brandId, newId, type McpApiKeyId, type UserId } from '@glib-glub/core';
import type { DB } from '@glib-glub/db';
import { createHash, randomBytes } from 'node:crypto';
import type { Kysely } from 'kysely';

export const API_KEY_PREFIX = 'gg_';

export interface ApiKeyRecord {
  id: McpApiKeyId;
  userId: UserId;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export function newApiKeySecret(): string {
  return `${API_KEY_PREFIX}${randomBytes(32).toString('base64url')}`;
}

export function hashApiKey(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

/** The bearer token on a request, or null when the header is absent or not a bearer. */
export function bearerFrom(headers: Headers): string | null {
  const value = headers.get('authorization');
  if (!value) return null;
  const [scheme, token] = value.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null;
}

export async function createApiKey(
  db: Kysely<DB>,
  input: { userId: UserId; name: string; now: Date }
): AsyncResult<{ record: ApiKeyRecord; secret: string }, 'VALIDATION_ERROR' | 'DB_ERROR'> {
  const name = input.name.trim();
  if (!name) return err('VALIDATION_ERROR', { message: 'A key needs a name' });
  const secret = newApiKeySecret();
  const record: ApiKeyRecord = {
    id: newId<'mcp_api_key'>(),
    userId: input.userId,
    name,
    createdAt: input.now,
    lastUsedAt: null,
    revokedAt: null,
  };
  const inserted = await wrapAsync(
    () =>
      db
        .insertInto('mcp_api_keys')
        .values({
          id: record.id,
          user_id: record.userId,
          name: record.name,
          key_hash: hashApiKey(secret),
          created_at: record.createdAt,
        })
        .execute(),
    'DB_ERROR'
  );
  if (!inserted.ok) return inserted;
  return ok({ record, secret });
}

export async function listApiKeys(
  db: Kysely<DB>,
  userId: UserId
): AsyncResult<ApiKeyRecord[], 'DB_ERROR'> {
  const rows = await wrapAsync(
    () =>
      db
        .selectFrom('mcp_api_keys')
        .select(['id', 'user_id', 'name', 'created_at', 'last_used_at', 'revoked_at'])
        .where('user_id', '=', userId)
        .orderBy('created_at', 'desc')
        .execute(),
    'DB_ERROR'
  );
  if (!rows.ok) return rows;
  return ok(
    rows.val.map((row) => ({
      id: brandId<'mcp_api_key'>(row.id),
      userId: brandId<'user'>(row.user_id),
      name: row.name,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      revokedAt: row.revoked_at,
    }))
  );
}

export async function revokeApiKey(
  db: Kysely<DB>,
  input: { userId: UserId; id: McpApiKeyId; now: Date }
): AsyncResult<void, 'NOT_FOUND' | 'DB_ERROR'> {
  const updated = await wrapAsync(
    () =>
      db
        .updateTable('mcp_api_keys')
        .set({ revoked_at: input.now })
        .where('id', '=', input.id)
        .where('user_id', '=', input.userId)
        .where('revoked_at', 'is', null)
        .executeTakeFirst(),
    'DB_ERROR'
  );
  if (!updated.ok) return updated;
  if (updated.val.numUpdatedRows === 0n) return err('NOT_FOUND', { message: 'No such active key' });
  return ok();
}

/** The user behind a presented secret; stamps the key's last use. */
export async function resolveApiKey(
  db: Kysely<DB>,
  secret: string,
  now: Date
): AsyncResult<UserId, 'INVALID_KEY' | 'DB_ERROR'> {
  if (!secret.startsWith(API_KEY_PREFIX)) return err('INVALID_KEY', { message: 'Not an API key' });
  const row = await wrapAsync(
    () =>
      db
        .selectFrom('mcp_api_keys')
        .select(['id', 'user_id'])
        .where('key_hash', '=', hashApiKey(secret))
        .where('revoked_at', 'is', null)
        .executeTakeFirst(),
    'DB_ERROR'
  );
  if (!row.ok) return row;
  if (!row.val) return err('INVALID_KEY', { message: 'Unknown or revoked key' });
  const stamped = await wrapAsync(
    () =>
      db
        .updateTable('mcp_api_keys')
        .set({ last_used_at: now })
        .where('id', '=', row.val.id)
        .execute(),
    'DB_ERROR'
  );
  if (!stamped.ok) return stamped;
  return ok(brandId<'user'>(row.val.user_id));
}
