'use client';

/**
 * Sign-in and sign-up, on the client because every ceremony (password,
 * social redirect, passkey) is Better Auth's browser client talking to
 * /api/auth. Only providers with credentials configured are offered; the
 * server page decides that list.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, Field, inputClass } from '@/components/ui';
import { authClient } from '@/lib/auth-client';

export type SocialProviderName = 'google' | 'microsoft' | 'facebook';

const PROVIDER_LABEL: Record<SocialProviderName, string> = {
  google: 'Continue with Google',
  microsoft: 'Continue with Microsoft',
  facebook: 'Continue with Facebook',
};

function SocialButtons({ providers }: { providers: SocialProviderName[] }) {
  if (providers.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {providers.map((provider) => (
        <Button
          key={provider}
          type="button"
          variant="secondary"
          onClick={() => authClient.signIn.social({ provider, callbackURL: '/home' })}
        >
          {PROVIDER_LABEL[provider]}
        </Button>
      ))}
    </div>
  );
}

export function SignInForm({ providers }: { providers: SocialProviderName[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="space-y-4">
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError(null);
          const form = new FormData(event.currentTarget);
          const result = await authClient.signIn.email({
            email: String(form.get('email') ?? ''),
            password: String(form.get('password') ?? ''),
          });
          setPending(false);
          if (result.error) {
            setError(result.error.message ?? 'Could not sign in');
            return;
          }
          router.push('/home');
          router.refresh();
        }}
      >
        <Field label="Email">
          <input className={inputClass} name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password">
          <input
            className={inputClass}
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        {error ? (
          <p role="alert" className="text-sm text-warn">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full">
          Sign in
        </Button>
      </form>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={async () => {
          setError(null);
          const result = await authClient.signIn.passkey();
          if (result?.error) {
            setError(result.error.message ?? 'Passkey sign-in failed');
            return;
          }
          router.push('/home');
          router.refresh();
        }}
      >
        Sign in with a passkey
      </Button>
      <SocialButtons providers={providers} />
    </div>
  );
}

export function SignUpForm({ providers }: { providers: SocialProviderName[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="space-y-4">
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError(null);
          const form = new FormData(event.currentTarget);
          const result = await authClient.signUp.email({
            name: String(form.get('name') ?? ''),
            email: String(form.get('email') ?? ''),
            password: String(form.get('password') ?? ''),
          });
          setPending(false);
          if (result.error) {
            setError(result.error.message ?? 'Could not create the account');
            return;
          }
          router.push('/settings?welcome=1');
          router.refresh();
        }}
      >
        <Field label="Your name" hint="What the tutor will call you.">
          <input className={inputClass} name="name" autoComplete="name" required />
        </Field>
        <Field label="Email">
          <input className={inputClass} name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" hint="At least eight characters.">
          <input
            className={inputClass}
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
        {error ? (
          <p role="alert" className="text-sm text-warn">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full">
          Create account
        </Button>
      </form>
      <SocialButtons providers={providers} />
    </div>
  );
}

export function AddPasskeyButton() {
  const [state, setState] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        onClick={async () => {
          const result = await authClient.passkey.addPasskey({ name: 'This device' });
          setState(
            result?.error ? (result.error.message ?? 'Could not add a passkey') : 'Passkey added.'
          );
        }}
      >
        Add a passkey for this device
      </Button>
      {state ? <p className="text-sm">{state}</p> : null}
    </div>
  );
}
