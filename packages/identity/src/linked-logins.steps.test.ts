/**
 * Step definitions for features/linked-logins.feature — the one-account,
 * many-logins policy: linking from a session, unlinking all but the last,
 * and how a social sign-in joins (or refuses to join) an existing account.
 */

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { featurePath } from '@glib-glub/testing';
import { expect } from 'vitest';

import { linkLogin, resolveSocialSignIn, unlinkLogin } from './linking';
import { identityWorld, type IdentityWorld } from './testing';
import type { Provider, SocialProvider } from './types';

const feature = await loadFeature(featurePath(import.meta.url, 'linked-logins.feature'));

const MAYA = 'maya@example.com';

function asProvider(value: string): Provider {
  // The feature file only ever names real providers; anything else is a
  // typo the assertion below will surface.
  return value === 'google' ||
    value === 'microsoft' ||
    value === 'facebook' ||
    value === 'credential' ||
    value === 'passkey'
    ? value
    : 'credential';
}

function asSocial(value: string): SocialProvider {
  return value === 'google' || value === 'microsoft' || value === 'facebook' ? value : 'google';
}

describeFeature(feature, ({ Scenario, Background }) => {
  let world: IdentityWorld;

  // The Background runs first in every scenario, before any per-scenario
  // hook, so the fresh world is created here.
  Background(({ Given }) => {
    Given(
      '{string} signed up with the password {string}',
      async (_ctx: unknown, email: string, password: string) => {
        world = identityWorld();
        await world.signUp(email, password);
      }
    );
  });

  const isSignedIn = (_ctx: unknown, email: string) => {
    expect(world.sessionOf.has(email)).toBe(true);
  };
  const linksOwn = async (_ctx: unknown, provider: string, providerAccountId: string) => {
    const me = world.signedIn(MAYA).userId;
    world.last = await linkLogin(world, {
      actorId: me,
      targetUserId: me,
      provider: asProvider(provider),
      providerAccountId,
    });
  };
  const loginCount = async (_ctx: unknown, email: string, count: number) => {
    const logins = await world.store.listLogins(await world.userIdOf(email));
    expect(logins.ok && logins.val.length).toBe(count);
  };
  const unlinks = async (_ctx: unknown, provider: string) => {
    const me = world.signedIn(MAYA).userId;
    const logins = await world.store.listLogins(me);
    const target = logins.ok ? logins.val.find((login) => login.provider === provider) : undefined;
    world.last = await unlinkLogin(world, { actorId: me, loginId: target?.id ?? 'missing' });
  };
  const socialSignIn = async (
    _ctx: unknown,
    email: string,
    provider: string,
    providerAccountId: string
  ) => {
    world.last = await resolveSocialSignIn(world, {
      provider: asSocial(provider),
      providerAccountId,
      email,
      name: 'Maya',
      emailVerified: true,
    });
  };

  Scenario('A social login links to the signed-in account', ({ Given, When, Then, And }) => {
    Given('{string} is signed in', isSignedIn);
    When('she links a {string} login with provider account {string}', linksOwn);
    Then('{string} has exactly {int} linked logins', loginCount);
    And(
      'one of them is {string} account {string}',
      async (_ctx: unknown, provider: string, id: string) => {
        const logins = await world.store.listLogins(world.signedIn(MAYA).userId);
        expect(
          logins.ok && logins.val.some((l) => l.provider === provider && l.providerAccountId === id)
        ).toBe(true);
      }
    );
  });

  Scenario('A second social login links too', ({ Given, When, Then, And }) => {
    Given('{string} is signed in', isSignedIn);
    And('she linked a {string} login with provider account {string}', linksOwn);
    When('she links a {string} login with provider account {string}', linksOwn);
    Then('{string} has exactly {int} linked logins', loginCount);
  });

  Scenario('Unlinking a login keeps the account', ({ Given, When, Then, And }) => {
    Given('{string} is signed in', isSignedIn);
    And('she linked a {string} login with provider account {string}', linksOwn);
    When('she unlinks the {string} login', unlinks);
    Then('{string} has exactly {int} linked login', loginCount);
    And('an account exists for {string}', async (_ctx: unknown, email: string) => {
      const user = await world.store.findUserByEmail(email);
      expect(user.ok && user.val?.email).toBe(email);
    });
  });

  Scenario('The last login cannot be unlinked', ({ Given, When, Then, And }) => {
    Given('{string} is signed in', isSignedIn);
    When('she unlinks the {string} login', unlinks);
    Then('unlinking fails with LAST_LOGIN', () => {
      expect(world.last && !world.last.ok && world.last.err.type).toBe('LAST_LOGIN');
    });
    And('{string} has exactly {int} linked login', loginCount);
  });

  Scenario(
    'A social sign-in with a trusted provider and a matching email joins the existing account',
    ({ When, Then, And }) => {
      When('{string} signs in through {string} as provider account {string}', socialSignIn);
      Then('{string} has exactly {int} linked logins', loginCount);
      And('there is only one account for {string}', async (_ctx: unknown, email: string) => {
        const resolved = world.last;
        const byEmail = await world.store.findUserByEmail(email);
        expect(resolved?.ok && byEmail.ok && byEmail.val?.id === resolved.val).toBe(false);
        expect(resolved?.ok && byEmail.ok && byEmail.val?.id).toBe(
          resolved?.ok && typeof resolved.val === 'object' && resolved.val && 'id' in resolved.val
            ? resolved.val.id
            : undefined
        );
      });
    }
  );

  Scenario(
    'A social sign-in with an untrusted provider does not silently join an account',
    ({ When, Then, And }) => {
      When('{string} signs in through {string} as provider account {string}', socialSignIn);
      Then('sign-in fails with LINK_REQUIRES_SESSION', () => {
        expect(world.last && !world.last.ok && world.last.err.type).toBe('LINK_REQUIRES_SESSION');
      });
      And('{string} has exactly {int} linked login', loginCount);
    }
  );
});
