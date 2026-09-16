// Fixture for harness.test.ts: `.val` read without checking `.ok`.
import { ok } from '@campfhir/safe-functions/helpers';
import type { Result } from '@campfhir/safe-functions/types';

function find(): Result<number, 'NOT_FOUND'> {
  return ok(1);
}

export const value = find().val;
