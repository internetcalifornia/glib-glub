/**
 * The Postgres implementation of `IdentityStore`, over Better Auth's tables
 * (user, account, passkey — camelCase columns, its convention) and ours
 * (user_roles, guardianships, learner_settings — snake_case, our convention).
 *
 * Reads are plain selects. The only write into Better Auth's tables is
 * `addLogin`, which inserts an account row exactly as Better Auth would for a
 * linked social identity, minus the tokens we never need. A unique violation
 * on (providerId, accountId) surfaces as ALREADY_LINKED rather than a thrown
 * pg error.
 */

import { err, ok, wrapAsync } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import { brandId, newId } from '@glib-glub/core';
import type { DB } from '@glib-glub/db';
import type { Kysely } from 'kysely';

import type { IdentityStore } from './ports';
import {
  AGE_BANDS,
  PROVIDERS,
  ROLES,
  type AgeBand,
  type Login,
  type Provider,
  type Role,
  type User,
} from './types';

const PG_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(cause: unknown): boolean {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    cause.code === PG_UNIQUE_VIOLATION
  );
}

function toProvider(value: string): Provider | null {
  return PROVIDERS.find((provider) => provider === value) ?? null;
}

function toRole(value: string): Role | null {
  return ROLES.find((role) => role === value) ?? null;
}

function toAgeBand(value: string | null): AgeBand | null {
  return AGE_BANDS.find((band) => band === value) ?? null;
}

function toUser(row: { id: string; email: string; name: string; emailVerified: boolean }): User {
  return {
    id: brandId<'user'>(row.id),
    email: row.email,
    name: row.name,
    emailVerified: row.emailVerified,
  };
}

