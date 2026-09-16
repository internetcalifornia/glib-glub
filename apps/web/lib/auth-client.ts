/**
 * Better Auth's browser client (Decision #3): talks to /api/auth on the same
 * origin. The passkey plugin adds the WebAuthn ceremonies. Every call returns
 * `{ data, error }` rather than throwing, which is why the forms can stay
 * inside the harness without a try/catch.
 */

import { passkeyClient } from '@better-auth/passkey/client';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({ plugins: [passkeyClient()] });
