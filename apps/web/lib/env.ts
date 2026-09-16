/**
 * The web app's validated environment, read once per process. Anchored on
 * globalThis because Next evaluates instrumentation, routes and the proxy as
 * separate graphs; a module-level cache would validate three times and, worse,
 * could disagree.
 */

import { loadEnv, webEnvSchema, type WebEnv } from '@glib-glub/config';
import type { Result } from '@campfhir/safe-functions/types';

export type EnvErrorTag = 'INVALID_ENV';

interface EnvSlot {
  __glibGlubEnv?: Result<WebEnv, EnvErrorTag>;
}

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- globalThis has no declared slot for our state; this is the documented split-singleton guard
const slot = globalThis as unknown as EnvSlot;

export function getEnv(): Result<WebEnv, EnvErrorTag> {
  slot.__glibGlubEnv ??= loadEnv(webEnvSchema);
  return slot.__glibGlubEnv;
}
