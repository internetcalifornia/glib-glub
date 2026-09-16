/**
 * Step definitions for features/enrollment-and-pacing.feature — enrolling,
 * the plan, what is due, and falling behind.
 */

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { brandId } from '@glib-glub/core';
import { featurePath } from '@glib-glub/testing';
import { expect } from 'vitest';

import {
  addLesson,
  addUnit,
  createTrack,
  getOutline,
  lessonsInOrder,
  publishTrack,
} from './authoring';
import { ensureSubject } from './catalogue';
import { completeLesson, enroll, whatIsDue } from './enrollment';
import type { DueReport } from './pacing';
import { curriculumWorld, type CurriculumWorld } from './testing';
import type { Cadence } from './types';

const feature = await loadFeature(featurePath(import.meta.url, 'enrollment-and-pacing.feature'));

const MAYA = 'maya@example.com';
const asCadence = (value: string): Cadence => (value === 'daily' ? 'daily' : 'weekly');

describeFeature(feature, ({ Scenario, Background }) => {
  let world: CurriculumWorld;
  let report: DueReport | undefined;
  const subjectIdOf = async (name: string) => {
    const subject = await ensureSubject(world.store, 'Any', name);
    return subject.ok ? subject.val.id : undefined;
  };

  Background(({ Given, And }) => {
    Given(
      'the category {string} with the subject {string}',
      async (_ctx: unknown, category: string, subject: string) => {
        world = curriculumWorld();
        report = undefined;
        void (await ensureSubject(world.store, category, subject));
      }
    );
    And(
      'the educator {string} has a published track {string} in {string} with {int} units of {int} lessons',
      async (
        _ctx: unknown,
        email: string,
        title: string,
        subject: string,
        unitCount: number,
        lessonCount: number
      ) => {
        const educator = await world.person(email, 'educator');
        const subjectId = await subjectIdOf(subject);
        if (!subjectId) return;
        const track = await createTrack(world, educator, { subjectId, title });
        if (!track.ok) return;
        for (let u = 1; u <= unitCount; u += 1) {
          const unit = await addUnit(world, educator, {
            trackId: track.val.id,
            title: `Unit ${u}`,
          });
          if (!unit.ok) return;
          for (let l = 1; l <= lessonCount; l += 1) {
            void (await addLesson(world, educator, {
              trackId: track.val.id,
              unitId: unit.val.id,
              title: `Lesson ${u}.${l}`,
            }));
          }
        }
        void (await publishTrack(world, educator, track.val.id));
      }
    );
    And('{string} is a learner', async (_ctx: unknown, email: string) => {
      await world.person(email);
    });
  });

  const enrolls = async (
    _ctx: unknown,
    email: string,
    title: string,
    cadence: string,
    sessions: number,
    on = '2026-09-14'
  ) => {
    const track = await world.trackByTitle(title);
    world.last = await enroll(world, {
      learnerId: await world.userIdOf(email),
      trackId: track?.id ?? brandId<'track'>(''),
      cadence: asCadence(cadence),
      sessionsPerPeriod: sessions,
      now: new Date(`${on}T09:00:00Z`),
    });
  };
  const computesOn = async (_ctx: unknown, on: string) => {
    const track = await world.trackByTitle('Ratios and Rates');
    const result = track
      ? await whatIsDue(world, {
          learnerId: await world.userIdOf(MAYA),
          trackId: track.id,
          now: new Date(`${on}T09:00:00Z`),
        })
      : undefined;
    expect(result?.ok).toBe(true);
    report = result?.ok ? result.val : undefined;
  };
  const dueCount = (_ctx: unknown, count: number) => {
    expect(report?.due.length).toBe(count);
  };
  const firstDue = (_ctx: unknown, lesson: number, unit: number) => {
    expect(report?.due[0]?.title).toBe(`Lesson ${unit}.${lesson}`);
  };

  Scenario('Enrolling in a published track', ({ When, Then, And }) => {
    When('{string} enrolls in {string} with a {string} pace of {int} sessions', enrolls);
    Then(
      '{string} is enrolled in {string}',
      async (_ctx: unknown, email: string, title: string) => {
        const track = await world.trackByTitle(title);
        const enrollment = track
          ? await world.store.getEnrollment(await world.userIdOf(email), track.id)
          : undefined;
        expect(enrollment?.ok && enrollment.val?.status).toBe('active');
      }
    );
    And(
      'her plan for {string} is {string} with {int} sessions per period',
      async (_ctx: unknown, title: string, cadence: string, sessions: number) => {
        const track = await world.trackByTitle(title);
        const enrollment = track
          ? await world.store.getEnrollment(await world.userIdOf(MAYA), track.id)
          : undefined;
        const plan =
          enrollment?.ok && enrollment.val
            ? await world.store.getPacingPlan(enrollment.val.id)
            : undefined;
        expect(plan?.ok && plan.val?.cadence).toBe(cadence);
        expect(plan?.ok && plan.val?.sessionsPerPeriod).toBe(sessions);
      }
    );
  });

  Scenario('A draft cannot be enrolled in', ({ Given, When, Then }) => {
    Given(
      'the educator {string} has a draft track {string} in {string}',
      async (_ctx: unknown, email: string, title: string, subject: string) => {
        const educator = await world.person(email, 'educator');
        const subjectId = await subjectIdOf(subject);
        if (subjectId) void (await createTrack(world, educator, { subjectId, title }));
      }
    );
    When('{string} enrolls in {string} with a {string} pace of {int} sessions', enrolls);
    Then('the change fails with TRACK_NOT_PUBLISHED', () => {
      expect(world.last && !world.last.ok && world.last.err?.type).toBe('TRACK_NOT_PUBLISHED');
    });
  });

  Scenario('The first lessons are due at the start', ({ Given, When, Then, And }) => {
    Given(
      '{string} enrolled in {string} with a {string} pace of {int} sessions on {string}',
      enrolls
    );
    When('the due lessons are computed on {string}', computesOn);
    Then('{int} lessons are due', dueCount);
    And('the first due lesson is lesson {int} of unit {int}', firstDue);
    And('she is not behind', () => {
      expect(report?.behindBy).toBe(0);
    });
  });

  Scenario('Completing lessons advances the plan', ({ Given, When, Then, And }) => {
    Given(
      '{string} enrolled in {string} with a {string} pace of {int} sessions on {string}',
      enrolls
    );
    And(
      'she completed {int} lessons of {string}',
      async (_ctx: unknown, count: number, title: string) => {
        const track = await world.trackByTitle(title);
        const outline = track ? await getOutline(world, track.id) : undefined;
        const lessons = outline?.ok ? lessonsInOrder(outline.val) : [];
        for (const lesson of lessons.slice(0, count)) {
          void (await completeLesson(world, {
            learnerId: await world.userIdOf(MAYA),
            trackId: track?.id ?? brandId<'track'>(''),
            lessonId: lesson.id,
            now: new Date('2026-09-16T09:00:00Z'),
          }));
        }
      }
    );
    When('the due lessons are computed on {string}', computesOn);
    Then('{int} lessons are due', dueCount);
    And('the first due lesson is lesson {int} of unit {int}', firstDue);
  });

  Scenario('Missing a period marks the learner behind', ({ Given, When, Then }) => {
    Given(
      '{string} enrolled in {string} with a {string} pace of {int} sessions on {string}',
      enrolls
    );
    When('the due lessons are computed on {string}', computesOn);
    Then('she is behind by {int} lessons', (_ctx: unknown, count: number) => {
      expect(report?.behindBy).toBe(count);
    });
  });
});
