/**
 * Step definitions for features/self-directed.feature — a track proposed
 * by the model from the learner's snapshot, owned by the learner, published
 * to them alone.
 */

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { scriptedLlm, type ScriptedLlm } from '@glib-glub/ai';
import { featurePath } from '@glib-glub/testing';
import { expect } from 'vitest';

import { getOutline } from './authoring';
import { browseSubject, ensureSubject } from './catalogue';
import { generateSelfDirectedTrack, publishSelfDirectedTrack } from './self-directed';
import { curriculumWorld, type CurriculumWorld } from './testing';

const feature = await loadFeature(featurePath(import.meta.url, 'self-directed.feature'));

describeFeature(feature, ({ Scenario, BeforeEachScenario }) => {
  let world: CurriculumWorld;
  let llm: ScriptedLlm;
  const subjectIdOf = async (name: string) => {
    const subject = await ensureSubject(world.store, 'Any', name);
    return subject.ok ? subject.val.id : undefined;
  };
  const snapshots = new Map<string, string>();

  BeforeEachScenario(() => {
    world = curriculumWorld();
    llm = scriptedLlm();
    snapshots.clear();
  });

  const subject = async (_ctx: unknown, category: string, name: string) => {
    void (await ensureSubject(world.store, category, name));
  };
  const learnerWithSnapshot = async (_ctx: unknown, email: string, text: string) => {
    await world.person(email);
    snapshots.set(email, text);
  };
  const isLearner = async (_ctx: unknown, email: string) => {
    await world.person(email);
  };
  const modelProposes = (_ctx: unknown, title: string, units: string) => {
    llm.answer(
      JSON.stringify({
        title,
        summary: 'Proposed by the model',
        units: units.split(', ').map((unitTitle) => ({
          title: unitTitle,
          lessons: [
            {
              title: `${unitTitle} — first steps`,
              objectives: ['start'],
              content: 'Ask what they remember.',
            },
          ],
        })),
      })
    );
  };
  const generates = async (_ctx: unknown, email: string, subjectName: string) => {
    const subjectId = await subjectIdOf(subjectName);
    if (!subjectId) return;
    world.last = await generateSelfDirectedTrack(
      { store: world.store, llm },
      {
        learnerId: await world.userIdOf(email),
        subjectId,
        snapshotText: snapshots.get(email) ?? '',
      }
    );
    expect(world.last.ok).toBe(true);
  };
  const existsWith = async (_ctx: unknown, title: string, visibility: string) => {
    expect((await world.trackByTitle(title))?.visibility).toBe(visibility);
  };

  Scenario('A track is generated from the snapshot', ({ Given, When, Then, And }) => {
    Given('the category {string} with the subject {string}', subject);
    And('{string} is a learner whose snapshot says {string}', learnerWithSnapshot);
    And('the model proposes a track {string} with the units {string}', modelProposes);
    When('a self-directed track is generated for {string} in {string}', generates);
    Then('the track {string} exists with the visibility {string}', existsWith);
    And(
      'the track {string} was authored by {string}',
      async (_ctx: unknown, title: string, email: string) => {
        expect((await world.trackByTitle(title))?.authoredBy).toBe(await world.userIdOf(email));
      }
    );
    And(
      'the track {string} has the origin {string}',
      async (_ctx: unknown, title: string, origin: string) => {
        expect((await world.trackByTitle(title))?.origin).toBe(origin);
      }
    );
    And(
      'the track {string} has the units {string}',
      async (_ctx: unknown, title: string, units: string) => {
        const track = await world.trackByTitle(title);
        const outline = track ? await getOutline(world, track.id) : undefined;
        expect(outline?.ok && outline.val.units.map((u) => u.title)).toEqual(units.split(', '));
        expect(llm.requests[0]?.messages[0]?.content).toContain(snapshots.get('maya@example.com'));
      }
    );
  });

  Scenario('A self-directed track publishes only to its learner', ({ Given, When, Then, And }) => {
    Given('the category {string} with the subject {string}', subject);
    And('{string} is a learner whose snapshot says {string}', learnerWithSnapshot);
    And('{string} is a learner', isLearner);
    And('the model proposes a track {string} with the units {string}', modelProposes);
    And('a self-directed track was generated for {string} in {string}', generates);
    When(
      '{string} publishes the track {string}',
      async (_ctx: unknown, email: string, title: string) => {
        const track = await world.trackByTitle(title);
        if (!track) return;
        world.last = await publishSelfDirectedTrack(world, {
          learnerId: await world.userIdOf(email),
          trackId: track.id,
          now: new Date('2026-09-16T09:00:00Z'),
        });
        expect(world.last.ok).toBe(true);
      }
    );
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
      'the learner {string} does not see the track {string} in {string}',
      async (_ctx: unknown, email: string, title: string, subjectName: string) => {
        const subjectId = await subjectIdOf(subjectName);
        const visible = subjectId
          ? await browseSubject(world.store, { viewerId: await world.userIdOf(email), subjectId })
          : undefined;
        expect(visible?.ok && visible.val.map((t) => t.title)).not.toContain(title);
      }
    );
  });
});
