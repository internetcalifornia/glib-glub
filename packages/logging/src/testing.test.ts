/**
 * `memoryLogger` records level, message and attributes in call order, so a
 * test can assert on what a module chose to log.
 */

import { describe, expect, it } from 'vitest';

import { memoryLogger } from './testing';

describe('memoryLogger', () => {
  it('remembers every call in order', () => {
    const logger = memoryLogger();

    logger.info('session {sessionId} started', { sessionId: 's1' });
    logger.error('session {sessionId} failed', { sessionId: 's1', reason: 'TIMEOUT' });

    expect(logger.records).toEqual([
      { level: 'info', message: 'session {sessionId} started', attributes: { sessionId: 's1' } },
      {
        level: 'error',
        message: 'session {sessionId} failed',
        attributes: { sessionId: 's1', reason: 'TIMEOUT' },
      },
    ]);
  });
});
