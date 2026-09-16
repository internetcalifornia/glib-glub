/**
 * The gateway's specification, executed: the bridge against the in-memory
 * tutor world and the fake Voice Live server, with the browser played by a
 * captured `send`. No Azure, no Postgres, no real browser socket — the
 * server.test.ts pins the socket plumbing separately.
 */

import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { openConnection, startFakeVoiceLiveServer, type FakeVoiceLiveServer } from '@glib-glub/ai';
import { brandId } from '@glib-glub/core';
import { issueGatewayTicket } from '@glib-glub/identity';
import { noopLogger } from '@glib-glub/logging';
import { featurePath } from '@glib-glub/testing';
import { tutorWorld, type TutorWorld } from '@glib-glub/tutor';
import { expect } from 'vitest';

import { createBridge, type Bridge } from './bridge';
import type { ServerMessage } from './protocol';

const feature = await loadFeature(featurePath(import.meta.url, 'gateway-session.feature'));

const SECRET = 'a-shared-auth-secret-of-at-least-32-chars';
const LEARNER = 'maya@example.com';

async function until(condition: () => boolean, timeoutMs = 2_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return true;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return condition();
}

describeFeature(feature, ({ Scenario, Background, AfterEachScenario }) => {
  let world: TutorWorld;
  let fake: FakeVoiceLiveServer;
  let fakeOpen = false;
  let bridge: Bridge;
  let messages: ServerMessage[];

  const ticketFor = (email: string, secret = SECRET) =>
    issueGatewayTicket({ secret, userId: world.userIdOf(email), now: world.clock.now() });
  const sessionId = () => {
    const started = messages.find((m) => m.type === 'session.started');
    return brandId<'tutor_session'>(started?.type === 'session.started' ? started.sessionId : '');
  };
  const send = async (message: Record<string, unknown>): Promise<void> => {
    void (await bridge.handle(JSON.stringify(message)));
  };
  const startVoice = (ticket: string) =>
    send({ type: 'session.start', ticket, mode: 'solo', transport: 'voice' });
  const goLive = async () => {
    await startVoice(ticketFor(LEARNER));
    await send({ type: 'sdp.offer', sdp: 'v=0 offer' });
    expect(await until(() => bridge.state() === 'live')).toBe(true);
  };
  const received = (type: string) => fake.received.filter((event) => event.type === type);
  const functionOutputs = () =>
    fake.received
      .filter((event) => event.type === 'conversation.item.create')
      .map((event) => event.item)
      .filter(
        (item): item is { type: string; call_id: string; output: string } =>
          typeof item === 'object' &&
          item !== null &&
          'type' in item &&
          item.type === 'function_call_output'
      );
  const transcriptOf = (speaker: string, text: string) =>
    messages.some((m) => m.type === 'transcript' && m.speaker === speaker && m.text === text);
  const fatalError = (tag: string) =>
    messages.some((m) => m.type === 'error' && m.tag === tag && m.fatal);
  const sessionStatus = async () => {
    const loaded = await world.store.getSession(sessionId());
    return loaded.ok ? loaded.val?.status : undefined;
  };

  AfterEachScenario(async () => {
    if (fakeOpen) {
      fakeOpen = false;
      await fake.close();
    }
  });

  Background(({ Given }) => {
    Given(
      'a learner {string} whose next lesson on {string} is {string}',
      async (_ctx: unknown, email: string, track: string, lesson: string) => {
        world = tutorWorld();
        world.addLearner(email, '6-8', 'Visual learner');
        world.addTrack(track, { lessonTitle: lesson, notes: 'Price per pencil.' });
        const server = await startFakeVoiceLiveServer();
        expect(server.ok).toBe(true);
        if (!server.ok) return;
        fake = server.val;
        fakeOpen = true;
        messages = [];
        bridge = createBridge(
          {
            tutor: world,
            voiceLive: () => ({ connect: () => openConnection(fake.url) }),
            authSecret: SECRET,
            clock: world.clock,
            logger: noopLogger,
          },
          (message) => {
            messages.push(message);
          }
        );
      }
    );
  });

  Scenario('Starting a session with a valid ticket', ({ When, Then, And }) => {
    When('the browser starts a voice session with a valid ticket', () =>
      startVoice(ticketFor(LEARNER))
    );
    Then('the browser is told the session started on {string}', (_ctx: unknown, lesson: string) => {
      const started = messages.find((m) => m.type === 'session.started');
      expect(started?.type === 'session.started' && started.lessonTitle).toBe(lesson);
    });
    And('the gateway is {string}', (_ctx: unknown, state: string) => {
      expect(bridge.state()).toBe(state);
    });
  });

  Scenario('Negotiating the call', ({ Given, When, Then, And }) => {
    Given('the browser started a voice session with a valid ticket', () =>
      startVoice(ticketFor(LEARNER))
    );
    When('the browser sends the SDP offer {string}', (_ctx: unknown, sdp: string) =>
      send({ type: 'sdp.offer', sdp })
    );
    Then(
      "the voice service receives {string} carrying the tutor's instructions",
      async (_ctx: unknown, type: string) => {
        const event = await fake.waitFor(type);
        const session = event?.session;
        expect(
          typeof session === 'object' &&
            session !== null &&
            'instructions' in session &&
            typeof session.instructions === 'string' &&
            session.instructions.includes('Unit rates')
        ).toBe(true);
      }
    );
    And('the browser receives the SDP answer', async () => {
      expect(await until(() => messages.some((m) => m.type === 'sdp.answer'))).toBe(true);
    });
    And('the gateway is {string}', (_ctx: unknown, state: string) => {
      expect(bridge.state()).toBe(state);
    });
  });

  Scenario('A ticket signed with another secret is refused', ({ When, Then, And }) => {
    When('the browser starts a voice session with a forged ticket', () =>
      startVoice(ticketFor(LEARNER, 'some-other-secret-that-is-long-enough'))
    );
    Then('the browser receives the fatal error {string}', (_ctx: unknown, tag: string) => {
      expect(fatalError(tag)).toBe(true);
    });
    And('the gateway is {string}', (_ctx: unknown, state: string) => {
      expect(bridge.state()).toBe(state);
    });
  });

  Scenario('What the learner says is recorded and shown', ({ Given, When, Then, And }) => {
    Given('a live voice session', goLive);
    When(
      'the voice service transcribes {string} from {string}',
      (_ctx: unknown, transcript: string, speaker: string) => {
        fake.emit({
          type: 'conversation.item.input_audio_transcription.completed',
          transcript,
          speaker,
        });
      }
    );
    Then(
      'the transcript shows the {string} saying {string}',
      async (_ctx: unknown, speaker: string, text: string) => {
        expect(await until(() => transcriptOf(speaker, text))).toBe(true);
      }
    );
    And('the session has {int} recorded turn', async (_ctx: unknown, count: number) => {
      const turns = await world.store.listTurns(sessionId());
      expect(turns.ok && turns.val.length).toBe(count);
    });
  });

  Scenario('What the tutor says is recorded too', ({ Given, When, Then }) => {
    Given('a live voice session', goLive);
    When('the voice service speaks {string}', (_ctx: unknown, transcript: string) => {
      fake.emit({ type: 'response.audio_transcript.done', transcript });
    });
    Then(
      'the transcript shows the {string} saying {string}',
      async (_ctx: unknown, speaker: string, text: string) => {
        expect(await until(() => transcriptOf(speaker, text))).toBe(true);
      }
    );
  });

  Scenario("The tutor's tool calls run against the platform", ({ Given, When, Then, And }) => {
    Given('a live voice session', goLive);
    When(
      'the voice service calls {string} with the problem {string} and the answer {string}',
      async (_ctx: unknown, name: string, problem: string, expectedAnswer: string) => {
        fake.emit({
          type: 'response.function_call_arguments.done',
          call_id: 'c1',
          name,
          arguments: JSON.stringify({ problem, expectedAnswer }),
        });
        expect(await until(() => functionOutputs().length >= 1)).toBe(true);
      }
    );
    And(
      'the voice service calls {string} with the attempt {string}',
      async (_ctx: unknown, name: string, attempt: string) => {
        fake.emit({
          type: 'response.function_call_arguments.done',
          call_id: 'c2',
          name,
          arguments: JSON.stringify({ attempt }),
        });
        expect(await until(() => functionOutputs().length >= 2)).toBe(true);
      }
    );
    Then(
      'the voice service receives a function output whose next move is {string}',
      (_ctx: unknown, move: string) => {
        const output = functionOutputs().find((item) => item.call_id === 'c2');
        const parsed: unknown = JSON.parse(output?.output ?? '{}');
        expect(
          typeof parsed === 'object' && parsed !== null && 'nextMove' in parsed && parsed.nextMove
        ).toBe(move);
        expect(received('response.create').length).toBeGreaterThanOrEqual(2);
      }
    );
    And('the browser sees the tool {string}', (_ctx: unknown, name: string) => {
      expect(messages.some((m) => m.type === 'tool' && m.name === name)).toBe(true);
    });
  });

  Scenario('Ending the session writes a summary', ({ Given, When, Then, And }) => {
    Given('a live voice session', goLive);
    When('the browser ends the session', () => send({ type: 'session.end' }));
    Then('the browser receives the summary', () => {
      const ended = messages.find((m) => m.type === 'ended');
      expect(ended?.type === 'ended' && ended.summary !== null).toBe(true);
    });
    And('the gateway is {string}', (_ctx: unknown, state: string) => {
      expect(bridge.state()).toBe(state);
    });
    And('the session is {string}', async (_ctx: unknown, status: string) => {
      expect(await sessionStatus()).toBe(status);
    });
  });

  Scenario('The tutor can end the session itself', ({ Given, When, Then, And }) => {
    Given('a live voice session', goLive);
    When('the voice service calls {string}', async (_ctx: unknown, name: string) => {
      fake.emit({
        type: 'response.function_call_arguments.done',
        call_id: 'c9',
        name,
        arguments: '{}',
      });
      expect(await until(() => messages.some((m) => m.type === 'ended'))).toBe(true);
    });
    Then('the browser receives the summary', () => {
      const ended = messages.find((m) => m.type === 'ended');
      expect(ended?.type === 'ended' && ended.summary !== null).toBe(true);
    });
    And('the gateway is {string}', (_ctx: unknown, state: string) => {
      expect(bridge.state()).toBe(state);
    });
  });

  Scenario('A text session needs no call', ({ When, Then, And }) => {
    When('the browser starts a text session with a valid ticket', () =>
      send({ type: 'session.start', ticket: ticketFor(LEARNER), mode: 'solo', transport: 'text' })
    );
    Then(
      'the voice service receives {string} with text only',
      async (_ctx: unknown, type: string) => {
        const event = await fake.waitFor(type);
        const session = event?.session;
        expect(
          typeof session === 'object' &&
            session !== null &&
            'modalities' in session &&
            session.modalities
        ).toEqual(['text']);
      }
    );
    And('the gateway is {string}', (_ctx: unknown, state: string) => {
      expect(bridge.state()).toBe(state);
    });
    When('the browser types {string}', (_ctx: unknown, text: string) =>
      send({ type: 'text.turn', text })
    );
    Then(
      'the voice service receives the user text {string}',
      async (_ctx: unknown, text: string) => {
        expect(
          await until(() =>
            fake.received.some(
              (event) =>
                event.type === 'conversation.item.create' &&
                JSON.stringify(event.item).includes(text)
            )
          )
        ).toBe(true);
      }
    );
    And(
      'the transcript shows the {string} saying {string}',
      async (_ctx: unknown, speaker: string, text: string) => {
        expect(await until(() => transcriptOf(speaker, text))).toBe(true);
      }
    );
  });

  Scenario('The voice service dropping fails the session', ({ Given, When, Then, And }) => {
    Given('a live voice session', goLive);
    When('the voice service closes', async () => {
      fakeOpen = false;
      await fake.close();
    });
    Then('the browser receives the fatal error {string}', async (_ctx: unknown, tag: string) => {
      expect(await until(() => fatalError(tag))).toBe(true);
    });
    And('the session is {string}', async (_ctx: unknown, status: string) => {
      expect(await until(() => bridge.state() === 'failed')).toBe(true);
      expect(await sessionStatus()).toBe(status);
    });
  });

  Scenario('The browser leaving closes out the session', ({ Given, When, Then }) => {
    Given('a live voice session', goLive);
    When('the browser disconnects', async () => {
      void (await bridge.browserClosed());
    });
    Then('the session is {string}', async (_ctx: unknown, status: string) => {
      expect(await sessionStatus()).toBe(status);
    });
  });

  Scenario('An offer before a session is refused, not fatal', ({ When, Then, And }) => {
    When('the browser sends the SDP offer {string}', (_ctx: unknown, sdp: string) =>
      send({ type: 'sdp.offer', sdp })
    );
    Then('the browser receives the error {string}', (_ctx: unknown, tag: string) => {
      expect(messages.some((m) => m.type === 'error' && m.tag === tag && !m.fatal)).toBe(true);
    });
    And('the gateway is {string}', (_ctx: unknown, state: string) => {
      expect(bridge.state()).toBe(state);
    });
  });
});
