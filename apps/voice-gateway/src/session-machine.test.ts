/**
 * The state machine: the happy path walks idle → starting → live → ending →
 * ended; failure is reachable from every live state and from nowhere
 * after; nothing leaves a terminal state.
 */

import { describe, expect, it } from 'vitest';

import { isTerminal, transition, type GatewayEvent, type GatewayState } from './session-machine';

function walk(from: GatewayState, events: GatewayEvent[]): GatewayState | string {
  let state = from;
  for (const event of events) {
    const next = transition(state, event);
    if (!next.ok) return next.err.type;
    state = next.val;
  }
  return state;
}

describe('transition', () => {
  it('walks the happy path to ended', () => {
    expect(walk('idle', ['start', 'started', 'end', 'ended'])).toBe('ended');
  });

  it('refuses an SDP-era event before the session started', () => {
    expect(walk('idle', ['started'])).toBe('INVALID_TRANSITION');
  });

  it('refuses a second end', () => {
    expect(walk('idle', ['start', 'started', 'end', 'ended', 'end'])).toBe('INVALID_TRANSITION');
  });

  it('can fail from every non-terminal state and never leaves a terminal one', () => {
    for (const state of ['idle', 'starting', 'live', 'ending'] as const) {
      expect(walk(state, ['fail'])).toBe('failed');
    }
    for (const state of ['ended', 'failed'] as const) {
      expect(isTerminal(state)).toBe(true);
      for (const event of ['start', 'started', 'end', 'ended', 'fail'] as const) {
        expect(walk(state, [event])).toBe('INVALID_TRANSITION');
      }
    }
  });
});
