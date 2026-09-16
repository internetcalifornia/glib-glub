/**
 * The shape every server action returns to `useActionState`: either a
 * message the form shows, or an error the form shows in red. Actions never
 * throw; a failed Result becomes an `error` here, tagged so the UI (and a
 * test) can tell FORBIDDEN from VALIDATION_ERROR.
 */

import type { ErrResult } from '@campfhir/safe-functions/types';

export interface ActionState {
  ok: boolean;
  message?: string;
  error?: string;
  tag?: string;
}

export const idle: ActionState = { ok: true };

export function failed<S extends string>(result: ErrResult<S>): ActionState {
  return {
    ok: false,
    tag: result.err.type,
    error: result.err.message ?? humanise(result.err.type),
  };
}

export function succeeded(message: string): ActionState {
  return { ok: true, message };
}

function humanise(tag: string): string {
  return tag.toLowerCase().replaceAll('_', ' ');
}
