/**
 * The web app's unit tier: convention tests under test/ and the pure
 * modules under lib/. Route handlers and pages are exercised through the
 * integration tier and Playwright, never imported here.
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: ['**/*.integration.test.ts', '**/node_modules/**', '**/.next/**'],
    passWithNoTests: true,
  },
});
