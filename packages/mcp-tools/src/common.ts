/**
 * Shared shape for every MCP tool: how a Result becomes something a model
 * can read. Tools answer in plain text — a model reads prose, not JSON
 * envelopes — and a failed Result becomes an `isError` text result naming
 * the tag and the message, never a thrown error the transport would turn
 * into an opaque protocol failure.
 */

import type { ErrResult } from '@campfhir/safe-functions/types';

// A type alias, not an interface: the SDK's CallToolResult carries an index
// signature, and only aliases get the implicit one that makes this assignable.
export type ToolText = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

export function textResult(text: string): ToolText {
  return { content: [{ type: 'text', text }] };
}

export function errorResult<S extends string>(failure: ErrResult<S>): ToolText {
  const detail = failure.err.message ? `: ${failure.err.message}` : '';
  return { content: [{ type: 'text', text: `${failure.err.type}${detail}` }], isError: true };
}

/** Who is calling: resolved by the transport (API key → educator) before any tool runs. */
export interface ToolContext {
  /** The caller's user id, or null for an unauthenticated (read-only) client. */
  userId: string | null;
}
