/**
 * Step definitions for features/bio.feature — who may write a learner's bio
 * and what it records.
 */

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { featurePath } from '@glib-glub/testing';
import { expect } from 'vitest';

import { setBio } from './bio';
import { profileWorld, type ProfileWorld } from './testing';

const feature = await loadFeature(featurePath(import.meta.url, 'bio.feature'));

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
    const g = await world.identity.store.upsertGuardianship({
      guardianId: await world.userIdOf(guardian),
      learnerId: await world.userIdOf(learner),
      status: 'accepted',
    });
    expect(g.ok).toBe(true);
  };
  const setsOwnBio = async (_ctx: unknown, email: string, about: string, styles?: string) => {
    const id = await world.userIdOf(email);
    world.last = await setBio(
      world,
      { actorId: id, learnerId: id },
      {
        about,
        ...(styles ? { learningStyles: styles.split(',').map((s) => s.trim()) } : {}),
      }
    );
  };
  const setsBioOf = async (_ctx: unknown, actor: string, learner: string, about: string) => {
    world.last = await setBio(
      world,
      { actorId: await world.userIdOf(actor), learnerId: await world.userIdOf(learner) },
      { about }
    );
  };
  const bioSays = async (_ctx: unknown, email: string, about: string) => {
    const profile = await world.store.getProfile(await world.userIdOf(email));
    expect(profile.ok && profile.val?.about).toBe(about);
  };
  const failsWith = (_ctx: unknown, tag: string) => {
    expect(world.last && !world.last.ok && world.last.err?.type).toBe(tag);
  };

  Scenario('A learner writes their own bio', ({ Given, When, Then, And }) => {
    Given('{string} is a learner with the age band {string}', isLearner);
    When('{string} sets their bio to {string} with learning styles {string}', setsOwnBio);
    Then('the bio of {string} says {string}', bioSays);
    And(
      'the learning styles of {string} are {string}',
      async (_ctx: unknown, email: string, styles: string) => {
        const profile = await world.store.getProfile(await world.userIdOf(email));
        expect(profile.ok && profile.val?.learningStyles).toEqual(
          styles.split(',').map((s) => s.trim())
        );
      }
    );
  });

  Scenario("A young learner's guardian writes the bio", ({ Given, When, Then, And }) => {
    Given('{string} is a learner with the age band {string}', isLearner);
    And('{string} is an accepted guardian of {string}', acceptedGuardian);
    When('{string} sets the bio of {string} to {string}', setsBioOf);
    Then('the bio of {string} says {string}', bioSays);
  });

  Scenario('A young learner cannot write their own bio', ({ Given, When, Then }) => {
    Given('{string} is a learner with the age band {string}', isLearner);
    When('{string} sets their bio to {string}', setsOwnBio);
    Then('the change fails with FORBIDDEN', (ctx: unknown) => failsWith(ctx, 'FORBIDDEN'));
  });

  Scenario("A stranger cannot write someone else's bio", ({ Given, When, Then, And }) => {
    Given('{string} is a learner with the age band {string}', isLearner);
    And('{string} is a learner with the age band {string}', isLearner);
    When('{string} sets the bio of {string} to {string}', setsBioOf);
    Then('the change fails with FORBIDDEN', (ctx: unknown) => failsWith(ctx, 'FORBIDDEN'));
  });
});
