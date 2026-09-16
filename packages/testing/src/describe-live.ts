/**
 * The integration tier's switch.
 *
 * `*.integration.test.ts` files need a real Postgres. Rather than failing on a
 * machine without one — which trains people to ignore red — they describe
 * themselves under `describeLive`, which is `describe` when DATABASE_URL is
 * set and `describe.skip` when it is not. CI always sets it; a developer
 * without a database sees "skipped", not "failed".
 */

import { describe } from 'vitest';

export const TEST_DATABASE_URL = process.env.DATABASE_URL;

export const describeLive = TEST_DATABASE_URL ? describe : describe.skip;
