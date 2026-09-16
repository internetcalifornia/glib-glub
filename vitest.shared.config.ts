/**
 * The two Vitest tiers every package shares, so a package's own
 * vitest.config.ts is one line and the tiers cannot drift apart.
 *
 * - unit: `src/**\/*.test.ts` — no network, no database. Runs in `pnpm test`.
 * - integration: `src/**\/*.integration.test.ts` — needs DATABASE_URL and
 *   self-skips without it (see `describeLive` in @glib-glub/testing). Runs
 *   serially: every file shares one database and truncates between tests.
 */
import { defineConfig } from 'vitest/config';

export const unitConfig = defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['**/*.integration.test.ts', '**/node_modules/**'],
    passWithNoTests: true,
  },
});

export const integrationConfig = defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    passWithNoTests: true,
  },
});
