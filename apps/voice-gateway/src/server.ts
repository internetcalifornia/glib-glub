/**
 * The process's two listeners on one port: `GET /health` for the container
 * probe (200 once the database answers) and the WebSocket endpoint the
 * session page connects to, one bridge per connection. Everything about a
 * session lives in bridge.ts; this file only moves bytes.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer } from 'ws';

import { createBridge, type BridgeDeps } from './bridge';

export interface GatewayServer {
  url: string;
  port: number;
  close(): AsyncResult<void, 'CLOSE_FAILED'>;
}

export type HealthErrorTag = 'DB_UNREACHABLE' | 'MIGRATIONS_PENDING';

export interface ServerOptions {
  port: number;
  /** Answers the health probe; the boot wiring checks the database here. */
  healthy: () => AsyncResult<void, HealthErrorTag>;
}

export function startGateway(
  deps: BridgeDeps,
  options: ServerOptions
): AsyncResult<GatewayServer, 'LISTEN_FAILED'> {
  return new Promise((resolve) => {
    const http = createServer((request: IncomingMessage, response: ServerResponse) => {
      if (request.url === '/health') {
        void options.healthy().then((healthy) => {
          response.writeHead(healthy.ok ? 200 : 503, { 'content-type': 'application/json' });
          response.end(
            JSON.stringify(
              healthy.ok ? { status: 'ok' } : { status: 'degraded', reason: healthy.err.type }
            )
          );
        });
        return;
      }
      response.writeHead(404);
      response.end();
    });
    const wss = new WebSocketServer({ server: http });

    wss.on('connection', (socket) => {
      const bridge = createBridge(deps, (message) => {
        if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
      });
      // Failures are already reported to the page by the bridge; here they
      // only go to the log so an operator can see a session that went wrong.
      const report = (what: string) => (result: { ok: boolean; err?: { type: string } }) => {
        if (!result.ok)
          deps.logger.info('{what}: {reason}', {
            component: 'gateway/server',
            what,
            reason: result.err?.type ?? 'unknown',
          });
      };
      socket.on('message', (data) => {
        void bridge.handle(data.toString()).then(report('browser message refused'));
      });
      socket.on('close', () => {
        void bridge.browserClosed().then(report('browser left'));
      });
      socket.on('error', (error) => {
        deps.logger.warn('browser socket error: {detail}', {
          component: 'gateway/server',
          detail: error.message,
        });
      });
    });

    http.once('error', (error) => {
      resolve(err('LISTEN_FAILED', { message: error.message, cause: error }));
    });
    http.listen(options.port, () => {
      const address = http.address();
      const port = typeof address === 'object' && address ? address.port : options.port;
      resolve(
        ok({
          url: `ws://127.0.0.1:${port}`,
          port,
          close: () =>
            new Promise((done) => {
              for (const client of wss.clients) client.terminate();
              wss.close(() => {
                http.close((error) =>
                  done(error ? err('CLOSE_FAILED', { message: error.message, cause: error }) : ok())
                );
              });
            }),
        })
      );
    });
  });
}
