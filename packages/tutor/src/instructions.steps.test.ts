/**
 * Step definitions for features/instructions.feature — what the tutor is
 * told, and which voice and turn detection a session gets.
 */

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { newId } from '@glib-glub/core';
import { featurePath } from '@glib-glub/testing';
import { expect } from 'vitest';

import { startSession, type StartedSession } from './session';
import { tutorWorld, type TutorWorld } from './testing';
import type { AgeBand } from '@glib-glub/identity';

const feature = await loadFeature(featurePath(import.meta.url, 'instructions.feature'));

const asBand = (value: string): AgeBand | null =>
  value === 'k-5' ||
  value === '6-8' ||
  value === '9-12' ||
  value === 'university' ||
  value === 'adult'
    ? value
    : null;

describeFeature(feature, ({ Scenario, Background }) => {
  let world: TutorWorld;
  let started: StartedSession | undefined;

  Background(({ Given, And }) => {
    Given(
      'a learner {string} in the age band {string} with the snapshot {string}',
      (_ctx: unknown, email: string, band: string, snapshot: string) => {
        world = tutorWorld();
        started = undefined;
        world.addLearner(email, asBand(band), snapshot);
      }
    );
    And(
      'a track {string} with the pedagogy {string} whose next due lesson is {string} with the notes {string}',
      (_ctx: unknown, title: string, pedagogy: string, lessonTitle: string, notes: string) => {
        world.addTrack(title, { pedagogy, lessonTitle, notes });
      }
    );
  });

  const start = async (
    email: string,
    mode: 'solo' | 'with_guardian' | 'with_educator',
    others: Array<{ name: string; role: 'guardian' | 'educator' }> = [],
    track?: string
  ) => {
    const trackId = track ? world.tracks.get(track)?.trackId : undefined;
    const result = await startSession(world, {
      learnerId: world.userIdOf(email),
      mode,
      transport: 'voice',
      others,
      ...(trackId ? { trackId } : {}),
    });
    expect(result.ok).toBe(true);
    started = result.ok ? result.val : undefined;
  };
  const soloStarts = (_ctx: unknown, email: string) => start(email, 'solo');
  const mentions = (_ctx: unknown, ...phrases: string[]) => {
    for (const phrase of phrases) expect(started?.instructions).toContain(phrase);
  };

  Scenario('A first solo voice session', ({ When, Then, And }) => {
    When('a solo voice session starts for {string}', soloStarts);
    Then('the instructions mention the lesson {string}', mentions);
    And('the instructions mention the lesson notes {string}', mentions);
    And('the instructions mention the pedagogy {string}', mentions);
    And('the instructions mention the snapshot {string} and {string}', mentions);
    And(
      'the instructions say the learner is in the age band {string}',
      (_ctx: unknown, band: string) => {
        expect(started?.instructions).toContain(`age band ${band}`);
      }
    );
    And('the instructions forbid reading the notes aloud', () => {
      expect(started?.instructions).toContain('never read them aloud');
    });
  });

  Scenario("The previous session's summary is carried forward", ({ Given, When, Then }) => {
    Given(
      'the last session for {string} was summarised as {string}',
      (_ctx: unknown, email: string, narrative: string) => {
        world.summaries.set(world.userIdOf(email), {
          covered: [],
          problemsPresented: 1,
          problemsSolved: 0,
          misconceptions: [],
          nextSteps: [],
          minutes: 10,
          narrative,
        });
        // The world's store answers lastSummary from ended sessions; seed one.
        const learnerId = world.userIdOf(email);
        const track = world.tracks.get('Grade 6 Mathematics');
        if (!track) return;
        void world.store.createSession({
          id: newId<'tutor_session'>(),
          learnerId,
          trackId: track.trackId,
          lessonId: track.lessonId,
          lessonTitle: track.lesson.title,
          mode: 'solo',
          transport: 'voice',
          status: 'ended',
          participants: [],
          problems: [],
          startedAt: new Date('2026-09-15T09:00:00Z'),
          endedAt: new Date('2026-09-15T09:20:00Z'),
          summary: {
            covered: [],
            problemsPresented: 1,
            problemsSolved: 0,
            misconceptions: [],
            nextSteps: [],
            minutes: 20,
            narrative,
          },
        });
      }
    );
    When('a solo voice session starts for {string}', soloStarts);
    Then('the instructions mention the last summary {string}', mentions);
  });

  // Cucumber's optional-text syntax `a(n)` is not supported here, so "as a" and "as an" are two expressions.
  const namesParticipant = (_ctx: unknown, name: string, role: string) => {
    expect(started?.instructions).toContain(`- ${name} (${role})`);
  };

  Scenario('A guardian in the room changes the rules', ({ When, Then, And }) => {
    When(
      'a voice session with the guardian {string} starts for {string}',
      (_ctx: unknown, guardian: string, email: string) =>
        start(email, 'with_guardian', [{ name: guardian, role: 'guardian' }])
    );
    Then('the instructions name the participant {string} as a {string}', namesParticipant);
    And('the instructions say the learner, not the guardian, is being taught', () => {
      expect(started?.instructions).toContain('not the adult, is the one being taught');
    });
    And('the transcription is set to tell speakers apart', () => {
      expect(started?.voice.transcription.model).toBe('gpt-4o-transcribe-diarize');
    });
  });

  Scenario('An educator in the room makes the tutor an aide', ({ When, Then, And }) => {
    When(
      'a voice session with the educator {string} starts for {string}',
      (_ctx: unknown, educator: string, email: string) =>
        start(email, 'with_educator', [{ name: educator, role: 'educator' }])
    );
    Then('the instructions name the participant {string} as an {string}', namesParticipant);
    And('the instructions tell the tutor to act as a teaching aide', () => {
      expect(started?.instructions).toContain('teaching aide');
    });
  });

  Scenario('The voice matches the learner and the track', ({ When, Then, And }) => {
    When('a solo voice session starts for {string}', soloStarts);
    Then('the voice speaks at a rate of {number}', (_ctx: unknown, rate: number) => {
      expect(Number(started?.voice.voice.rate)).toBe(rate);
    });
    And('turn detection is {string}', (_ctx: unknown, type: string) => {
      expect(started?.voice.turnDetection.type).toBe(type);
    });
  });

  Scenario(
    'A Japanese track uses a Japanese voice and multilingual turn detection',
    ({ Given, When, Then, And }) => {
      Given(
        'a track {string} in the language {string} whose next due lesson is {string} with the notes {string}',
        (_ctx: unknown, title: string, language: string, lessonTitle: string, notes: string) => {
          world.addTrack(title, { language, lessonTitle, notes });
        }
      );
      When(
        'a solo voice session starts for {string} on {string}',
        (_ctx: unknown, email: string, track: string) => start(email, 'solo', [], track)
      );
      Then('the voice is a {string} voice', (_ctx: unknown, locale: string) => {
        expect(started?.voice.locale).toBe(locale);
        expect(started?.voice.voice.name.startsWith(locale)).toBe(true);
      });
      And('turn detection is {string}', (_ctx: unknown, type: string) => {
        expect(started?.voice.turnDetection.type).toBe(type);
      });
    }
  );
});
