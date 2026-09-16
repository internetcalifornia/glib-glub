/**
 * In-memory implementations of the identity ports, sharing one state so a
 * scenario can sign up through the authenticator and then read the store.
 * The authenticator mirrors what Better Auth does in production at the
 * level the policy modules care about: sign-up creates a user, a credential
 * login and (through `onUserCreated`) the learner role; sessions are opaque
 * tokens; a passkey ceremony records a credential.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import { brandId, newId, type UserId } from '@glib-glub/core';

import type {
  Authenticator,
  IdentityStore,
  PasskeyAssertion,
  PasskeyAttestation,
  Session,
} from './ports';
import { onUserCreated } from './roles';
import type { AgeBand, Guardianship, Login, Passkey, Role, User } from './types';

export interface MemoryIdentity {
  store: IdentityStore;
  authenticator: Authenticator;
  /** Build the headers a browser would send for a session. */
  headersFor(session: Session): Headers;
  /** Test-only peek: the password on file for an email. */
  passwords: Map<string, string>;
}

const SESSION_COOKIE = 'glib_glub.session_token';

export function memoryIdentity(): MemoryIdentity {
  const users = new Map<UserId, User>();
  const logins: Login[] = [];
  const passkeys: Passkey[] = [];
  const roles = new Map<UserId, Set<Role>>();
  const ageBands = new Map<UserId, AgeBand>();
  const guardianships: Guardianship[] = [];
  const sessions = new Map<string, UserId>();
  const passwords = new Map<string, string>();

  const store: IdentityStore = {
    getUser: async (userId): ReturnType<IdentityStore['getUser']> => {
      const user = users.get(userId);
      return user ? ok(user) : err('NOT_FOUND', { message: `No user ${userId}` });
    },
    findUserByEmail: async (email): ReturnType<IdentityStore['findUserByEmail']> =>
      ok([...users.values()].find((user) => user.email === email.toLowerCase()) ?? null),
    createUser: async (input): ReturnType<IdentityStore['createUser']> => {
      const user: User = {
        id: newId<'user'>(),
        email: input.email.toLowerCase(),
        name: input.name,
        emailVerified: input.emailVerified,
      };
      users.set(user.id, user);
      return ok(user);
    },
    listLogins: async (userId): ReturnType<IdentityStore['listLogins']> =>
      ok([
        ...logins.filter((login) => login.userId === userId),
        ...passkeys
          .filter((passkey) => passkey.userId === userId)
          .map<Login>((passkey) => ({
            id: passkey.id,
            userId,
            provider: 'passkey',
            providerAccountId: passkey.credentialId,
          })),
      ]),
    findLogin: async (provider, providerAccountId): ReturnType<IdentityStore['findLogin']> =>
      ok(
        logins.find(
          (login) => login.provider === provider && login.providerAccountId === providerAccountId
        ) ?? null
      ),
    addLogin: async (input): ReturnType<IdentityStore['addLogin']> => {
      const taken = logins.some(
        (login) =>
          login.provider === input.provider && login.providerAccountId === input.providerAccountId
      );
      if (taken) return err('ALREADY_LINKED');
      const login: Login = { id: newId<'login'>(), ...input };
      logins.push(login);
      return ok(login);
    },
    removeLogin: async (userId, loginId): ReturnType<IdentityStore['removeLogin']> => {
      const index = logins.findIndex((login) => login.id === loginId && login.userId === userId);
      if (index >= 0) {
        logins.splice(index, 1);
        return ok();
      }
      const passkeyIndex = passkeys.findIndex((p) => p.id === loginId && p.userId === userId);
      if (passkeyIndex >= 0) {
        passkeys.splice(passkeyIndex, 1);
        return ok();
      }
      return err('NOT_FOUND');
    },
    listPasskeys: async (userId) => ok(passkeys.filter((passkey) => passkey.userId === userId)),
    getRoles: async (userId) => ok([...(roles.get(userId) ?? [])]),
    addRole: async (userId, role): ReturnType<IdentityStore['addRole']> => {
      const set = roles.get(userId) ?? new Set<Role>();
      set.add(role);
      roles.set(userId, set);
      return ok();
    },
    getAgeBand: async (userId) => ok(ageBands.get(userId) ?? null),
    setAgeBand: async (userId, band): ReturnType<IdentityStore['setAgeBand']> => {
      ageBands.set(userId, band);
      return ok();
    },
    getGuardianship: async (guardianId, learnerId): ReturnType<IdentityStore['getGuardianship']> =>
      ok(
        guardianships.find((g) => g.guardianId === guardianId && g.learnerId === learnerId) ?? null
      ),
    upsertGuardianship: async (input): ReturnType<IdentityStore['upsertGuardianship']> => {
      const index = guardianships.findIndex(
        (g) => g.guardianId === input.guardianId && g.learnerId === input.learnerId
      );
      const row: Guardianship = { ...input };
      if (index >= 0) guardianships[index] = row;
      else guardianships.push(row);
      return ok(row);
    },
    listGuardiansOf: async (learnerId): ReturnType<IdentityStore['listGuardiansOf']> =>
      ok(guardianships.filter((g) => g.learnerId === learnerId)),
    listLearnersOf: async (guardianId): ReturnType<IdentityStore['listLearnersOf']> =>
      ok(guardianships.filter((g) => g.guardianId === guardianId)),
  };

  const startSession = (userId: UserId): Session => {
    const token = newId<'session'>();
    sessions.set(token, userId);
    return { userId, token };
  };

  const authenticator: Authenticator = {
    signUpWithPassword: async (input): ReturnType<Authenticator['signUpWithPassword']> => {
      const existing = await store.findUserByEmail(input.email);
      if (!existing.ok) return err('AUTH_ERROR');
      if (existing.val) return err('EMAIL_TAKEN', { message: 'User already exists.' });
      if (input.password.length < 8) {
        return err('VALIDATION_ERROR', { message: 'Password too short' });
      }
      const created = await store.createUser({ ...input, emailVerified: false });
      if (!created.ok) return err('AUTH_ERROR');
      const login = await store.addLogin({
        userId: created.val.id,
        provider: 'credential',
        providerAccountId: created.val.id,
      });
      if (!login.ok) return err('AUTH_ERROR');
      passwords.set(created.val.email, input.password);
      const role = await onUserCreated({ store }, created.val.id);
      if (!role.ok) return err('AUTH_ERROR');
      return ok(startSession(created.val.id));
    },
    signInWithPassword: async (input): ReturnType<Authenticator['signInWithPassword']> => {
      const user = await store.findUserByEmail(input.email);
      if (!user.ok) return err('AUTH_ERROR');
      if (!user.val || passwords.get(user.val.email) !== input.password) {
        return err('INVALID_CREDENTIALS', { message: 'Invalid email or password' });
      }
      return ok(startSession(user.val.id));
    },
    sessionFromHeaders: async (headers): ReturnType<Authenticator['sessionFromHeaders']> => {
      const cookie = headers.get('cookie') ?? '';
      const match = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
      const userId = match?.[1] ? sessions.get(match[1]) : undefined;
      if (!match?.[1] || !userId) return err('NO_SESSION');
      return ok({ userId, token: match[1] });
    },
    signInWithPasskey: async (input): ReturnType<Authenticator['signInWithPasskey']> => {
      const passkey = passkeys.find((candidate) => candidate.credentialId === input.credentialId);
      if (!passkey) return err('INVALID_CREDENTIALS');
      return ok(startSession(passkey.userId));
    },
    registerPasskey: async (input): ReturnType<Authenticator['registerPasskey']> => {
      if (!sessions.has(input.session.token)) return err('NO_SESSION');
      const passkey: Passkey = {
        id: newId<'passkey'>(),
        userId: input.session.userId,
        name: input.name,
        credentialId: `cred-${newId<'credential'>()}`,
      };
      passkeys.push(passkey);
      return ok(passkey);
    },
  };

  return {
    store,
    authenticator,
    passwords,
    headersFor: (session) => new Headers({ cookie: `${SESSION_COOKIE}=${session.token}` }),
  };
}

