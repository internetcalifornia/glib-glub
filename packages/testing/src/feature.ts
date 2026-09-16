/**
 * Where a package's feature files live, resolved from the test that binds
 * them.
 *
 * vitest-cucumber's `loadFeature` takes a path relative to the current
 * working directory, which is the package root when `pnpm -r test` runs but
 * the repository root when a developer runs `vitest` from there. Resolving
 * from the calling file's own URL makes both work.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `featurePath(import.meta.url, 'config.feature')` from `src/x.steps.test.ts`
 * → `<package>/features/config.feature`.
 */
export function featurePath(fromModuleUrl: string, name: string): string {
  const here = dirname(fileURLToPath(fromModuleUrl));
  return resolve(here, '..', 'features', name);
}
