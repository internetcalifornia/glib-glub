/**
 * Step definitions for features/age-bands.feature — the band decides who
 * manages objectives and whether Facebook may be self-linked; a guardian is
 * not subject to the learner's band.
 */

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { featurePath } from '@glib-glub/testing';
import { expect } from 'vitest';

import { canManageOwnObjectives, parseAgeBand } from './age-band';
import { linkLogin } from './linking';
import { identityWorld, type IdentityWorld } from './testing';
import type { Provider } from './types';

const feature = await loadFeature(featurePath(import.meta.url, 'age-bands.feature'));

function asProvider(value: string): Provider {
  return value === 'facebook' || value === 'google' || value === 'microsoft' ? value : 'credential';
}

describeFeature(feature, ({ Scenario, ScenarioOutline, BeforeEachScenario }) => {
  let world: IdentityWorld;
  BeforeEachScenario(() => {
    world = identityWorld();
  });

  const signsUp = async (_ctx: unknown, email: string, password: string) => {
    await world.signUp(email, password);
  };
  const hasBand = async (_ctx: unknown, email: string, band: string) => {
    const parsed = parseAgeBand(band);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) void (await world.store.setAgeBand(await world.userIdOf(email), parsed.val));
  };
  const isSignedIn = (_ctx: unknown, email: string) => {
    expect(world.sessionOf.has(email)).toBe(true);
  };
  const linksOwn = async (_ctx: unknown, provider: string, providerAccountId: string) => {
    // "she" is whoever signed in last in this scenario.
    const email = [...world.sessionOf.keys()].at(-1) ?? '';
    const me = world.signedIn(email).userId;
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

  ScenarioOutline(
    'The age band decides who may manage objectives',
    ({ Given, Then, And }, variables) => {
      Given('{string} signed up with the password {string}', signsUp);
      // Outline placeholders reach the step as literal <band>; the value is in variables.
      And('{string} has the age band {string}', (ctx: unknown, email: string) =>
        hasBand(ctx, email, String(variables.band))
      );
      Then('{string} <may> manage their own objectives', async (_ctx: unknown, email: string) => {
        const band = await world.store.getAgeBand(await world.userIdOf(email));
        expect(band.ok && canManageOwnObjectives(band.val)).toBe(variables.may === 'may');
      });
    }
  );

  Scenario('A young learner cannot link Facebook themselves', ({ Given, When, Then, And }) => {
    Given('{string} signed up with the password {string}', signsUp);
    And('{string} has the age band {string}', hasBand);
    And('{string} is signed in', isSignedIn);
    When('she links a {string} login with provider account {string}', linksOwn);
    Then('linking fails with PROVIDER_NOT_ALLOWED_FOR_AGE', () => {
      expect(world.last && !world.last.ok && world.last.err.type).toBe(
        'PROVIDER_NOT_ALLOWED_FOR_AGE'
      );
    });
    And('{string} has exactly {int} linked login', loginCount);
  });

  Scenario('A guardian may link Facebook for a young learner', ({ Given, When, Then, And }) => {
    Given('{string} signed up with the password {string}', signsUp);
    And('{string} has the age band {string}', hasBand);
    And(
      '{string} is an accepted guardian of {string}',
      async (_ctx: unknown, guardian: string, learner: string) => {
        await world.signUp(guardian, 'correct horse battery');
        const accepted = await world.store.upsertGuardianship({
          guardianId: await world.userIdOf(guardian),
          learnerId: await world.userIdOf(learner),
          status: 'accepted',
        });
        expect(accepted.ok).toBe(true);
      }
    );
    When(
      '{string} links a {string} login with provider account {string} for {string}',
      async (
        _ctx: unknown,
        guardian: string,
        provider: string,
        providerAccountId: string,
        learner: string
      ) => {
        world.last = await linkLogin(world, {
          actorId: await world.userIdOf(guardian),
          targetUserId: await world.userIdOf(learner),
          provider: asProvider(provider),
          providerAccountId,
        });
        expect(world.last.ok).toBe(true);
      }
    );
    Then('{string} has exactly {int} linked logins', loginCount);
  });

  Scenario('An adult learner may link Facebook', ({ Given, When, Then, And }) => {
    Given('{string} signed up with the password {string}', signsUp);
    And('{string} has the age band {string}', hasBand);
    And('{string} is signed in', isSignedIn);
    When('she links a {string} login with provider account {string}', linksOwn);
    Then('{string} has exactly {int} linked logins', loginCount);
  });
});
