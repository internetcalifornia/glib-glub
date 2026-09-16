/**
 * Without DATABASE_URL there is no test database, and the helper says so as
 * a Result rather than by failing to connect later.
 */

import { describe, expect, it } from 'vitest';

import { connectTestDb } from './test-db';
import { TEST_DATABASE_URL } from './describe-live';

describe('connectTestDb', () => {
  it.skipIf(TEST_DATABASE_URL)('reports NO_TEST_DATABASE when DATABASE_URL is unset', () => {
    const result = connectTestDb();

    expect(!result.ok && result.err.type).toBe('NO_TEST_DATABASE');
  });

  it.skipIf(!TEST_DATABASE_URL)('connects when DATABASE_URL is set', async () => {
    const result = connectTestDb();

    expect(result.ok).toBe(true);
    if (result.ok) await result.val.close();
  });
});
