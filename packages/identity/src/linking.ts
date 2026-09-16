/**
 * The account-linking policy: one account, many logins, with the rules that
 * keep it safe.
 *
 * Better Auth implements the same rules in its OAuth callback for the
 * production sign-in path — `TRUSTED_PROVIDERS` is handed to its
 * `accountLinking` option from here, so the two cannot drift. What this
 * module adds is everything Better Auth does not know about: age bands,
 * guardians linking on a learner's behalf, and the last-login guard.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import type { UserId } from '@glib-glub/core';

import { canSelfLinkProvider } from './age-band';
import { isGuardianOf } from './guardianship';
import type { IdentityStore } from './ports';
import type { Login, Provider, SocialProvider, User } from './types';

/**
 * Providers whose verified email is accepted as proof of ownership, so a
 * first sign-in through them joins an existing account with the same email.
 * Facebook is absent on purpose: its email claim is not reliably verified.
 */
export const TRUSTED_PROVIDERS: ReadonlyArray<SocialProvider> = ['google', 'microsoft'];

export interface LinkingDeps {
  store: IdentityStore;
}

/**
 * Link a provider login to a user. The actor is either the user themselves
 * (subject to their age band) or an accepted guardian of the user (not
 * subject to it — that is the point of a guardian).
 */
export async function linkLogin(
  deps: LinkingDeps,
  input: { actorId: UserId; targetUserId: UserId; provider: Provider; providerAccountId: string }
): AsyncResult<
  Login,
  'FORBIDDEN' | 'PROVIDER_NOT_ALLOWED_FOR_AGE' | 'ALREADY_LINKED' | 'DB_ERROR'
> {
  if (input.actorId === input.targetUserId) {
    const band = await deps.store.getAgeBand(input.targetUserId);
    if (!band.ok) return band;
    if (!canSelfLinkProvider(band.val, input.provider)) {
      return err('PROVIDER_NOT_ALLOWED_FOR_AGE', {
        message: `A learner in age band ${band.val ?? 'unset'} cannot link ${input.provider}; a guardian can`,
      });
    }
  } else {
    const guardian = await isGuardianOf(deps, input.actorId, input.targetUserId);
    if (!guardian.ok) return guardian;
    if (!guardian.val) {
      return err('FORBIDDEN', { message: 'Only the person or their guardian may link a login' });
    }
  }
  return deps.store.addLogin({
    userId: input.targetUserId,
    provider: input.provider,
    providerAccountId: input.providerAccountId,
  });
}

/** Remove a login — never the last one. */
export async function unlinkLogin(
  deps: LinkingDeps,
  input: { actorId: UserId; loginId: string }
): AsyncResult<void, 'LAST_LOGIN' | 'NOT_FOUND' | 'DB_ERROR'> {
  const logins = await deps.store.listLogins(input.actorId);
  if (!logins.ok) return logins;
  const target = logins.val.find((login) => login.id === input.loginId);
  if (!target) return err('NOT_FOUND', { message: 'No such login on this account' });
  if (logins.val.length <= 1) {
    return err('LAST_LOGIN', { message: 'Removing the only login would lock you out' });
  }
  return deps.store.removeLogin(input.actorId, input.loginId);
}

export interface SocialIdentity {
  provider: SocialProvider;
  providerAccountId: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

/**
 * What happens when a social identity arrives at sign-in:
 * - already linked → that account;
 * - email matches an account and the provider is trusted with a verified
 *   email → link and sign in;
 * - email matches but the provider is not trusted → refuse; the person must
 *   sign in another way and link explicitly;
 * - no match → a new account.
 */
export async function resolveSocialSignIn(
  deps: LinkingDeps,
  identity: SocialIdentity
): AsyncResult<User, 'LINK_REQUIRES_SESSION' | 'ALREADY_LINKED' | 'NOT_FOUND' | 'DB_ERROR'> {
  const linked = await deps.store.findLogin(identity.provider, identity.providerAccountId);
  if (!linked.ok) return linked;
  if (linked.val) return deps.store.getUser(linked.val.userId);

  const byEmail = await deps.store.findUserByEmail(identity.email);
  if (!byEmail.ok) return byEmail;

  if (byEmail.val) {
    const trusted = TRUSTED_PROVIDERS.includes(identity.provider) && identity.emailVerified;
    if (!trusted) {
      return err('LINK_REQUIRES_SESSION', {
        message: `An account for ${identity.email} exists; sign in to it and link ${identity.provider} from your profile`,
      });
    }
    const added = await deps.store.addLogin({
      userId: byEmail.val.id,
      provider: identity.provider,
      providerAccountId: identity.providerAccountId,
    });
    if (!added.ok) return added;
    return ok(byEmail.val);
  }

  const created = await deps.store.createUser({
    email: identity.email,
    name: identity.name,
    emailVerified: identity.emailVerified,
  });
  if (!created.ok) return created;
  const added = await deps.store.addLogin({
    userId: created.val.id,
    provider: identity.provider,
    providerAccountId: identity.providerAccountId,
  });
  if (!added.ok) return added;
  return ok(created.val);
}
