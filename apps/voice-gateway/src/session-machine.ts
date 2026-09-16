/**
 * The gateway's per-connection state machine, as data. Every transition
 * the bridge makes goes through `transition`, so an event arriving in the
 * wrong state (an SDP offer before the session started, a second end) is a
 * tagged refusal rather than a half-applied change.
 *
 *   idle → starting → live → ending → ended
 *                 ↘      ↘        ↘  failed
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { Result } from '@campfhir/safe-functions/types';

export type GatewayState = 'idle' | 'starting' | 'live' | 'ending' | 'ended' | 'failed';
export type GatewayEvent = 'start' | 'started' | 'end' | 'ended' | 'fail';

const TRANSITIONS: Record<GatewayState, Partial<Record<GatewayEvent, GatewayState>>> = {
  idle: { start: 'starting', fail: 'failed' },
  starting: { started: 'live', end: 'ending', fail: 'failed' },
  live: { end: 'ending', fail: 'failed' },
  ending: { ended: 'ended', fail: 'failed' },
  ended: {},
  failed: {},
};

export function transition(
  state: GatewayState,
  event: GatewayEvent
): Result<GatewayState, 'INVALID_TRANSITION'> {
  const next = TRANSITIONS[state][event];
  if (!next) return err('INVALID_TRANSITION', { message: `Cannot ${event} while ${state}` });
  return ok(next);
}

export function isTerminal(state: GatewayState): boolean {
  return state === 'ended' || state === 'failed';
}
