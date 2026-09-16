/**
 * The front door. A signed-in person goes straight to /home; everyone else
 * sees what the product is and the two ways in.
 */

import { PRODUCT_NAME, TUTOR_NAME } from '@glib-glub/core';
import { redirect } from 'next/navigation';

import { Card, LinkButton } from '@/components/ui';
import { Shell } from '@/components/shell';
import { getSessionFromHeaders } from '@/lib/session';

export default async function Landing() {
  const session = await getSessionFromHeaders();
  if (session.ok) redirect('/home');

  return (
    <Shell user={null} title={`Talk to ${TUTOR_NAME}`}>
      <Card>
        <p className="mb-4">
          {PRODUCT_NAME} is a tutor you speak with. It starts from what you already know, asks
          before it tells, and never hands over an answer you have not tried for.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <LinkButton href="/sign-in">Sign in</LinkButton>
          <LinkButton href="/sign-up" variant="secondary">
            Create an account
          </LinkButton>
        </div>
      </Card>
      <Card title="For parents and educators">
        <p className="text-sm">
          Sit in on a session, set objectives, upload past work, or author a whole track — in the
          app or over MCP.
        </p>
      </Card>
    </Shell>
  );
}
