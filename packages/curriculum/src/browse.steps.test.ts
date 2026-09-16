/**
 * Step definitions for features/browse.feature — the catalogue tree and
 * who sees which tracks in a subject.
 */

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { featurePath } from '@glib-glub/testing';
import { expect } from 'vitest';

import { createTrack, publishTrack, addUnit, addLesson } from './authoring';
import { browseSubject, ensureSubject, listCatalogue, type CatalogueEntry } from './catalogue';
import { curriculumWorld, type CurriculumWorld } from './testing';
import type { Track } from './types';

const feature = await loadFeature(featurePath(import.meta.url, 'browse.feature'));

describeFeature(feature, ({ Scenario, Background }) => {
  let world: CurriculumWorld;
  let catalogue: CatalogueEntry[] = [];
  let seen: Track[] = [];

  Background(({ Given, And }) => {
    Given(
      'the category {string} with the subject {string}',
      async (_ctx: unknown, category: string, subject: string) => {
        world = curriculumWorld();
        seen = [];
        void (await ensureSubject(world.store, category, subject));
      }
    );
    And(
      'the category {string} with the subject {string}',
      async (_ctx: unknown, category: string, subject: string) => {
        void (await ensureSubject(world.store, category, subject));
      }
    );
  });

  const subjectIdOf = async (name: string) => {
    const subject = await ensureSubject(world.store, 'Any', name);
    return subject.ok ? subject.val.id : undefined;
  };

  const educatorTrack = async (
    _ctx: unknown,
    email: string,
    title: string,
    subject: string,
    publish: boolean
  ) => {
    const educator = await world.person(email, 'educator');
    const id = await subjectIdOf(subject);
    expect(id).toBeDefined();
    if (!id) return;
    const track = await createTrack(world, educator, { subjectId: id, title });
    expect(track.ok).toBe(true);
    if (!track.ok) return;
    if (publish) {
      const unit = await addUnit(world, educator, { trackId: track.val.id, title: 'Unit 1' });
      if (unit.ok)
        void (await addLesson(world, educator, {
          trackId: track.val.id,
          unitId: unit.val.id,
          title: 'Lesson 1',
        }));
      void (await publishTrack(world, educator, track.val.id));
    }
  };
  const published = (ctx: unknown, email: string, title: string, subject: string) =>
    educatorTrack(ctx, email, title, subject, true);
  const draft = (ctx: unknown, email: string, title: string, subject: string) =>
    educatorTrack(ctx, email, title, subject, false);
  const browses = async (_ctx: unknown, email: string, subject: string) => {
    const viewer = await world.person(email);
    const id = await subjectIdOf(subject);
    const result = id
      ? await browseSubject(world.store, { viewerId: viewer, subjectId: id })
      : undefined;
    seen = result?.ok ? result.val : [];
  };
  const sees = (_ctx: unknown, title: string) => {
    expect(seen.map((track) => track.title)).toContain(title);
  };

  Scenario('Categories and their subjects are listed', ({ When, Then, And }) => {
    When('the categories are listed', async () => {
      const result = await listCatalogue(world.store);
      catalogue = result.ok ? result.val : [];
    });
    const contains = (_ctx: unknown, category: string, subject: string) => {
      const entry = catalogue.find((candidate) => candidate.category.name === category);
      expect(entry?.subjects.map((s) => s.name)).toContain(subject);
    };
    Then('the list contains {string} with the subject {string}', contains);
    And('the list contains {string} with the subject {string}', contains);
  });

  Scenario('Only published tracks appear in a subject', ({ Given, When, Then, And }) => {
    Given('the educator {string} has a published track {string} in {string}', published);
    And('the educator {string} has a draft track {string} in {string}', draft);
    When('the learner {string} browses {string}', browses);
    Then('she sees the track {string}', sees);
    And('she does not see the track {string}', (_ctx: unknown, title: string) => {
      expect(seen.map((track) => track.title)).not.toContain(title);
    });
  });

  Scenario('An author sees their own draft', ({ Given, When, Then }) => {
    Given('the educator {string} has a draft track {string} in {string}', draft);
    When('the educator {string} browses {string}', browses);
    Then('she sees the track {string}', sees);
  });
});
