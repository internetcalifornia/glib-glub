/**
 * The age band is the one fact about a learner that changes what the
 * platform lets them do. The rules are tiny and live here, together, so a
 * reviewer can see every consequence of a band in one screen — and so
 * PLATFORM.md's safety defaults have exactly one implementation.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { Result } from '@campfhir/safe-functions/types';

import { AGE_BANDS, type AgeBand, type Provider } from './types';

export function parseAgeBand(value: string): Result<AgeBand, 'VALIDATION_ERROR'> {
  const band = AGE_BANDS.find((candidate) => candidate === value);
  return band ? ok(band) : err('VALIDATION_ERROR', { message: `Unknown age band "${value}"` });
}

/** Learners from 9-12 up own their objectives; younger ones need a guardian. */
export function canManageOwnObjectives(band: AgeBand | null): boolean {
  return band === '9-12' || band === 'university' || band === 'adult';
}

/**
 * Which providers a learner may link for themselves. Facebook's terms and the
 * platform's own safety default (PLATFORM.md) keep it away from the youngest
 * two bands unless a guardian does the linking. An unknown band is treated
 * as the most restrictive one: a learner whose band has not been set yet is
 * not thereby an adult.
 */
export function canSelfLinkProvider(band: AgeBand | null, provider: Provider): boolean {
  if (provider !== 'facebook') return true;
  return band === '9-12' || band === 'university' || band === 'adult';
}
