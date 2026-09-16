/**
 * The two seams identity is built on.
 *
 * `IdentityStore` is the tables: Better Auth's (user, account, passkey) read
 * and written directly where our policy needs them, plus our own (roles,
 * guardianships, learner settings). `Authenticator` is the ceremonies —
 * password hashing, session issuance, the WebAuthn dance — which Better Auth
 * owns in production. The policy modules (linking, roles, guardianship) take
 * both as parameters and are tested against the in-memory fakes in
 * ./testing.ts; the Postgres and Better Auth implementations are covered by
 * the integration tier.
 */

import type { AsyncResult } from '@campfhir/safe-functions/types';
import type { UserId } from '@glib-glub/core';

import type {
  AgeBand,
  Guardianship,
  GuardianshipStatus,
  Login,
  Passkey,
  Provider,
  Role,
  User,
} from './types';

export type StoreErrorTag = 'DB_ERROR' | 'NOT_FOUND' | 'ALREADY_LINKED';

export interface IdentityStore {
  getUser(userId: UserId): AsyncResult<User, 'NOT_FOUND' | 'DB_ERROR'>;
  findUserByEmail(email: string): AsyncResult<User | null, 'DB_ERROR'>;
  /** Users are normally created by Better Auth; this is for social sign-in
   *  resolution and tests. */
  createUser(input: {
    email: string;
    name: string;
    emailVerified: boolean;
  }): AsyncResult<User, 'DB_ERROR'>;

  listLogins(userId: UserId): AsyncResult<Login[], 'DB_ERROR'>;
  findLogin(provider: Provider, providerAccountId: string): AsyncResult<Login | null, 'DB_ERROR'>;
  addLogin(input: {
    userId: UserId;
    provider: Provider;
    providerAccountId: string;
  }): AsyncResult<Login, 'DB_ERROR' | 'ALREADY_LINKED'>;
  removeLogin(userId: UserId, loginId: string): AsyncResult<void, 'DB_ERROR' | 'NOT_FOUND'>;

  listPasskeys(userId: UserId): AsyncResult<Passkey[], 'DB_ERROR'>;

  getRoles(userId: UserId): AsyncResult<Role[], 'DB_ERROR'>;
  addRole(userId: UserId, role: Role): AsyncResult<void, 'DB_ERROR'>;

  getAgeBand(userId: UserId): AsyncResult<AgeBand | null, 'DB_ERROR'>;
  setAgeBand(userId: UserId, band: AgeBand): AsyncResult<void, 'DB_ERROR'>;

  getGuardianship(
    guardianId: UserId,
    learnerId: UserId
  ): AsyncResult<Guardianship | null, 'DB_ERROR'>;
  upsertGuardianship(input: {
    guardianId: UserId;
    learnerId: UserId;
    status: GuardianshipStatus;
  }): AsyncResult<Guardianship, 'DB_ERROR'>;
  listGuardiansOf(learnerId: UserId): AsyncResult<Guardianship[], 'DB_ERROR'>;
  listLearnersOf(guardianId: UserId): AsyncResult<Guardianship[], 'DB_ERROR'>;
}

/**
 * WebAuthn JSON payloads as the browser produces them (the W3C
 * `PublicKeyCredential.toJSON()` shapes). Declared here so the port needs no
 * cast to hand them to Better Auth, whose passkey plugin accepts exactly
 * these structures.
 */
export interface PasskeyAssertion {
  id: string;
  rawId: string;
  type: 'public-key';
  authenticatorAttachment?: 'platform' | 'cross-platform';
  clientExtensionResults: Record<string, unknown>;
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle?: string;
  };
}

export interface PasskeyAttestation {
  id: string;
  rawId: string;
  type: 'public-key';
  authenticatorAttachment?: 'platform' | 'cross-platform';
  clientExtensionResults: Record<string, unknown>;
  response: {
    clientDataJSON: string;
    attestationObject: string;
    transports?: string[];
  };
}

export interface Session {
  readonly userId: UserId;
  readonly token: string;
  /** The `cookie` request header that names this session, when the
   *  authenticator issued cookies (Better Auth does; the fake does not). */
  readonly cookie?: string;
}

export interface Authenticator {
  signUpWithPassword(input: {
    email: string;
    password: string;
    name: string;
  }): AsyncResult<Session, 'EMAIL_TAKEN' | 'VALIDATION_ERROR' | 'AUTH_ERROR'>;
  signInWithPassword(input: {
    email: string;
    password: string;
  }): AsyncResult<Session, 'INVALID_CREDENTIALS' | 'AUTH_ERROR'>;
  /** The session the request's cookies name, if any. */
  sessionFromHeaders(headers: Headers): AsyncResult<Session, 'NO_SESSION' | 'AUTH_ERROR'>;
  /**
   * Complete a passkey assertion. Production hands the WebAuthn response to
   * Better Auth, which verifies the signature against the stored public key;
   * the fake accepts any assertion for a known credential id.
   */
  signInWithPasskey(input: {
    credentialId: string;
    assertion: PasskeyAssertion;
  }): AsyncResult<Session, 'INVALID_CREDENTIALS' | 'AUTH_ERROR'>;
  /**
   * Complete a passkey registration ceremony for a signed-in user.
   * Production verifies the attestation through Better Auth; the fake records
   * the credential.
   */
  registerPasskey(input: {
    session: Session;
    name: string;
    attestation: PasskeyAttestation;
  }): AsyncResult<Passkey, 'AUTH_ERROR' | 'NO_SESSION'>;
}
