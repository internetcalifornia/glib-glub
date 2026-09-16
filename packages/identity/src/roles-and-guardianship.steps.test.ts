/**
 * Step definitions for features/roles-and-guardianship.feature — the
 * default learner role, admin-only grants, and the invite → accept flow
 * that makes someone a guardian.
 */

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { featurePath } from '@glib-glub/testing';
import { expect } from 'vitest';

import { acceptGuardianship, inviteLearner, isGuardianOf } from './guardianship';
import { grantRole, hasRole } from './roles';
import { identityWorld, type IdentityWorld } from './testing';
import { ROLES, type Role } from './types';

const feature = await loadFeature(featurePath(import.meta.url, 'roles-and-guardianship.feature'));

function asRole(value: string): Role {
  return ROLES.find((role) => role === value) ?? 'learner';
}

describeFeature(feature, ({ Scenario, BeforeEachScenario }) => {
  let world: IdentityWorld;
  BeforeEachScenario(() => {
    world = identityWorld();
  });

  const signsUp = async (_ctx: unknown, email: string, password: string) => {
    await world.signUp(email, password);
  };
  const hasTheRole = async (_ctx: unknown, email: string, role: string) => {
    const result = await hasRole(world, await world.userIdOf(email), asRole(role));
    expect(result.ok && result.val).toBe(true);
  };
  const lacksTheRole = async (_ctx: unknown, email: string, role: string) => {
    const result = await hasRole(world, await world.userIdOf(email), asRole(role));
    expect(result.ok && result.val).toBe(false);
  };
  const isAdmin = async (_ctx: unknown, email: string) => {
    await world.signUp(email, 'correct horse battery');
    const added = await world.store.addRole(await world.userIdOf(email), 'admin');
    expect(added.ok).toBe(true);
  };
  const grants = async (_ctx: unknown, actor: string, target: string, role: string) => {
    world.last = await grantRole(world, {
      actorId: await world.userIdOf(actor),
      targetUserId: await world.userIdOf(target),
      role: asRole(role),
    });
  };
  const invites = async (_ctx: unknown, guardian: string, learner: string) => {
    world.last = await inviteLearner(world, {
      guardianId: await world.userIdOf(guardian),
      learnerId: await world.userIdOf(learner),
    });
  };
  const statusIs = async (_ctx: unknown, guardian: string, learner: string, status: string) => {
    const g = await world.store.getGuardianship(
      await world.userIdOf(guardian),
      await world.userIdOf(learner)
    );
    expect(g.ok && g.val?.status).toBe(status);
  };
  const guardianOf = async (_ctx: unknown, guardian: string, learner: string) => {
    const result = await isGuardianOf(
      world,
      await world.userIdOf(guardian),
      await world.userIdOf(learner)
    );
    expect(result.ok && result.val).toBe(true);
  };

  Scenario('A new account is a learner by default', ({ When, Then, And }) => {
    When('{string} signs up with the password {string}', signsUp);
    Then('{string} has the role {string}', hasTheRole);
    And('{string} does not have the role {string}', lacksTheRole);
  });

  Scenario('An admin grants the educator role', ({ Given, When, Then, And }) => {
    Given('{string} signed up with the password {string}', signsUp);
    And('{string} is an admin', isAdmin);
    When('{string} grants {string} the role {string}', grants);
    Then('{string} has the role {string}', hasTheRole);
  });

  Scenario('A learner cannot grant roles', ({ Given, When, Then, And }) => {
    Given('{string} signed up with the password {string}', signsUp);
    And('{string} signed up with the password {string}', signsUp);
    When('{string} grants {string} the role {string}', grants);
    Then('granting fails with FORBIDDEN', () => {
      expect(world.last && !world.last.ok && world.last.err.type).toBe('FORBIDDEN');
    });
  });

  Scenario('A guardian invites a learner', ({ Given, When, Then, And }) => {
    Given('{string} signed up with the password {string}', signsUp);
    And('{string} signed up with the password {string}', signsUp);
    When('{string} invites {string} as their learner', invites);
    Then('the guardianship between {string} and {string} is {string}', statusIs);
  });

  Scenario('The learner accepts and the guardian becomes one', ({ Given, When, Then, And }) => {
    Given('{string} signed up with the password {string}', signsUp);
    And('{string} signed up with the password {string}', signsUp);
    And('{string} invited {string} as their learner', invites);
    When(
      '{string} accepts the guardianship from {string}',
      async (_ctx: unknown, learner: string, guardian: string) => {
        const learnerId = await world.userIdOf(learner);
        world.last = await acceptGuardianship(world, {
          actorId: learnerId,
          guardianId: await world.userIdOf(guardian),
          learnerId,
        });
      }
    );
    Then('the guardianship between {string} and {string} is {string}', statusIs);
    And('{string} has the role {string}', hasTheRole);
    And('{string} is a guardian of {string}', guardianOf);
  });

  Scenario('An unaccepted invitation grants nothing', ({ Given, Then, And }) => {
    Given('{string} signed up with the password {string}', signsUp);
    And('{string} signed up with the password {string}', signsUp);
    And('{string} invited {string} as their learner', invites);
    Then(
      '{string} is not a guardian of {string}',
      async (_ctx: unknown, guardian: string, learner: string) => {
        const result = await isGuardianOf(
          world,
          await world.userIdOf(guardian),
          await world.userIdOf(learner)
        );
        expect(result.ok && result.val).toBe(false);
      }
    );
  });
});
