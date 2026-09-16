/**
 * A live session. The server page resolves who and what (track, transport,
 * mode, the other person in the room) and hands the client component the
 * action that mints a gateway ticket; everything after that is the browser
 * talking to the gateway and, for voice, to Azure over WebRTC.
 */

import { isUuid } from '@glib-glub/core';
import { redirect } from 'next/navigation';

import { SessionClient } from '@/components/session-client';
import { Shell } from '@/components/shell';
import { Card, Field, inputClass, Button } from '@/components/ui';
import { getSessionFromHeaders } from '@/lib/session';

import { issueTicketAction } from './actions';

export const metadata = { title: 'Session' };

type Search = { track?: string; transport?: string; mode?: string; name?: string };

export default async function SessionPage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await getSessionFromHeaders();
  if (!session.ok) redirect('/sign-in');
  const query = await searchParams;
  const transport = query.transport === 'text' ? 'text' : 'voice';
  const mode =
    query.mode === 'with_guardian' || query.mode === 'with_educator' ? query.mode : 'solo';
  const trackId = query.track && isUuid(query.track) ? query.track : null;
  const other = query.name?.trim() ?? '';

  if (mode !== 'solo' && !other) {
    return (
      <Shell user={session.val} title="Who is with you?">
        <Card>
          <form method="get" className="space-y-3">
            <input type="hidden" name="track" value={trackId ?? ''} />
            <input type="hidden" name="transport" value={transport} />
            <input type="hidden" name="mode" value={mode} />
            <Field
              label={
                mode === 'with_guardian' ? "Your parent or guardian's name" : "Your teacher's name"
              }
            >
              <input name="name" className={inputClass} required maxLength={80} />
            </Field>
            <Button type="submit">Continue</Button>
          </form>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell user={session.val} title={transport === 'voice' ? 'Talking' : 'Typing'}>
      <SessionClient
        issueTicket={issueTicketAction}
        start={{
          trackId,
          transport,
          mode,
          others: other
            ? [{ name: other, role: mode === 'with_guardian' ? 'guardian' : 'educator' }]
            : [],
        }}
        learnerName={session.val.name}
      />
    </Shell>
  );
}
