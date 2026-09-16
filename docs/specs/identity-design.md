# Identity — design

_2026-09-16. Point-in-time; see `docs/README.md`._

## What exists today

The foundation packages. No users, no sessions.

## Why this exists

One learner is one account, however they arrive: a Google login today, a
Microsoft login from school tomorrow, a password when neither is at hand, a
passkey once the device supports it. Around that account sit the adults —
guardians who set objectives and sit in on sessions, educators who author
tracks and grade — and the rules that keep a minor safe: who may link what,
who may change objectives, what the tutor may store.

## Proposal

### Better Auth behind a port (Decision #3)

`packages/identity/src/auth.ts` builds the Better Auth instance from
`WebEnv`: Kysely over the shared pool, database sessions with an opaque
cookie, email + password, the Google / Microsoft / Facebook providers that
have credentials, the passkey plugin, and account linking with Google and
Microsoft as trusted providers (their emails are verified). Facebook is
never trusted for implicit linking; it links only from a signed-in session.

Every call into Better Auth goes through `wrapAsync`, so `APIError` becomes
`err('AUTH_ERROR', { message, cause })` and nothing above this package sees
an exception. The web app mounts `auth.handler` at `/api/auth/[...all]`.

### Our own tables beside Better Auth's

Better Auth owns `user`, `session`, `account`, `verification`, `passkey`.
We add:

- `user_roles (user_id, role)` — `learner | guardian | educator | admin`; a user may hold several.
- `guardianships (guardian_id, learner_id, status, invited_at, accepted_at)` — invitation → accepted.
- `learner_settings (user_id, age_band, date_of_birth?)` — the age band drives gating; date of birth is optional and only ever used to derive the band.

### Age bands and gating

`k-5`, `6-8`, `9-12`, `university`, `adult`. Rules, enforced in code and
covered by feature files:

- A learner in `k-5` or `6-8` cannot link Facebook; a guardian can link it on their behalf.
- A learner under `9-12` cannot change learning objectives without a guardian (learner-profile enforces this using this package's `canManageObjectives`).
- Unlinking the last login is refused (`LAST_LOGIN`).

### Session guard for the web app

`getSessionFromHeaders(headers)` returns `Result<SessionUser, 'NO_SESSION'>`
where `SessionUser` carries the user id, roles and age band. Every page and
route handler references it or is listed in `route-auth-coverage.test.ts`
with a reason.

## Order

1. `features/*.feature`: password sign-up/in, social sign-in, linking, unlinking, passkeys, roles, guardianship, age-band gating.
2. Migrations `001-identity` (Better Auth tables) and `002-roles-guardianships`.
3. `auth.ts` (Better Auth construction), `session.ts`, `roles.ts`, `guardianship.ts`, `age-band.ts`, `linking.ts`, stores.
4. Web routes and pages.

## Guard rails

- Roles and age band are read from the database on every request, never from the cookie.
- No raw OAuth tokens are exposed above this package; nothing here needs them.
- Passkeys are behind a feature flag until the relying-party origin is configured in production.
