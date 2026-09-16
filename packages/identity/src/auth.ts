/**
 * The Better Auth instance (Decision #3), built from validated config.
 *
 * What is decided here and nowhere else:
 * - sessions live in Postgres; the cookie carries only an opaque token;
 * - email + password is on, eight characters minimum;
 * - a social provider is on only when both halves of its credential are
 *   configured (`socialProvidersOf`), so a half-configured provider cannot
 *   appear on the sign-in page and fail at the callback;
 * - implicit linking trusts exactly `TRUSTED_PROVIDERS` (linking.ts);
 * - ids are UUIDs, so Better Auth's rows use the same id shape as ours;
 * - every new user gets the learner role through the `user.create.after`
 *   hook, which is how `onUserCreated` runs in production.
 */

import { passkey } from '@better-auth/passkey';
import { brandId, PRODUCT_NAME } from '@glib-glub/core';
import type { SocialProviders } from '@glib-glub/config';
import type { DB } from '@glib-glub/db';
import { betterAuth } from 'better-auth';
import type { Kysely } from 'kysely';

import { TRUSTED_PROVIDERS } from './linking';
import type { IdentityStore } from './ports';
import { onUserCreated } from './roles';

export const SESSION_COOKIE_PREFIX = 'glib_glub';

export interface AuthEnv {
  APP_ORIGIN: string;
  AUTH_SECRET: string;
}

export interface AuthDeps {
  db: Kysely<DB>;
  store: IdentityStore;
  env: AuthEnv;
  providers: SocialProviders;
}

export function createAuth(deps: AuthDeps) {
  const origin = new URL(deps.env.APP_ORIGIN);
  return betterAuth({
    appName: PRODUCT_NAME,
    baseURL: deps.env.APP_ORIGIN,
    secret: deps.env.AUTH_SECRET,
    database: { db: deps.db, type: 'postgres' },
    advanced: {
      cookiePrefix: SESSION_COOKIE_PREFIX,
      // Explicit generator: the 'uuid' preset inserted NULL ids with this
      // adapter version, which the NOT NULL primary key rightly refused.
      database: { generateId: () => globalThis.crypto.randomUUID() },
    },
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    socialProviders: {
      ...(deps.providers.google ? { google: deps.providers.google } : {}),
      ...(deps.providers.microsoft ? { microsoft: deps.providers.microsoft } : {}),
      ...(deps.providers.facebook ? { facebook: deps.providers.facebook } : {}),
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: [...TRUSTED_PROVIDERS],
      },
    },
    plugins: [
      passkey({
        rpID: origin.hostname,
        rpName: PRODUCT_NAME,
        origin: deps.env.APP_ORIGIN,
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          // eslint-disable-next-line result/no-unwrapped-async -- Better Auth owns this hook's Promise<void> signature
          after: async (user) => {
            // A failure here must not undo the sign-up; the role can be
            // repaired, an account that half-exists cannot.
            void (await onUserCreated({ store: deps.store }, brandId<'user'>(user.id)));
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
