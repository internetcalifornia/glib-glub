/**
 * Step definitions for features/participants.feature — calibration
 * phrases map speaker labels; unmapped labels stay unknown; a solo session
 * needs no mapping.
 */

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { featurePath } from '@glib-glub/testing';
import { expect } from 'vitest';

import { attribute, calibrate, type SpeakerMap } from './participants';
import type { Participant, Speaker } from './types';

const feature = await loadFeature(featurePath(import.meta.url, 'participants.feature'));

function parseParticipants(spec: string): Participant[] {
  return spec.split(', ').map((entry, index) => {
    const match = entry.match(/^(.*) \((learner|guardian|educator)\)$/);
    return {
      id: `p${index}`,
      name: match?.[1] ?? entry,
      role:
        match?.[2] === 'guardian' ? 'guardian' : match?.[2] === 'educator' ? 'educator' : 'learner',
      userId: null,
    };
  });
}

describeFeature(feature, ({ Scenario, BeforeEachScenario }) => {
  let participants: Participant[] = [];
  let map: SpeakerMap = new Map();
  let lastSpeaker: Speaker | undefined;

  BeforeEachScenario(() => {
    participants = [];
    map = new Map();
    lastSpeaker = undefined;
  });

  const withParticipants = (_ctx: unknown, spec: string) => {
    participants = parseParticipants(spec);
  };
  const says = (_ctx: unknown, label: string, text: string) => {
    map = calibrate(participants, map, label, text);
    lastSpeaker = attribute(participants, map, label);
  };
  const nameOf = (speaker: Speaker | undefined) =>
    speaker?.kind === 'participant'
      ? (participants.find((p) => p.id === speaker.participantId)?.name ?? 'unknown')
      : 'unknown';
  const isNamed = (_ctx: unknown, label: string, name: string) => {
    expect(nameOf(attribute(participants, map, label))).toBe(name);
  };

  Scenario('Speakers are mapped by their calibration phrase', ({ Given, When, Then, And }) => {
    Given('a session with the participants {string}', withParticipants);
    When('{string} says {string}', says);
    And('{string} replies {string}', says);
    Then('{string} is {string}', isNamed);
    And('{string} is recognised as {string}', isNamed);
  });

  Scenario('An unmapped speaker is recorded as unknown, never guessed', ({ Given, When, Then }) => {
    Given('a session with the participants {string}', withParticipants);
    When('{string} says {string}', says);
    Then('the turn is attributed to {string}', (_ctx: unknown, name: string) => {
      expect(nameOf(lastSpeaker)).toBe(name);
    });
  });

  Scenario('A solo session attributes everything to the learner', ({ Given, When, Then }) => {
    Given('a session with the participants {string}', withParticipants);
    When('{string} says {string}', says);
    Then('the turn is attributed to {string}', (_ctx: unknown, name: string) => {
      expect(nameOf(lastSpeaker)).toBe(name);
    });
  });
});
