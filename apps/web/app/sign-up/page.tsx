import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SignUpForm } from '@/components/auth-forms';
import { Shell } from '@/components/shell';
import { Card } from '@/components/ui';
import { enabledProviders } from '@/lib/providers';
import { getSessionFromHeaders } from '@/lib/session';

export const metadata = { title: 'Create an account' };

export default async function SignUpPage() {
  const session = await getSessionFromHeaders();
  if (session.ok) redirect('/home');
  return (
    <Shell user={null} title="Create an account">
      <Card>
        <SignUpForm providers={enabledProviders()} />
      </Card>
      <p className="text-sm">
        Already have one?{' '}
        <Link href="/sign-in" className="underline">
          Sign in
        </Link>
      </p>
    </Shell>
  );
}
