/**
 * The vocabulary of identity: who someone is, how they log in, what they
 * may do, and who looks after them.
 */

import type { UserId } from '@glib-glub/core';

export const ROLES = ['learner', 'guardian', 'educator', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const AGE_BANDS = ['k-5', '6-8', '9-12', 'university', 'adult'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

/** `credential` is Better Auth's name for email + password. */
export const PROVIDERS = ['credential', 'google', 'microsoft', 'facebook', 'passkey'] as const;
export type Provider = (typeof PROVIDERS)[number];

export type SocialProvider = Extract<Provider, 'google' | 'microsoft' | 'facebook'>;

export interface User {
  readonly id: UserId;
  readonly email: string;
  readonly name: string;
  readonly emailVerified: boolean;
}

/** One way into an account. `providerAccountId` is the provider's own id for
 *  the person (a Google `sub`, a passkey credential id, or the user id for a
 *  credential login — Better Auth's convention). */
export interface Login {
  readonly id: string;
  readonly userId: UserId;
  readonly provider: Provider;
  readonly providerAccountId: string;
}

export interface Passkey {
  readonly id: string;
  readonly userId: UserId;
  readonly name: string | null;
  readonly credentialId: string;
}

export type GuardianshipStatus = 'invited' | 'accepted' | 'revoked';

export interface Guardianship {
  readonly guardianId: UserId;
  readonly learnerId: UserId;
  readonly status: GuardianshipStatus;
}

/** What a request handler learns about the caller: everything the gates need,
 *  read from the database on every request — never from the cookie. */
export interface SessionUser {
  readonly userId: UserId;
  readonly email: string;
  readonly name: string;
  readonly roles: ReadonlyArray<Role>;
  readonly ageBand: AgeBand | null;
}
