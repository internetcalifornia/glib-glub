/**
 * @glib-glub/testing — what every package's tests share: the integration
 * tier switch, the shared Postgres handle, and feature-file resolution.
 * Fakes for a specific port live in that port's package under `testing.ts`.
 */

export { describeLive, TEST_DATABASE_URL } from './describe-live';
export { connectTestDb } from './test-db';
export type { TestDb, TestDbErrorTag } from './test-db';
export { featurePath } from './feature';
