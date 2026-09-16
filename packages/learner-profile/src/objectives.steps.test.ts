/**
 * Step definitions for features/objectives.feature — who may set
 * objectives, how they move out of the active list, and the cap.
 */

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { featurePath } from '@glib-glub/testing';
import { expect } from 'vitest';

import { addObjective, listObjectives, setObjectiveStatus } from './objectives';
import { profileWorld, type ProfileWorld } from './testing';

const feature = await loadFeature(featurePath(import.meta.url, 'objectives.feature'));

describeFeature(feature, ({ Scenario, BeforeEachScenario }) => {
  let world: ProfileWorld;
  BeforeEachScenario(() => {
    world = profileWorld();
  });

  const isLearner = async (_ctx: unknown, email: string, band: string) => {
    await world.learner(email, band);
  };
  const acceptedGuardian = async (_ctx: unknown, guardian: string, learner: string) => {
    await world.learner(guardian, 'adult');
    void (await world.identity.store.upsertGuardianship({
      guardianId: await world.userIdOf(guardian),
      learnerId: await world.userIdOf(learner),
      status: 'accepted',
    }));
  };
  const addsForSelf = async (_ctx: unknown, email: string, title: string) => {
    const id = await world.userIdOf(email);
    world.last = await addObjective(world, { actorId: id, learnerId: id }, { title });
  };
  const addsFor = async (_ctx: unknown, actor: string, title: string, learner: string) => {
    world.last = await addObjective(
      world,
      { actorId: await world.userIdOf(actor), learnerId: await world.userIdOf(learner) },
      { title }
    );
  };
  const countWithStatus = async (_ctx: unknown, email: string, count: number, status: string) => {
    const list = await listObjectives(world, await world.userIdOf(email));
    expect(list.ok && list.val.filter((o) => o.status === status).length).toBe(count);
  };
  const activeCount = (ctx: unknown, email: string, count: number) =>
    countWithStatus(ctx, email, count, 'active');
  const setBy = async (_ctx: unknown, email: string) => {
    const setter = await world.userIdOf(email);
    expect(
      world.last?.ok &&
        'val' in world.last &&
        typeof world.last.val === 'object' &&
        world.last.val &&
        'setBy' in world.last.val &&
        world.last.val.setBy
    ).toBe(setter);
  };
  const failsWith = (_ctx: unknown, tag: string) => {
    expect(world.last && !world.last.ok && world.last.err?.type).toBe(tag);
  };

  Scenario('An adult learner sets their own objective', ({ Given, When, Then, And }) => {
    Given('{string} is a learner with the age band {string}', isLearner);
    When('{string} adds the objective {string} for themselves', addsForSelf);
    Then('{string} has {int} active objective', activeCount);
    And('that objective was set by {string}', setBy);
  });

  Scenario('A guardian sets an objective for a young learner', ({ Given, When, Then, And }) => {
    Given('{string} is a learner with the age band {string}', isLearner);
    And('{string} is an accepted guardian of {string}', acceptedGuardian);
    When('{string} adds the objective {string} for {string}', addsFor);
    Then('{string} has {int} active objective', activeCount);
    And('that objective was set by {string}', setBy);
  });

  Scenario('A young learner cannot set their own objective', ({ Given, When, Then }) => {
    Given('{string} is a learner with the age band {string}', isLearner);
    When('{string} adds the objective {string} for themselves', addsForSelf);
    Then('the change fails with FORBIDDEN', (ctx: unknown) => failsWith(ctx, 'FORBIDDEN'));
  });

  Scenario(
    'Achieving an objective moves it out of the active list',
    ({ Given, When, Then, And }) => {
      Given('{string} is a learner with the age band {string}', isLearner);
      And('{string} has the objective {string}', addsForSelf);
      When(
        '{string} marks the objective {string} as achieved',
        async (_ctx: unknown, email: string, title: string) => {
          const id = await world.userIdOf(email);
          const list = await listObjectives(world, id);
          const target = list.ok ? list.val.find((o) => o.title === title) : undefined;
          expect(target).toBeDefined();
          if (target)
            world.last = await setObjectiveStatus(
              world,
              { actorId: id, learnerId: id },
              target.id,
              'achieved'
            );
        }
      );
      Then('{string} has {int} active objectives', activeCount);
      And('{string} has {int} achieved objective', (ctx: unknown, email: string, count: number) =>
        countWithStatus(ctx, email, count, 'achieved')
      );
    }
  );

  Scenario('There is a limit on active objectives', ({ Given, When, Then, And }) => {
    Given('{string} is a learner with the age band {string}', isLearner);
    And(
      '{string} has {int} active objectives',
      async (_ctx: unknown, email: string, count: number) => {
        for (let i = 0; i < count; i += 1) await addsForSelf(_ctx, email, `Objective ${i + 1}`);
        const list = await listObjectives(world, await world.userIdOf(email));
        expect(list.ok && list.val.length).toBe(count);
      }
    );
    When('{string} adds the objective {string} for themselves', addsForSelf);
    Then('the change fails with TOO_MANY_OBJECTIVES', (ctx: unknown) =>
      failsWith(ctx, 'TOO_MANY_OBJECTIVES')
    );
  });
});
