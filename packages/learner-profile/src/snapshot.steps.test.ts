/**
 * Step definitions for features/snapshot.feature — what the snapshot
 * gathers, how its version behaves, and what it never contains.
 */

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { featurePath } from '@glib-glub/testing';
import { expect } from 'vitest';

import { setBio } from './bio';
import { addObjective } from './objectives';
import { rebuildSnapshot } from './snapshot';
import { profileWorld, type ProfileWorld } from './testing';
import type { Snapshot } from './types';
import { uploadWork } from './uploads';

const feature = await loadFeature(featurePath(import.meta.url, 'snapshot.feature'));

const MAYA = 'maya@example.com';
const encode = (text: string) => new TextEncoder().encode(text);

describeFeature(feature, ({ Scenario, Background }) => {
  let world: ProfileWorld;
  let snapshot: Snapshot | undefined;

  Background(({ Given }) => {
    Given(
      '{string} is a learner with the age band {string}',
      async (_ctx: unknown, email: string, band: string) => {
        world = profileWorld();
        snapshot = undefined;
        await world.learner(email, band);
      }
    );
  });

  const hasBio = async (_ctx: unknown, email: string, about: string, styles: string) => {
    const id = await world.userIdOf(email);
    void (await setBio(
      world,
      { actorId: id, learnerId: id },
      { about, learningStyles: styles.split(',') }
    ));
  };
  const hasObjective = async (_ctx: unknown, email: string, title: string) => {
    const id = await world.userIdOf(email);
    void (await addObjective(world, { actorId: id, learnerId: id }, { title }));
  };
  const uploaded = async (_ctx: unknown, email: string, fileName: string, text: string) => {
    const id = await world.userIdOf(email);
    void (await uploadWork(
      world,
      { actorId: id, learnerId: id },
      { fileName, mimeType: 'text/plain', bytes: encode(text) }
    ));
  };
  const rebuilt = async (_ctx: unknown, email: string) => {
    const result = await rebuildSnapshot(world, await world.userIdOf(email));
    expect(result.ok).toBe(true);
    if (result.ok) snapshot = result.val;
  };
  const versionIs = (_ctx: unknown, version: number) => {
    expect(snapshot?.version).toBe(version);
  };
  const text = () => JSON.stringify(snapshot?.content ?? {});

  Scenario(
    'The snapshot gathers bio, objectives and upload summaries',
    ({ Given, When, Then, And }) => {
      Given('{string} has the bio {string} with learning styles {string}', hasBio);
      And('{string} has the objective {string}', hasObjective);
      And('{string} uploaded {string} containing {string}', uploaded);
      When('the snapshot of {string} is rebuilt', rebuilt);
      Then('the snapshot mentions {string}', (_ctx: unknown, phrase: string) => {
        expect(text()).toContain(phrase);
      });
      And('the snapshot lists the objective {string}', (_ctx: unknown, title: string) => {
        expect(snapshot?.content.objectives.map((o) => o.title)).toContain(title);
      });
      And('the snapshot includes {int} upload summary', (_ctx: unknown, count: number) => {
        expect(snapshot?.content.uploads.length).toBe(count);
      });
      And('the snapshot version is {int}', versionIs);
    }
  );

  Scenario('Rebuilding from unchanged inputs keeps the version', ({ Given, When, Then, And }) => {
    Given('{string} has the bio {string} with learning styles {string}', hasBio);
    And('the snapshot of {string} was rebuilt', rebuilt);
    When('the snapshot of {string} is rebuilt', rebuilt);
    Then('the snapshot version is {int}', versionIs);
  });

  Scenario('A changed input bumps the version', ({ Given, When, Then, And }) => {
    Given('{string} has the bio {string} with learning styles {string}', hasBio);
    And('the snapshot of {string} was rebuilt', rebuilt);
    When('{string} adds the objective {string} for themselves', hasObjective);
    And('the snapshot of {string} is rebuilt', rebuilt);
    Then('the snapshot version is {int}', versionIs);
  });

  Scenario('The snapshot never carries raw upload text', ({ Given, When, Then }) => {
    Given('{string} uploaded {string} containing {string}', uploaded);
    When('the snapshot of {string} is rebuilt', rebuilt);
    Then('the snapshot does not mention {string}', (_ctx: unknown, phrase: string) => {
      expect(text()).not.toContain(phrase);
      expect(snapshot?.content.uploads.length).toBe(1);
      expect(MAYA).toBe('maya@example.com');
    });
  });
});
