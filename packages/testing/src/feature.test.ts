/**
 * `featurePath` resolves a feature file relative to the calling test module,
 * so the same test passes whether vitest runs from the package or the repo.
 */

import { describe, expect, it } from 'vitest';

import { featurePath } from './feature';

describe('featurePath', () => {
  it('resolves ../features/<name> from the calling module', () => {
    const path = featurePath('file:///repo/packages/config/src/config.steps.test.ts', 'x.feature');

    expect(path).toBe('/repo/packages/config/features/x.feature');
  });
});
