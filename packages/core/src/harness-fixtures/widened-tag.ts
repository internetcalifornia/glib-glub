// Fixture for harness.test.ts: an error tag widened to `string`.
import { ok } from '@campfhir/safe-functions/helpers';
import type { Result } from '@campfhir/safe-functions/types';

export function f(): Result<number> {
  return ok(1);
}
