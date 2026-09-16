/**
 * Better Auth against a real Postgres: the wiring in auth.ts and the tag
 * mapping in better-auth-authenticator.ts, which the in-memory fakes only
 * imitate. Sign-up creates a user with a credential login and — through the
 * database hook — the learner role; the cookie the response sets resolves
 * back to the session; a wrong password and a duplicate email get their
 * tags.
 */

import { connectTestDb, describeLive } from '@glib-glub/testing';
import type { DB } from '@glib-glub/db';
import { afterAll, beforeEach, expect, it } from 'vitest';

import { createAuth } from './auth';
import { betterAuthAuthenticator } from './better-auth-authenticator';
import type { Authenticator, IdentityStore } from './ports';
import { getSessionUser } from './session';
import { IDENTITY_TABLES, kyselyIdentityStore } from './store';

describeLive('Better Auth on Postgres', () => {
  const handle = connectTestDb<DB>();
  if (!handle.ok) return;
  const { db, truncate, close } = handle.val;

  const store: IdentityStore = kyselyIdentityStore(db);
  const auth = createAuth({
    db,
    store,
    env: { APP_ORIGIN: 'http://localhost:3000', AUTH_SECRET: '0123456789abcdef0123456789abcdef' },
    providers: { google: null, microsoft: null, facebook: null },
  });
  const authenticator: Authenticator = betterAuthAuthenticator(auth);

  beforeEach(async () => {
    const cleared = await truncate(IDENTITY_TABLES);
    expect(cleared.ok).toBe(true);
  });

  afterAll(async () => {
    await close();
  });

  it('signs up with a password: one user, one credential login, the learner role', async () => {
    const session = await authenticator.signUpWithPassword({
      email: 'maya@example.com',
      password: 'correct horse battery',
      name: 'Maya',
    });

    expect(session.ok).toBe(true);
    if (!session.ok) return;
    const logins = await store.listLogins(session.val.userId);
    expect(logins.ok && logins.val.map((login) => login.provider)).toEqual(['credential']);
    const roles = await store.getRoles(session.val.userId);
    expect(roles.ok && roles.val).toEqual(['learner']);
  });

  it('resolves the cookie it set back to a SessionUser with roles', async () => {
    const session = await authenticator.signUpWithPassword({
      email: 'maya@example.com',
      password: 'correct horse battery',
      name: 'Maya',
    });
    expect(session.ok).toBe(true);
    if (!session.ok) return;

    const user = await getSessionUser(
      { store, authenticator },
      new Headers({ cookie: session.val.cookie ?? '' })
    );

    expect(user.ok && user.val.email).toBe('maya@example.com');
    expect(user.ok && user.val.roles).toEqual(['learner']);
  });

  it('refuses a wrong password as INVALID_CREDENTIALS', async () => {
    const signedUp = await authenticator.signUpWithPassword({
      email: 'maya@example.com',
      password: 'correct horse battery',
      name: 'Maya',
    });
    expect(signedUp.ok).toBe(true);

    const signedIn = await authenticator.signInWithPassword({
      email: 'maya@example.com',
      password: 'wrong',
    });

    expect(!signedIn.ok && signedIn.err.type).toBe('INVALID_CREDENTIALS');
  });

  it('refuses a duplicate email as EMAIL_TAKEN', async () => {
    const first = await authenticator.signUpWithPassword({
      email: 'maya@example.com',
      password: 'correct horse battery',
      name: 'Maya',
    });
    expect(first.ok).toBe(true);

    const second = await authenticator.signUpWithPassword({
      email: 'maya@example.com',
      password: 'another password',
      name: 'Maya again',
    });

    expect(!second.ok && second.err.type).toBe('EMAIL_TAKEN');
  });

  it('links and unlinks a social login through the store, refusing the last one', async () => {
    const session = await authenticator.signUpWithPassword({
      email: 'maya@example.com',
      password: 'correct horse battery',
      name: 'Maya',
    });
    expect(session.ok).toBe(true);
    if (!session.ok) return;

    const added = await store.addLogin({
      userId: session.val.userId,
      provider: 'google',
      providerAccountId: 'g-123',
    });
    expect(added.ok).toBe(true);
    const again = await store.addLogin({
      userId: session.val.userId,
      provider: 'google',
      providerAccountId: 'g-123',
    });
    expect(!again.ok && again.err.type).toBe('ALREADY_LINKED');

    const logins = await store.listLogins(session.val.userId);
    expect(logins.ok && logins.val.length).toBe(2);
  });
});
