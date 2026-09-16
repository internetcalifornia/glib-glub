// Fixture for harness.test.ts: what the rules accept.
import { err, ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult, Result } from '@campfhir/safe-functions/types';

export function parseConfig(raw: string): Result<string, 'EMPTY_CONFIG'> {
  if (!raw) return err('EMPTY_CONFIG');
  return ok(raw);
}

export async function loadUser(id: string): AsyncResult<string, 'NOT_FOUND'> {
  const parsed = parseConfig(id);
  if (!parsed.ok) return err('NOT_FOUND');
  return ok(parsed.val);
}
