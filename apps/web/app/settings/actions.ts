'use server';

/**
 * Account settings: age band, the educator role, MCP API keys, and
 * guardianship. Every action verifies the session itself.
 */

import { brandId, isUuid } from '@glib-glub/core';
import { acceptGuardianship, inviteLearner, parseAgeBand } from '@glib-glub/identity';
import { revalidatePath } from 'next/cache';

import { failed, succeeded, type ActionState } from '@/lib/actions';
import { getDeps } from '@/lib/deps';
import { createApiKey, revokeApiKey } from '@/lib/mcp/api-keys';
import { getSessionFromHeaders } from '@/lib/session';

export async function setAgeBandAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSessionFromHeaders();
  if (!session.ok) return failed(session);
  const deps = getDeps();
  if (!deps.ok) return failed(deps);
  const band = parseAgeBand(String(formData.get('ageBand') ?? ''));
  if (!band.ok) return failed(band);
  const saved = await deps.val.identity.setAgeBand(session.val.userId, band.val);
  if (!saved.ok) return failed(saved);
  revalidatePath('/settings');
  return succeeded('Saved. The tutor adjusts its pace and voice to this.');
}

/**
 * Phase 0: educators declare themselves (Decision #9). Track publishing is
 * still gated on the role, and every track carries its author, so a
 * verification step can be added in front of this without touching the
 * catalogue.
 */
export async function becomeEducatorAction(_previous: ActionState): Promise<ActionState> {
  const session = await getSessionFromHeaders();
  if (!session.ok) return failed(session);
  const deps = getDeps();
  if (!deps.ok) return failed(deps);
  const granted = await deps.val.identity.addRole(session.val.userId, 'educator');
  if (!granted.ok) return failed(granted);
  revalidatePath('/settings');
  return succeeded('You can now author tracks, in the app and over MCP.');
}

export async function createApiKeyAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSessionFromHeaders();
  if (!session.ok) return failed(session);
  if (!session.val.roles.includes('educator'))
    return { ok: false, tag: 'FORBIDDEN', error: 'Only educators can create MCP keys.' };
  const deps = getDeps();
  if (!deps.ok) return failed(deps);
  const created = await createApiKey(deps.val.db, {
    userId: session.val.userId,
    name: String(formData.get('name') ?? ''),
    now: deps.val.clock.now(),
  });
  if (!created.ok) return failed(created);
  revalidatePath('/settings');
  // Shown once: only the digest is stored.
  return succeeded(`Your new key (copy it now, it will not be shown again): ${created.val.secret}`);
}

export async function revokeApiKeyAction(
  keyId: string,
  _previous: ActionState
): Promise<ActionState> {
  const session = await getSessionFromHeaders();
  if (!session.ok) return failed(session);
  const deps = getDeps();
  if (!deps.ok) return failed(deps);
  if (!isUuid(keyId)) return { ok: false, error: 'Not a key' };
  const revoked = await revokeApiKey(deps.val.db, {
    userId: session.val.userId,
    id: brandId<'mcp_api_key'>(keyId),
    now: deps.val.clock.now(),
  });
  if (!revoked.ok) return failed(revoked);
  revalidatePath('/settings');
  return succeeded('Revoked.');
}

export async function inviteLearnerAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSessionFromHeaders();
  if (!session.ok) return failed(session);
  const deps = getDeps();
  if (!deps.ok) return failed(deps);
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const learner = await deps.val.identity.findUserByEmail(email);
  if (!learner.ok) return failed(learner);
  if (!learner.val)
    return { ok: false, tag: 'NOT_FOUND', error: 'No account with that email yet.' };
  const invited = await inviteLearner(
    { store: deps.val.identity },
    { guardianId: session.val.userId, learnerId: learner.val.id }
  );
  if (!invited.ok) return failed(invited);
  revalidatePath('/settings');
  return succeeded(`Invited ${learner.val.name}. They accept from their own settings page.`);
}

export async function acceptGuardianAction(
  guardianId: string,
  _previous: ActionState
): Promise<ActionState> {
  const session = await getSessionFromHeaders();
  if (!session.ok) return failed(session);
  const deps = getDeps();
  if (!deps.ok) return failed(deps);
  if (!isUuid(guardianId)) return { ok: false, error: 'Not a person' };
  const accepted = await acceptGuardianship(
    { store: deps.val.identity },
    {
      actorId: session.val.userId,
      guardianId: brandId<'user'>(guardianId),
      learnerId: session.val.userId,
    }
  );
  if (!accepted.ok) return failed(accepted);
  revalidatePath('/settings');
  return succeeded('Accepted. They can now sit in on your sessions and set objectives.');
}
