/**
 * Small additions to @campfhir/safe-functions' helpers that every module
 * reaches for. Kept here rather than in each module so the shapes stay
 * identical — a `fromNullable` that one module wrote with `message` and
 * another without is the kind of drift that makes error handling noisy.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { Result } from '@campfhir/safe-functions/types';

/** A nullable lookup as a Result: `null`/`undefined` becomes `err(tag)`. */
export function fromNullable<T, S extends string>(
  value: T,
  tag: S,
  message?: string
): Result<NonNullable<T>, S> {
  if (value === null || value === undefined) {
    return message === undefined ? err(tag) : err(tag, { message });
  }
  return ok(value);
}
