/**
 * Settings: the age band that drives pace and gating, sign-in methods,
 * the educator role and MCP keys, and guardianship in both directions.
 */

import { AGE_BANDS } from '@glib-glub/identity';
import { redirect } from 'next/navigation';

import { ActionForm } from '@/components/action-form';
import { AddPasskeyButton } from '@/components/auth-forms';
import { Shell } from '@/components/shell';
import { Card, Empty, Field, inputClass } from '@/components/ui';
import { getDeps } from '@/lib/deps';
import { listApiKeys } from '@/lib/mcp/api-keys';
import { getSessionFromHeaders } from '@/lib/session';

import {
  acceptGuardianAction,
  becomeEducatorAction,
  createApiKeyAction,
  inviteLearnerAction,
  revokeApiKeyAction,
  setAgeBandAction,
} from './actions';

export const metadata = { title: 'Settings' };

const BAND_LABEL: Record<string, string> = {
  'k-5': 'Kindergarten to grade 5',
  '6-8': 'Grades 6 to 8',
  '9-12': 'Grades 9 to 12',
  university: 'University',
  adult: 'Adult / lifelong learner',
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const session = await getSessionFromHeaders();
  if (!session.ok) redirect('/sign-in');
  const deps = getDeps();
  if (!deps.ok)
    return (
      <Shell user={session.val} title="Settings">
        Configuration error.
      </Shell>
    );
  const { welcome } = await searchParams;
  const user = session.val;
  const isEducator = user.roles.includes('educator');
  const [keys, guardians, learners] = await Promise.all([
    isEducator ? listApiKeys(deps.val.db, user.userId) : Promise.resolve(null),
    deps.val.identity.listGuardiansOf(user.userId),
    deps.val.identity.listLearnersOf(user.userId),
  ]);
  const guardianNames = new Map<string, string>();
  for (const g of guardians.ok ? guardians.val : []) {
    const person = await deps.val.identity.getUser(g.guardianId);
    guardianNames.set(g.guardianId, person.ok ? person.val.name : 'Someone');
  }

  return (
    <Shell user={user} title={welcome ? 'Welcome! A couple of things first' : 'Settings'}>
      <Card title="Your level">
        <ActionForm action={setAgeBandAction} submit="Save">
          <Field
            label="Age band"
            hint="Sets how the tutor speaks and what younger learners can change alone."
          >
            <select
              name="ageBand"
              className={inputClass}
              defaultValue={user.ageBand ?? ''}
              required
            >
              <option value="" disabled>
                Choose…
              </option>
              {AGE_BANDS.map((band) => (
                <option key={band} value={band}>
                  {BAND_LABEL[band] ?? band}
                </option>
              ))}
            </select>
          </Field>
        </ActionForm>
      </Card>

      <Card title="Signing in">
        <p className="mb-2 text-sm">
          Signed in as {user.email}. Roles: {user.roles.join(', ')}.
        </p>
        <AddPasskeyButton />
      </Card>

      <Card title="Teaching">
        {isEducator ? (
          <>
            <p className="mb-3 text-sm">
              MCP keys let an authoring agent create tracks as you. Point it at{' '}
              <code>/api/mcp</code> with the key as a bearer token.
            </p>
            {keys && keys.ok && keys.val.length > 0 ? (
              <ul className="mb-3 space-y-2">
                {keys.val.map((key) => (
                  <li key={key.id} className="flex items-center justify-between gap-2">
                    <span>
                      {key.name}
                      <span className="block text-xs opacity-70">
                        created {key.createdAt.toLocaleDateString()}
                        {key.lastUsedAt
                          ? ` · last used ${key.lastUsedAt.toLocaleDateString()}`
                          : ' · never used'}
                        {key.revokedAt ? ' · revoked' : ''}
                      </span>
                    </span>
                    {key.revokedAt ? null : (
                      <ActionForm
                        action={revokeApiKeyAction.bind(null, key.id)}
                        submit="Revoke"
                        variant="secondary"
                        className="inline"
                      />
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No keys yet.</Empty>
            )}
            <ActionForm action={createApiKeyAction} submit="Create key">
              <Field label="Key name" hint="Which agent or tool will use it.">
                <input name="name" className={inputClass} required maxLength={60} />
              </Field>
            </ActionForm>
          </>
        ) : (
          <ActionForm action={becomeEducatorAction} submit="Register as an educator">
            <p className="text-sm">Author tracks for others, in the app or over MCP.</p>
          </ActionForm>
        )}
      </Card>

      <Card title="Parents and guardians">
        {guardians.ok && guardians.val.some((g) => g.status === 'invited') ? (
          <ul className="mb-3 space-y-2">
            {guardians.val
              .filter((g) => g.status === 'invited')
              .map((g) => (
                <li key={g.guardianId} className="flex items-center justify-between gap-2">
                  <span>{guardianNames.get(g.guardianId)} wants to be your guardian</span>
                  <ActionForm
                    action={acceptGuardianAction.bind(null, g.guardianId)}
                    submit="Accept"
                    className="inline"
                  />
                </li>
              ))}
          </ul>
        ) : null}
        {guardians.ok && guardians.val.some((g) => g.status === 'accepted') ? (
          <p className="mb-3 text-sm">
            Your guardians:{' '}
            {guardians.val
              .filter((g) => g.status === 'accepted')
              .map((g) => guardianNames.get(g.guardianId))
              .join(', ')}
          </p>
        ) : null}
        {learners.ok && learners.val.length > 0 ? (
          <p className="mb-3 text-sm">
            You look after {learners.val.length} learner{learners.val.length === 1 ? '' : 's'} (
            {learners.val.map((l) => l.status).join(', ')}).
          </p>
        ) : null}
        <ActionForm action={inviteLearnerAction} submit="Invite a learner">
          <Field
            label="Learner's email"
            hint="They must already have an account; they accept from their settings."
          >
            <input name="email" type="email" className={inputClass} required />
          </Field>
        </ActionForm>
      </Card>
    </Shell>
  );
}
