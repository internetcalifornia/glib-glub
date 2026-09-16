/**
 * The provider-agnostic chat contract every AI-backed feature runs against
 * — grading, summarising uploads, building self-directed tracks, the text
 * fallback of the tutor. The voice tutor speaks a different protocol (see
 * voice-live.ts) and does not go through this.
 *
 * Errors are a closed taxonomy, not exceptions: the caller's behaviour
 * differs by kind (an `auth` failure cannot be retried; a `rate_limit` can
 * wait; a `timeout` costs an attempt), so the kind IS the interface.
 *
 * Kept deliberately smaller than a general agent contract: one system
 * prompt, a turn list, optional JSON output. Tool use is the voice
 * gateway's business, over Voice Live's own function-calling events.
 */

import type { Result } from '@campfhir/safe-functions/types';

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  maxTokens: number;
  temperature?: number;
  /** Ask for a JSON object; the adapter sets the provider's JSON mode. */
  json?: boolean;
  /** Per-request wall-clock cap, overriding the adapter's default. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmResponse {
  text: string;
  stopReason: 'end_turn' | 'max_tokens';
  usage: LlmUsage;
  /** The deployment/model that answered — stamped on grading rows. */
  model: string;
}

export type LlmErrorKind =
  | 'auth'
  | 'rate_limit'
  | 'invalid_request'
  | 'overloaded'
  | 'provider_error'
  | 'timeout'
  | 'network'
  /** The caller's own AbortSignal fired — a cancel, not a fault. */
  | 'aborted';

export interface LlmProvider {
  complete(request: LlmRequest): Promise<Result<LlmResponse, LlmErrorKind>>;
}

/**
 * Whether an error body is a provider saying "your credential is no good",
 * whatever status it chose to say it with. A gateway in front of the model
 * answers a rejected upstream credential with 503, and 503 otherwise means
 * "transient, retry me" — retrying a dead key can never come true.
 */
const CREDENTIAL_FAILURE_PHRASES = [
  'credential validation failed',
  'invalid api key',
  'invalid_api_key',
  'incorrect api key',
  'authentication_error',
  'authentication failed',
  'unauthorized',
  'permission_error',
];

export function looksLikeCredentialFailure(body: string): boolean {
  if (!body) return false;
  const haystack = body.toLowerCase();
  return CREDENTIAL_FAILURE_PHRASES.some((phrase) => haystack.includes(phrase));
}

export function errorKindOf(status: number, body = ''): LlmErrorKind {
  if (looksLikeCredentialFailure(body)) return 'auth';
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  // 404 is here deliberately: on Azure it means "no such deployment",
  // which retrying can never fix.
  if (status === 400 || status === 404 || status === 413 || status === 422)
    return 'invalid_request';
  if (status === 503) return 'overloaded';
  return 'provider_error';
}

/** The error kind for a thrown fetch failure: a cancel, a deadline, or the network. */
export function transportErrorKind(error: unknown, signal?: AbortSignal): LlmErrorKind {
  if (signal?.aborted) return 'aborted';
  if (error instanceof Error) {
    if (error.name === 'TimeoutError') return 'timeout';
    if (error.name === 'AbortError') return 'aborted';
  }
  return 'network';
}
