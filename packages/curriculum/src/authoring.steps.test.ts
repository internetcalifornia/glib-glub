/**
 * Step definitions for features/authoring.feature — who may author, how
 * units and lessons order themselves, and what publishing requires.
 */

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { brandId } from '@glib-glub/core';
import { featurePath } from '@glib-glub/testing';
import { expect } from 'vitest';

import { addLesson, addUnit, createTrack, getOutline, publishTrack } from './authoring';
import { ensureSubject } from './catalogue';
import { curriculumWorld, type CurriculumWorld } from './testing';

const feature = await loadFeature(featurePath(import.meta.url, 'authoring.feature'));

describeFeature(feature, ({ Scenario, Background }) => {
  let world: CurriculumWorld;

  Background(({ Given }) => {
    Given(
      'the category {string} with the subject {string}',
      async (_ctx: unknown, category: string, subject: string) => {
        world = curriculumWorld();
        void (await ensureSubject(world.store, category, subject));
      }
    );
  });

  const isEducator = async (_ctx: unknown, email: string) => {
    await world.person(email, 'educator');
  };
  const isLearner = async (_ctx: unknown, email: string) => {
    await world.person(email);
  };
  const subjectIdOf = async (name: string) => {
    const subject = await ensureSubject(world.store, 'Any', name);
    return subject.ok ? subject.val.id : undefined;
  };
  const creates = async (_ctx: unknown, email: string, title: string, subject: string) => {
    const id = await subjectIdOf(subject);
    if (!id) return;
    world.last = await createTrack(world, await world.userIdOf(email), { subjectId: id, title });
  };
  const addsUnit = async (_ctx: unknown, email: string, unitTitle: string, trackTitle: string) => {
    const track = await world.trackByTitle(trackTitle);
    world.last = await addUnit(world, await world.userIdOf(email), {
      trackId: track?.id ?? brandId<'track'>(''),
      title: unitTitle,
    });
  };
  const addsLesson = async (
    _ctx: unknown,
    email: string,
    lessonTitle: string,
    unitTitle: string,
    trackTitle: string
  ) => {
    const track = await world.trackByTitle(trackTitle);
    if (!track) return;
    const units = await world.store.listUnits(track.id);
    const unit = units.ok ? units.val.find((u) => u.title === unitTitle) : undefined;
    if (!unit) return;
    world.last = await addLesson(world, await world.userIdOf(email), {
      trackId: track.id,
      unitId: unit.id,
      title: lessonTitle,
    });
  };
  const publishes = async (_ctx: unknown, email: string, title: string) => {
    const track = await world.trackByTitle(title);
    if (!track) return;
    world.last = await publishTrack(world, await world.userIdOf(email), track.id);
  };
  const existsWith = async (_ctx: unknown, title: string, visibility: string) => {
    expect((await world.trackByTitle(title))?.visibility).toBe(visibility);
  };
  const failsWith = (_ctx: unknown, tag: string) => {
    expect(world.last && !world.last.ok && world.last.err?.type).toBe(tag);
  };

  Scenario('An educator creates a draft track', ({ Given, When, Then, And }) => {
    Given('{string} is an educator', isEducator);
    When('{string} creates the track {string} in {string}', creates);
    Then('the track {string} exists with the visibility {string}', existsWith);
    And(
      'the track {string} was authored by {string}',
      async (_ctx: unknown, title: string, email: string) => {
        expect((await world.trackByTitle(title))?.authoredBy).toBe(await world.userIdOf(email));
      }
    );
  });

  Scenario('A learner cannot create a track', ({ Given, When, Then }) => {
    Given('{string} is a learner', isLearner);
    When('{string} creates the track {string} in {string}', creates);
    Then('the change fails with FORBIDDEN', (ctx: unknown) => failsWith(ctx, 'FORBIDDEN'));
  });

  Scenario('Units and lessons are added in order', ({ Given, When, Then, And }) => {
    Given('{string} is an educator', isEducator);
    And('{string} created the track {string} in {string}', creates);
    When(
      '{string} adds the units {string} to {string}',
      async (ctx: unknown, email: string, titles: string, trackTitle: string) => {
        for (const title of titles.split(', ')) await addsUnit(ctx, email, title, trackTitle);
      }
    );
    And(
      '{string} adds the lessons {string} to the unit {string} of {string}',
      async (
        ctx: unknown,
        email: string,
        titles: string,
        unitTitle: string,
        trackTitle: string
      ) => {
        for (const title of titles.split(', '))
          await addsLesson(ctx, email, title, unitTitle, trackTitle);
      }
    );
    Then(
      'the track {string} has the units {string}',
      async (_ctx: unknown, title: string, units: string) => {
        const track = await world.trackByTitle(title);
        const outline = track ? await getOutline(world, track.id) : undefined;
        expect(outline?.ok && outline.val.units.map((u) => u.title)).toEqual(units.split(', '));
      }
    );
    And(
      'the unit {string} of {string} has the lessons {string}',
      async (_ctx: unknown, unitTitle: string, title: string, lessons: string) => {
        const track = await world.trackByTitle(title);
        const outline = track ? await getOutline(world, track.id) : undefined;
        const unit = outline?.ok ? outline.val.units.find((u) => u.title === unitTitle) : undefined;
        expect(unit?.lessons.map((l) => l.title)).toEqual(lessons.split(', '));
      }
    );
  });

  Scenario('Only the author edits a draft', ({ Given, When, Then, And }) => {
    Given('{string} is an educator', isEducator);
    And('{string} is an educator', isEducator);
    And('{string} created the track {string} in {string}', creates);
    When('{string} adds the unit {string} to {string}', addsUnit);
    Then('the change fails with FORBIDDEN', (ctx: unknown) => failsWith(ctx, 'FORBIDDEN'));
  });

  Scenario('An empty track cannot be published', ({ Given, When, Then, And }) => {
    Given('{string} is an educator', isEducator);
    And('{string} created the track {string} in {string}', creates);
    When('{string} publishes the track {string}', publishes);
    Then('the change fails with TRACK_EMPTY', (ctx: unknown) => failsWith(ctx, 'TRACK_EMPTY'));
  });

  Scenario('A track with a lesson publishes', ({ Given, When, Then, And }) => {
    Given('{string} is an educator', isEducator);
    And('{string} created the track {string} in {string}', creates);
    And(
      '{string} added the unit {string} with the lesson {string} to {string}',
      async (
        ctx: unknown,
        email: string,
        unitTitle: string,
        lessonTitle: string,
        trackTitle: string
      ) => {
        await addsUnit(ctx, email, unitTitle, trackTitle);
        await addsLesson(ctx, email, lessonTitle, unitTitle, trackTitle);
      }
    );
    When('{string} publishes the track {string}', publishes);
    Then('the track {string} exists with the visibility {string}', existsWith);
  });
});
