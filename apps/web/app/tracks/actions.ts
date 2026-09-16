'use server';

/**
 * Enrolment from the track page. Verified against the session inside the
 * action, as every action must be — the page rendering the form proves
 * nothing about who submits it.
 */

import { brandId, isUuid } from '@glib-glub/core';
import { enroll } from '@glib-glub/curriculum';
import { revalidatePath } from 'next/cache';

import { failed, succeeded, type ActionState } from '@/lib/actions';
import { getDeps } from '@/lib/deps';
import { getSessionFromHeaders } from '@/lib/session';

export async function enrollAction(
  trackId: string,
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSessionFromHeaders();
  if (!session.ok) return failed(session);
  const deps = getDeps();
  if (!deps.ok) return failed(deps);
  if (!isUuid(trackId)) return { ok: false, error: 'Not a track' };
  const cadence = formData.get('cadence') === 'weekly' ? 'weekly' : 'daily';
  const sessionsPerPeriod = Number(formData.get('sessionsPerPeriod') ?? 1);

  const enrolled = await enroll(
    { store: deps.val.curriculum },
    {
      learnerId: session.val.userId,
      trackId: brandId<'track'>(trackId),
      cadence,
      sessionsPerPeriod,
      now: deps.val.clock.now(),
    }
  );
  if (!enrolled.ok) return failed(enrolled);
  revalidatePath(`/tracks/${trackId}`);
  revalidatePath('/home');
  return succeeded('Enrolled. Your first lesson is waiting on the home page.');
}