/** A user id that is well-formed but belongs to nobody. */
export function strangerId(): UserId {
  return brandId<'user'>('00000000-0000-4000-8000-000000000000');
}

/**
 * The shared scenario world: people by email, their current session, and the
 * last outcome of an action, so steps can assert on whichever they need.
 */
export interface IdentityWorld extends MemoryIdentity {
  sessionOf: Map<string, Session>;
  last: AsyncResultValue;
  userIdOf(email: string): Promise<UserId>;
  signUp(email: string, password: string): Promise<void>;
  signedIn(email: string): Session;
}

type AsyncResultValue = Awaited<AsyncResult<unknown, string>> | undefined;

export function identityWorld(): IdentityWorld {
  const memory = memoryIdentity();
  const sessionOf = new Map<string, Session>();
  const world: IdentityWorld = {
    ...memory,
    sessionOf,
    last: undefined,
    async userIdOf(email) {
      const user = await memory.store.findUserByEmail(email);
      if (!user.ok || !user.val) return strangerId();
      return user.val.id;
    },
    async signUp(email, password) {
      const session = await memory.authenticator.signUpWithPassword({
        email,
        password,
        name: email.split('@')[0] ?? email,
      });
      world.last = session;
      if (session.ok) sessionOf.set(email, session.val);
    },
    signedIn(email) {
      const session = sessionOf.get(email);
      if (!session) return { userId: strangerId(), token: 'none' };
      return session;
    },
  };
  return world;
}

/** A syntactically complete WebAuthn assertion the fake authenticator accepts. */
export function fakeAssertion(credentialId = 'cred'): PasskeyAssertion {
  return {
    id: credentialId,
    rawId: credentialId,
    type: 'public-key',
    clientExtensionResults: {},
    response: { clientDataJSON: 'e30', authenticatorData: 'AA', signature: 'AA' },
  };
}

export function fakeAttestation(credentialId = 'cred'): PasskeyAttestation {
  return {
    id: credentialId,
    rawId: credentialId,
    type: 'public-key',
    clientExtensionResults: {},
    response: { clientDataJSON: 'e30', attestationObject: 'AA' },
  };
}
