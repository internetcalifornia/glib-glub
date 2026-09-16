/**
 * `Authenticator` over Better Auth's server API. Better Auth throws
 * `APIError`; every call here is wrapped, and the error's body code is what
 * decides the tag — a duplicate email is EMAIL_TAKEN, a bad password is
 * INVALID_CREDENTIALS, anything else is AUTH_ERROR with the cause attached.
 */

import { err, ok, wrapAsync } from '@campfhir/safe-functions/helpers';
import type { AsyncResult, ErrResult } from '@campfhir/safe-functions/types';
import { brandId } from '@glib-glub/core';
import { isAPIError } from 'better-auth/api';

import type { Auth } from './auth';
import type { Authenticator, Session } from './ports';

function errorCode(cause: unknown): string | null {
  if (!isAPIError(cause)) return null;
  const body: unknown = cause.body;
  if (
    typeof body === 'object' &&
    body !== null &&
    'code' in body &&
    typeof body.code === 'string'
  ) {
    return body.code;
  }
  return null;
}

function errorStatus(cause: unknown): number | null {
  return isAPIError(cause) ? cause.statusCode : null;
}

/** The request `cookie` header a browser would send after these responses. */
export function cookieHeaderFrom(responseHeaders: Headers): string {
  return responseHeaders
    .getSetCookie()
    .map((line) => line.split(';')[0] ?? '')
    .filter((pair) => pair.length > 0)
    .join('; ');
}

export function betterAuthAuthenticator(auth: Auth): Authenticator {
  return {
    signUpWithPassword: async (input): ReturnType<Authenticator['signUpWithPassword']> => {
      const outcome = await wrapAsync(
        () =>
          auth.api.signUpEmail({
            body: { email: input.email, password: input.password, name: input.name },
            returnHeaders: true,
          }),
        'AUTH_ERROR'
      );
      if (!outcome.ok) {
        const code = errorCode(outcome.err.cause);
        if (code === 'USER_ALREADY_EXISTS' || code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
          return err('EMAIL_TAKEN', { message: outcome.err.message });
        }
        if (errorStatus(outcome.err.cause) === 400) {
          return err('VALIDATION_ERROR', { message: outcome.err.message });
        }
        return outcome;
      }
      const { response, headers } = outcome.val;
      if (!response.token) {
        return err('AUTH_ERROR', { message: 'Sign-up succeeded without a session token' });
      }
      return ok(
        withCookies({ userId: brandId<'user'>(response.user.id), token: response.token }, headers)
      );
    },

    signInWithPassword: async (input): ReturnType<Authenticator['signInWithPassword']> => {
      const outcome = await wrapAsync(
        () =>
          auth.api.signInEmail({
            body: { email: input.email, password: input.password },
            returnHeaders: true,
          }),
        'AUTH_ERROR'
      );
      if (!outcome.ok) {
        const status = errorStatus(outcome.err.cause);
        if (
          status === 401 ||
          status === 403 ||
          errorCode(outcome.err.cause) === 'INVALID_EMAIL_OR_PASSWORD'
        ) {
          return err('INVALID_CREDENTIALS', { message: 'Invalid email or password' });
        }
        return outcome;
      }
      const { response, headers } = outcome.val;
      return ok(
        withCookies({ userId: brandId<'user'>(response.user.id), token: response.token }, headers)
      );
    },

    sessionFromHeaders: async (headers): ReturnType<Authenticator['sessionFromHeaders']> => {
      const outcome = await wrapAsync(() => auth.api.getSession({ headers }), 'AUTH_ERROR');
      if (!outcome.ok) return outcome;
      if (!outcome.val) return err('NO_SESSION');
      return ok({ userId: brandId<'user'>(outcome.val.user.id), token: outcome.val.session.token });
    },

    signInWithPasskey: async (input): ReturnType<Authenticator['signInWithPasskey']> => {
      const outcome = await wrapAsync(
        () =>
          auth.api.verifyPasskeyAuthentication({
            // The WebAuthn assertion from the browser, passed through as-is;
            // Better Auth verifies it against the stored public key.
            body: { response: input.assertion },
            returnHeaders: true,
          }),
        'AUTH_ERROR'
      );
      if (!outcome.ok) {
        const status = errorStatus(outcome.err.cause);
        if (status === 401 || status === 400) return err('INVALID_CREDENTIALS');
        return outcome;
      }
      const { response, headers } = outcome.val;
      if (!response?.session) return err('INVALID_CREDENTIALS');
      return ok(
        withCookies(
          { userId: brandId<'user'>(response.session.userId), token: response.session.token },
          headers
        )
      );
    },

    registerPasskey: async (input): ReturnType<Authenticator['registerPasskey']> => {
      const outcome = await wrapAsync(
        () =>
          auth.api.verifyPasskeyRegistration({
            headers: new Headers({ cookie: input.session.cookie ?? '' }),
            body: { response: input.attestation, name: input.name },
          }),
        'AUTH_ERROR'
      );
      if (!outcome.ok) {
        if (errorStatus(outcome.err.cause) === 401) return err('NO_SESSION');
        return outcome;
      }
      if (!outcome.val)
        return err('AUTH_ERROR', { message: 'Passkey registration returned nothing' });
      return ok({
        id: outcome.val.id,
        userId: brandId<'user'>(outcome.val.userId),
        name: outcome.val.name ?? null,
        credentialId: outcome.val.credentialID,
      });
    },
  };
}

function withCookies(session: Session, headers: Headers): Session {
  return { ...session, cookie: cookieHeaderFrom(headers) };
}

export type AuthFailure = ErrResult<'AUTH_ERROR'>;
export type { AsyncResult };
