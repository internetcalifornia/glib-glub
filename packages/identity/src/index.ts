/**
 * @glib-glub/identity — one account, many logins; roles; guardianship; age
 * bands. Policy modules take the two ports; the apps wire the Postgres store
 * and the Better Auth authenticator.
 */

export { canManageOwnObjectives, canSelfLinkProvider, parseAgeBand } from './age-band';
export { createAuth, SESSION_COOKIE_PREFIX } from './auth';
export type { Auth, AuthDeps, AuthEnv } from './auth';
export { betterAuthAuthenticator, cookieHeaderFrom } from './better-auth-authenticator';
export type { IdentityErrorTag } from './errors';
export { acceptGuardianship, inviteLearner, isGuardianOf } from './guardianship';
export type { GuardianshipDeps } from './guardianship';
export { linkLogin, resolveSocialSignIn, TRUSTED_PROVIDERS, unlinkLogin } from './linking';
export type { LinkingDeps, SocialIdentity } from './linking';
export type {
  Authenticator,
  IdentityStore,
  PasskeyAssertion,
  PasskeyAttestation,
  Session,
  StoreErrorTag,
} from './ports';
export { grantRole, hasRole, onUserCreated } from './roles';
export type { RoleDeps } from './roles';
export { getSessionUser } from './session';
export { GATEWAY_TICKET_TTL_SECONDS, issueGatewayTicket, verifyGatewayTicket } from './ticket';
export type { TicketErrorTag } from './ticket';
export type { SessionDeps } from './session';
export { IDENTITY_TABLES, kyselyIdentityStore } from './store';
export {
  fakeAssertion,
  fakeAttestation,
  identityWorld,
  memoryIdentity,
  strangerId,
} from './testing';
export type { IdentityWorld, MemoryIdentity } from './testing';
export { AGE_BANDS, PROVIDERS, ROLES } from './types';
export type {
  AgeBand,
  Guardianship,
  GuardianshipStatus,
  Login,
  Passkey,
  Provider,
  Role,
  SessionUser,
  SocialProvider,
  User,
} from './types';
