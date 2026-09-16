/**
 * Where a signed-in learner lands: each enrolled track with what is due
 * this period and the ways to start a session, then the most recent
 * sessions with their summaries — the memory the next session starts from.
 */

import { whatIsDue } from '@glib-glub/curriculum';
import { redirect } from 'next/navigation';
import Link from 'next/link';

import { Shell } from '@/components/shell';
import { Card, Empty, LinkButton } from '@/components/ui';
import { getDeps } from '@/lib/deps';
import { getSessionFromHeaders } from '@/lib/session';

export const metadata = { title: 'Home' };

export default async function HomePage() {
  const session = await getSessionFromHeaders();
  if (!session.ok) redirect('/sign-in');
  const deps = getDeps();
  if (!deps.ok)
    return (
      <Shell user={session.val} title="Home">
        Configuration error.
      </Shell>
    );
  const { curriculum, tutor, clock } = deps.val;
  const user = session.val;

  const enrollments = await curriculum.listEnrollments(user.userId);
  const active = enrollments.ok ? enrollments.val.filter((e) => e.status === 'active') : [];
  const tracks = await Promise.all(
    active.map(async (enrollment) => {
      const track = await curriculum.getTrack(enrollment.trackId);
      const due = await whatIsDue(
        { store: curriculum },
        { learnerId: user.userId, trackId: enrollment.trackId, now: clock.now() }
      );
      return { enrollment, track: track.ok ? track.val : null, due: due.ok ? due.val : null };
    })
  );
  const recent = await tutor.store.listSessions(user.userId, 5);

  return (
    <Shell user={user} title={`Hi ${user.name.split(' ')[0] ?? user.name}`}>
      {tracks.length === 0 ? (
        <Card title="Pick a track">
          <Empty>You are not enrolled in anything yet.</Empty>
          <div className="mt-3">
            <LinkButton href="/tracks">Browse tracks</LinkButton>
          </div>
        </Card>
      ) : null}
      {tracks.map(({ enrollment, track, due }) => (
        <Card key={enrollment.id} title={track?.title ?? 'Track'}>
          {due ? (
            <p className="mb-3 text-sm">
              {due.finished
                ? 'Every lesson done — well played.'
                : `Period ${due.period}: ${due.due.length} lesson${due.due.length === 1 ? '' : 's'} due` +
                  (due.behindBy > 0 ? `, ${due.behindBy} behind` : '')}
            </p>
          ) : null}
          {due?.due[0] ? <p className="mb-3 font-medium">Next up: {due.due[0].title}</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <LinkButton href={`/session?track=${enrollment.trackId}&transport=voice`}>
              Start talking
            </LinkButton>
            <LinkButton
              href={`/session?track=${enrollment.trackId}&transport=text`}
              variant="secondary"
            >
              Type instead
            </LinkButton>
            <LinkButton
              href={`/session?track=${enrollment.trackId}&transport=voice&mode=with_guardian`}
              variant="secondary"
            >
              With a parent
            </LinkButton>
          </div>
        </Card>
      ))}
      <Card title="Recent sessions">
        {!recent.ok || recent.val.length === 0 ? (
          <Empty>No sessions yet. The first one starts from your profile.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {recent.val.map((s) => (
              <li key={s.id} className="py-2">
                <Link href={`/session/${s.id}`} className="block">
                  <span className="font-medium">{s.lessonTitle}</span>
                  <span className="block text-xs opacity-70">
                    {s.startedAt.toLocaleString()} · {s.status} · {s.transport}
                    {s.mode !== 'solo' ? ` · ${s.mode.replace('_', ' ')}` : ''}
                  </span>
                  {s.summary?.narrative ? (
                    <span className="mt-1 block text-sm">{s.summary.narrative}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}
