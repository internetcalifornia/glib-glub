/**
 * Step definitions for features/password-login.feature — sign-up creates
 * one account with one credential login, the right password starts a
 * session, the wrong one is refused without saying which half was wrong,
 * and an email cannot be registered twice.
 */

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { featurePath } from '@glib-glub/testing';
import { expect } from 'vitest';

import { identityWorld, type IdentityWorld } from './testing';

const feature = await loadFeature(featurePath(import.meta.url, 'password-login.feature'));

describeFeature(feature, ({ Scenario, BeforeEachScenario }) => {
  let world: IdentityWorld;
  BeforeEachScenario(() => {
    world = identityWorld();
  });

  const signsUp = async (_ctx: unknown, email: string, password: string) => {
    await world.signUp(email, password);
  };
  const signedUp = signsUp;
  const signsIn = async (_ctx: unknown, email: string, password: string) => {
    const session = await world.authenticator.signInWithPassword({ email, password });
    world.last = session;
    if (session.ok) world.sessionOf.set(email, session.val);
  };
  const accountExists = async (_ctx: unknown, email: string) => {
    const user = await world.store.findUserByEmail(email);
    expect(user.ok && user.val?.email).toBe(email);
  };
  const loginCount = async (_ctx: unknown, email: string, count: number) => {
    const logins = await world.store.listLogins(await world.userIdOf(email));
    expect(logins.ok && logins.val.length).toBe(count);
  };
  const sessionExists = (_ctx: unknown, email: string) => {
    expect(world.sessionOf.has(email)).toBe(true);
  };

  Scenario('Signing up with a password creates one account', ({ When, Then, And }) => {
    When('{string} signs up with the password {string}', signsUp);
    Then('an account exists for {string}', accountExists);
    And('{string} has exactly {int} linked login', loginCount);
    And('that login is a credential login', async () => {
      const logins = await world.store.listLogins(await world.userIdOf('maya@example.com'));
      expect(logins.ok && logins.val[0]?.provider).toBe('credential');
    });
  });

  Scenario('Signing in with the right password starts a session', ({ Given, When, Then }) => {
    Given('{string} signed up with the password {string}', signedUp);
    When('{string} signs in with the password {string}', signsIn);
    Then('a session exists for {string}', sessionExists);
  });

  Scenario('A wrong password is refused without a session', ({ Given, When, Then, And }) => {
    let before: number;
    Given(
      '{string} signed up with the password {string}',
      async (ctx: unknown, email: string, password: string) => {
        await signedUp(ctx, email, password);
        // The sign-up session is not what the scenario is about.
        world.sessionOf.delete(email);
        before = world.sessionOf.size;
      }
    );
    When('{string} signs in with the password {string}', signsIn);
    Then('sign-in fails with INVALID_CREDENTIALS', () => {
      expect(world.last && !world.last.ok && world.last.err.type).toBe('INVALID_CREDENTIALS');
    });
    And('no session exists for {string}', (_ctx: unknown, email: string) => {
      expect(world.sessionOf.has(email)).toBe(false);
      expect(world.sessionOf.size).toBe(before);
    });
  });

  Scenario('Signing up twice with the same email is refused', ({ Given, When, Then }) => {
    Given('{string} signed up with the password {string}', signedUp);
    When('{string} signs up with the password {string}', signsUp);
    Then('sign-up fails with EMAIL_TAKEN', () => {
      expect(world.last && !world.last.ok && world.last.err.type).toBe('EMAIL_TAKEN');
    });
  });
});
