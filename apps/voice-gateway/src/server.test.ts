/**
 * The socket plumbing: a real WebSocket client reaches a bridge through
 * startGateway, `/health` reflects the injected check, and closing the
 * server terminates its clients.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import { openConnection, startFakeVoiceLiveServer } from '@glib-glub/ai';
import { issueGatewayTicket } from '@glib-glub/identity';
import { noopLogger } from '@glib-glub/logging';
import { tutorWorld } from '@glib-glub/tutor';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import { startGateway, type GatewayServer } from './server';

const SECRET = 'a-shared-auth-secret-of-at-least-32-chars';

describe('startGateway', () => {
  const world = tutorWorld();
  let healthy = true;
  let server: GatewayServer;
  let closeFake: () => Promise<void> = async () => {};

  beforeAll(async () => {
    world.addLearner('maya@example.com', '6-8', 'Visual learner');
    world.addTrack('Grade 6 Mathematics', {
      lessonTitle: 'Unit rates',
      notes: 'Price per pencil.',
    });
    const fake = await startFakeVoiceLiveServer();
    expect(fake.ok).toBe(true);
    if (!fake.ok) return;
    closeFake = () => fake.val.close();
    const started = await startGateway(
      {
        tutor: world,
        voiceLive: () => ({ connect: () => openConnection(fake.val.url) }),
        authSecret: SECRET,
        clock: world.clock,
        logger: noopLogger,
      },
      { port: 0, healthy: async () => (healthy ? ok() : err('DB_UNREACHABLE')) }
    );
    expect(started.ok).toBe(true);
    if (started.ok) server = started.val;
  });

  afterAll(async () => {
    void (await server.close());
    await closeFake();
  });

  it('answers the health probe from the injected check', async () => {
    const httpUrl = server.url.replace('ws://', 'http://');
    expect((await fetch(`${httpUrl}/health`)).status).toBe(200);
    healthy = false;
    expect((await fetch(`${httpUrl}/health`)).status).toBe(503);
    healthy = true;
    expect((await fetch(`${httpUrl}/nothing`)).status).toBe(404);
  });

  it('starts a session for a browser socket presenting a valid ticket', async () => {
    const socket = new WebSocket(server.url);
    const first = new Promise<string>((resolve) => {
      socket.once('message', (data) => resolve(data.toString()));
    });
    await new Promise<void>((resolve) => socket.once('open', () => resolve()));
    const ticket = issueGatewayTicket({
      secret: SECRET,
      userId: world.userIdOf('maya@example.com'),
      now: world.clock.now(),
    });
    socket.send(JSON.stringify({ type: 'session.start', ticket, transport: 'text' }));

    const message: unknown = JSON.parse(await first);

    expect(
      typeof message === 'object' && message !== null && 'type' in message && message.type
    ).toBe('session.started');
    socket.close();
  });
});
