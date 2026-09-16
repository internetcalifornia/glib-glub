/**
 * Every way identity can fail, as one closed union. Boundaries map the
 * shared tags (NOT_FOUND, FORBIDDEN, …) through `statusForTag`; the tags
 * specific to this module are listed with what a caller can do about them.
 */

export type IdentityErrorTag =
  /** Wrong email or password — deliberately not saying which. */
  | 'INVALID_CREDENTIALS'
  /** Sign-up with an email that already has an account. */
  | 'EMAIL_TAKEN'
  /** Better Auth failed in a way we do not classify further. */
  | 'AUTH_ERROR'
  /** No valid session cookie on the request. */
  | 'NO_SESSION'
  /** Refused: removing this login would lock the person out. */
  | 'LAST_LOGIN'
  /** A social identity matched an existing account by email, but the provider
   *  is not trusted for implicit linking; sign in another way and link it. */
  | 'LINK_REQUIRES_SESSION'
  /** The learner's age band forbids linking this provider themselves. */
  | 'PROVIDER_NOT_ALLOWED_FOR_AGE'
  /** That provider account is already linked to an account. */
  | 'ALREADY_LINKED'
  /** A guardianship in the wrong state for the operation. */
  | 'INVALID_STATE'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'DB_ERROR';
