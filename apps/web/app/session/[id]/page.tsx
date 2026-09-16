/**
 * A past session: the transcript, what the tutor did, and the summary the
 * next session started from. Visible to the learner and to anyone who was
 * in the room.
 */

import { brandId, isUuid, TUTOR_NAME } from '@glib-glub/core';
import type { Speaker } from '@glib-glub/tutor';
import { notFound, redirect } from 'next/navigation';

import { Shell } from '@/components/shell';
import { Card, Empty } from '@/components/ui';
import { getDeps } from '@/lib/deps';
import { getSessionFromHeaders } from '@/lib/session';

export default async function PastSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromHeaders();
  if (!session.ok) redirect('/sign-in');
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const deps = getDeps();
  if (!deps.ok)
    return (
      <Shell user={session.val} title="Session">
        Configuration error.
      </Shell>
    );
  const store = deps.val.tutor.store;
  const loaded = await store.getSession(brandId<'tutor_session'>(id));
  if (!loaded.ok || !loaded.val) notFound();
  const record = loaded.val;
  const me = session.val.userId;
  if (record.learnerId !== me && !record.participants.some((p) => p.userId === me)) notFound();
  const [turns, calls] = await Promise.all([
    store.listTurns(record.id),
    store.listToolCalls(record.id),
  ]);
  const nameOf = (speaker: Speaker) => {
    if (speaker.kind === 'tutor') return TUTOR_NAME;
    if (speaker.kind === 'unknown') return 'Unknown speaker';
    return record.participants.find((p) => p.id === speaker.participantId)?.name ?? 'Someone';
  };

  return (
    <Shell user={session.val} title={record.lessonTitle}>
      <Card>
        <p className="text-sm">
          {record.startedAt.toLocaleString()} · {record.status} · {record.transport}
          {record.mode !== 'solo'
            ? ` · with ${record.participants
                .filter((p) => p.role !== 'learner')
                .map((p) => p.name)
                .join(', ')}`
            : ''}
        </p>
      </Card>
      {record.summary ? (
        <Card title="Summary">
          <p className="mb-2">{record.summary.narrative}</p>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="opacity-70">Problems</dt>
            <dd>
              {record.summary.problemsSolved} of {record.summary.problemsPresented} solved
            </dd>
            <dt className="opacity-70">Minutes</dt>
            <dd>{record.summary.minutes}</dd>
            {record.summary.misconceptions.length > 0 ? (
              <>
                <dt className="opacity-70">Watch for</dt>
                <dd>{record.summary.misconceptions.join('; ')}</dd>
              </>
            ) : null}
            {record.summary.nextSteps.length > 0 ? (
              <>
                <dt className="opacity-70">Next time</dt>
                <dd>{record.summary.nextSteps.join('; ')}</dd>
              </>
            ) : null}
          </dl>
        </Card>
      ) : null}
      <Card title="Transcript">
        {!turns.ok || turns.val.length === 0 ? (
          <Empty>Nothing was said.</Empty>
        ) : (
          <ol className="space-y-2">
            {turns.val.map((turn) => (
              <li key={turn.id}>
                <span className="text-xs font-medium opacity-70">{nameOf(turn.speaker)}</span>
                <span className="block">{turn.text}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
      {calls.ok && calls.val.length > 0 ? (
        <Card title="What the tutor did">
          <ul className="space-y-1 text-sm">
            {calls.val.map((call) => (
              <li key={call.id}>
                <code>{call.name}</code> {JSON.stringify(call.args)}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </Shell>
  );
}
