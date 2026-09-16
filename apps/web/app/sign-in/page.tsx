import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SignInForm } from '@/components/auth-forms';
import { Shell } from '@/components/shell';
import { Card } from '@/components/ui';
import { enabledProviders } from '@/lib/providers';
import { getSessionFromHeaders } from '@/lib/session';

export const metadata = { title: 'Sign in' };

export default async function SignInPage() {
  const session = await getSessionFromHeaders();
  if (session.ok) redirect('/home');
  return (
    <Shell user={null} title="Sign in">
      <Card>
        <SignInForm providers={enabledProviders()} />
      </Card>
      <p className="text-sm">
        New here?{' '}
        <Link href="/sign-up" className="underline">
          Create an account
        </Link>
      </p>
    </Shell>
  );
}
