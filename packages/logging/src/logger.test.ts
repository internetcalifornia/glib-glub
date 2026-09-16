/**
 * The app logger satisfies the port every package takes, stamps identity on
 * every record, and formats the version as `x.y.z+commit` when a commit is
 * known — so a row in the logs table names the exact build.
 */

import { describe, expect, it } from 'vitest';

import { createAppLogger } from './logger';
import type { LoggerPort } from './port';

describe('createAppLogger', () => {
  it('is a LoggerPort', () => {
    const logger: LoggerPort = createAppLogger({ application: 'test', version: '0.1.0' });

    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('carries application, version and commit as global attributes', () => {
    const logger = createAppLogger({
      application: 'web',
      version: '0.1.0',
      commit: 'abc1234',
      consoleLevel: 'silent',
    });

    // Global attributes are resolved onto each record; the reserved
    // `version` option is what the console line prints from the bag.
    expect(logger.attributes).toMatchObject({
      application: 'web',
      version: '0.1.0+abc1234',
      commit: 'abc1234',
    });
  });
});
