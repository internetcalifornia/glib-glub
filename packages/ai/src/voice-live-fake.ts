/**
 * A fake Voice Live server: a `ws` server that answers the SDP exchange
 * and session updates the way Azure does, records every client event, and
 * lets a test push server events (a transcript, a function call) to the
 * connected gateway. This is what makes the gateway's session machine
 * testable in CI, and what `VOICE_LIVE_FAKE=1` runs in development.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import { WebSocketServer, type WebSocket } from 'ws';

export interface FakeVoiceLiveServer {
  url: string;
  /** Every event a client sent, in order, parsed. */
  received: Array<Record<string, unknown>>;
  /** Push an event to every connected client. */
  emit(event: Record<string, unknown>): void;
  /** Resolves when the client has sent an event with this type. */
  waitFor(type: string, timeoutMs?: number): Promise<Record<string, unknown> | null>;
  close(): Promise<void>;
}

export function startFakeVoiceLiveServer(
  options: { port?: number } = {}
): AsyncResult<FakeVoiceLiveServer, 'FAKE_SERVER_FAILED'> {
  return new Promise((resolve) => {
    const server = new WebSocketServer({
      port: options.port ?? 0,
      handleProtocols: () => 'realtime',
    });
    const clients = new Set<WebSocket>();
    const received: Array<Record<string, unknown>> = [];
    const waiters: Array<{ type: string; resolve: (event: Record<string, unknown>) => void }> = [];

    const send = (socket: WebSocket, event: Record<string, unknown>) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(event));
    };

    server.on('connection', (socket) => {
      clients.add(socket);
      send(socket, { type: 'session.created', session: { id: `fake-${Date.now()}` } });
      socket.on('message', (data) => {
        let event: unknown;
        try {
          event = JSON.parse(data.toString());
        } catch {
          return;
        }
        if (
          typeof event !== 'object' ||
          event === null ||
          !('type' in event) ||
          typeof event.type !== 'string'
        )
          return;
        const record: Record<string, unknown> = { ...event };
        received.push(record);
        for (const waiter of [...waiters]) {
          if (waiter.type === event.type) {
            waiters.splice(waiters.indexOf(waiter), 1);
            waiter.resolve(record);
          }
        }
        if (event.type === 'rtc.call.sdp.create') {
          send(socket, {
            type: 'rtc.call.sdp.created',
            sdp_answer: 'v=0\r\no=- fake 1 IN IP4 127.0.0.1\r\ns=fake\r\n',
            rtc_call_id: 'fake-call',
          });
          send(socket, { type: 'session.updated' });
        } else if (event.type === 'session.update') {
          send(socket, { type: 'session.updated' });
        } else if (event.type === 'response.create') {
          send(socket, { type: 'response.done' });
        }
      });
      socket.on('close', () => {
        clients.delete(socket);
      });
    });

    server.on('listening', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : (options.port ?? 0);
      resolve(
        ok({
          url: `ws://127.0.0.1:${port}/voice-live/realtime/calls`,
          received,
          emit: (event) => {
            for (const client of clients) send(client, event);
          },
          waitFor: (type, timeoutMs = 2_000) =>
            new Promise((resolveWait) => {
              const already = received.find((event) => event.type === type);
              if (already) {
                resolveWait(already);
                return;
              }
              const timer = setTimeout(() => {
                const index = waiters.findIndex((waiter) => waiter.resolve === done);
                if (index >= 0) waiters.splice(index, 1);
                resolveWait(null);
              }, timeoutMs);
              const done = (event: Record<string, unknown>) => {
                clearTimeout(timer);
                resolveWait(event);
              };
              waiters.push({ type, resolve: done });
            }),
          close: () =>
            new Promise((resolveClose) => {
              for (const client of clients) client.close();
              server.close(() => resolveClose());
            }),
        })
      );
    });
    server.on('error', (error) => {
      resolve(err('FAKE_SERVER_FAILED', { message: error.message, cause: error }));
    });
  });
}