export function kyselyIdentityStore(db: Kysely<DB>): IdentityStore {
  return {
    getUser: async (userId): ReturnType<IdentityStore['getUser']> => {
      const row = await wrapAsync(
        () =>
          db
            .selectFrom('user')
            .select(['id', 'email', 'name', 'emailVerified'])
            .where('id', '=', userId)
            .executeTakeFirst(),
        'DB_ERROR'
      );
      if (!row.ok) return row;
      if (!row.val) return err('NOT_FOUND', { message: `No user ${userId}` });
      return ok(toUser(row.val));
    },

    findUserByEmail: async (email): ReturnType<IdentityStore['findUserByEmail']> => {
      const row = await wrapAsync(
        () =>
          db
            .selectFrom('user')
            .select(['id', 'email', 'name', 'emailVerified'])
            .where('email', '=', email.toLowerCase())
            .executeTakeFirst(),
        'DB_ERROR'
      );
      if (!row.ok) return row;
      return ok(row.val ? toUser(row.val) : null);
    },

    createUser: async (input): ReturnType<IdentityStore['createUser']> => {
      const id = newId<'user'>();
      const inserted = await wrapAsync(
        () =>
          db
            .insertInto('user')
            .values({
              id,
              email: input.email.toLowerCase(),
              name: input.name,
              emailVerified: input.emailVerified,
            })
            .execute(),
        'DB_ERROR'
      );
      if (!inserted.ok) return inserted;
      return ok({
        id,
        email: input.email.toLowerCase(),
        name: input.name,
        emailVerified: input.emailVerified,
      });
    },

    listLogins: async (userId): ReturnType<IdentityStore['listLogins']> => {
      const accounts = await wrapAsync(
        () =>
          db
            .selectFrom('account')
            .select(['id', 'providerId', 'accountId'])
            .where('userId', '=', userId)
            .orderBy('createdAt')
            .execute(),
        'DB_ERROR'
      );
      if (!accounts.ok) return accounts;
      const passkeys = await wrapAsync(
        () =>
          db
            .selectFrom('passkey')
            .select(['id', 'credentialID'])
            .where('userId', '=', userId)
            .orderBy('createdAt')
            .execute(),
        'DB_ERROR'
      );
      if (!passkeys.ok) return passkeys;

      const logins: Login[] = [];
      for (const row of accounts.val) {
        const provider = toProvider(row.providerId);
        if (provider) {
          logins.push({ id: row.id, userId, provider, providerAccountId: row.accountId });
        }
      }
      for (const row of passkeys.val) {
        logins.push({
          id: row.id,
          userId,
          provider: 'passkey',
          providerAccountId: row.credentialID,
        });
      }
      return ok(logins);
    },

    findLogin: async (provider, providerAccountId): ReturnType<IdentityStore['findLogin']> => {
      const row = await wrapAsync(
        () =>
          db
            .selectFrom('account')
            .select(['id', 'userId', 'providerId', 'accountId'])
            .where('providerId', '=', provider)
            .where('accountId', '=', providerAccountId)
            .executeTakeFirst(),
        'DB_ERROR'
      );
      if (!row.ok) return row;
      if (!row.val) return ok(null);
      return ok({
        id: row.val.id,
        userId: brandId<'user'>(row.val.userId),
        provider,
        providerAccountId: row.val.accountId,
      });
    },

    addLogin: async (input): ReturnType<IdentityStore['addLogin']> => {
      const id = newId<'login'>();
      const inserted = await wrapAsync(
        () =>
          db
            .insertInto('account')
            .values({
              id,
              userId: input.userId,
              providerId: input.provider,
              accountId: input.providerAccountId,
            })
            .execute(),
        'DB_ERROR'
      );
      if (!inserted.ok) {
        if (isUniqueViolation(inserted.err.cause)) {
          return err('ALREADY_LINKED', { message: 'That login is already linked to an account' });
        }
        return inserted;
      }
      return ok({ id, ...input });
    },

    removeLogin: async (userId, loginId): ReturnType<IdentityStore['removeLogin']> => {
      const accounts = await wrapAsync(
        () =>
          db
            .deleteFrom('account')
            .where('id', '=', loginId)
            .where('userId', '=', userId)
            .executeTakeFirst(),
        'DB_ERROR'
      );
      if (!accounts.ok) return accounts;
      if (accounts.val.numDeletedRows > 0n) return ok();
      const passkeys = await wrapAsync(
        () =>
          db
            .deleteFrom('passkey')
            .where('id', '=', loginId)
            .where('userId', '=', userId)
            .executeTakeFirst(),
        'DB_ERROR'
      );
      if (!passkeys.ok) return passkeys;
      if (passkeys.val.numDeletedRows > 0n) return ok();
      return err('NOT_FOUND', { message: 'No such login on this account' });
    },

    listPasskeys: async (userId): ReturnType<IdentityStore['listPasskeys']> => {
      const rows = await wrapAsync(
        () =>
          db
            .selectFrom('passkey')
            .select(['id', 'name', 'credentialID'])
            .where('userId', '=', userId)
            .orderBy('createdAt')
            .execute(),
        'DB_ERROR'
      );
      if (!rows.ok) return rows;
      return ok(
        rows.val.map((row) => ({
          id: row.id,
          userId,
          name: row.name,
          credentialId: row.credentialID,
        }))
      );
    },

    getRoles: async (userId): ReturnType<IdentityStore['getRoles']> => {
      const rows = await wrapAsync(
        () => db.selectFrom('user_roles').select('role').where('user_id', '=', userId).execute(),
        'DB_ERROR'
      );
      if (!rows.ok) return rows;
      return ok(
        rows.val.flatMap((row) => {
          const role = toRole(row.role);
          return role ? [role] : [];
        })
      );
    },

    addRole: async (userId, role): ReturnType<IdentityStore['addRole']> => {
      const inserted = await wrapAsync(
        () =>
          db
            .insertInto('user_roles')
            .values({ user_id: userId, role })
            .onConflict((oc) => oc.columns(['user_id', 'role']).doNothing())
            .execute(),
        'DB_ERROR'
      );
      if (!inserted.ok) return inserted;
      return ok();
    },

    getAgeBand: async (userId): ReturnType<IdentityStore['getAgeBand']> => {
      const row = await wrapAsync(
        () =>
          db
            .selectFrom('learner_settings')
            .select('age_band')
            .where('user_id', '=', userId)
            .executeTakeFirst(),
        'DB_ERROR'
      );
      if (!row.ok) return row;
      return ok(toAgeBand(row.val?.age_band ?? null));
    },

    setAgeBand: async (userId, band): ReturnType<IdentityStore['setAgeBand']> => {
      const upserted = await wrapAsync(
        () =>
          db
            .insertInto('learner_settings')
            .values({ user_id: userId, age_band: band })
            .onConflict((oc) =>
              oc.column('user_id').doUpdateSet({ age_band: band, updated_at: new Date() })
            )
            .execute(),
        'DB_ERROR'
      );
      if (!upserted.ok) return upserted;
      return ok();
    },

    getGuardianship: async (
      guardianId,
      learnerId
    ): ReturnType<IdentityStore['getGuardianship']> => {
      const row = await wrapAsync(
        () =>
          db
            .selectFrom('guardianships')
            .select(['guardian_id', 'learner_id', 'status'])
            .where('guardian_id', '=', guardianId)
            .where('learner_id', '=', learnerId)
            .executeTakeFirst(),
        'DB_ERROR'
      );
      if (!row.ok) return row;
      return ok(row.val ? toGuardianship(row.val) : null);
    },

    upsertGuardianship: async (input): ReturnType<IdentityStore['upsertGuardianship']> => {
      const upserted = await wrapAsync(
        () =>
          db
            .insertInto('guardianships')
            .values({
              guardian_id: input.guardianId,
              learner_id: input.learnerId,
              status: input.status,
              accepted_at: input.status === 'accepted' ? new Date() : null,
            })
            .onConflict((oc) =>
              oc.columns(['guardian_id', 'learner_id']).doUpdateSet({
                status: input.status,
                accepted_at: input.status === 'accepted' ? new Date() : null,
              })
            )
            .execute(),
        'DB_ERROR'
      );
      if (!upserted.ok) return upserted;
      return ok({ ...input });
    },

    listGuardiansOf: async (learnerId): ReturnType<IdentityStore['listGuardiansOf']> => {
      const rows = await wrapAsync(
        () =>
          db
            .selectFrom('guardianships')
            .select(['guardian_id', 'learner_id', 'status'])
            .where('learner_id', '=', learnerId)
            .execute(),
        'DB_ERROR'
      );
      if (!rows.ok) return rows;
      return ok(rows.val.map(toGuardianship));
    },

    listLearnersOf: async (guardianId): ReturnType<IdentityStore['listLearnersOf']> => {
      const rows = await wrapAsync(
        () =>
          db
            .selectFrom('guardianships')
            .select(['guardian_id', 'learner_id', 'status'])
            .where('guardian_id', '=', guardianId)
            .execute(),
        'DB_ERROR'
      );
      if (!rows.ok) return rows;
      return ok(rows.val.map(toGuardianship));
    },
  };
}

function toGuardianship(row: { guardian_id: string; learner_id: string; status: string }) {
  return {
    guardianId: brandId<'user'>(row.guardian_id),
    learnerId: brandId<'user'>(row.learner_id),
    status:
      row.status === 'accepted'
        ? ('accepted' as const)
        : row.status === 'revoked'
          ? ('revoked' as const)
          : ('invited' as const),
  };
}

/** Everything this package writes, for the integration tier's truncate. */
export const IDENTITY_TABLES: ReadonlyArray<string> = [
  'learner_settings',
  'guardianships',
  'user_roles',
  'passkey',
  'verification',
  'account',
  'session',
  'user',
];

export type { AsyncResult };
