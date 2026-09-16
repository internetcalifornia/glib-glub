/**
 * Which social buttons to show: exactly the providers with both halves of
 * their credential configured, so a half-configured provider cannot appear
 * and then fail at the callback.
 */

import { socialProvidersOf } from '@glib-glub/config';

import type { SocialProviderName } from '@/components/auth-forms';
import { getEnv } from './env';

export function enabledProviders(): SocialProviderName[] {
  const env = getEnv();
  if (!env.ok) return [];
  const providers = socialProvidersOf(env.val);
  const names: SocialProviderName[] = [];
  if (providers.google) names.push('google');
  if (providers.microsoft) names.push('microsoft');
  if (providers.facebook) names.push('facebook');
  return names;
}
