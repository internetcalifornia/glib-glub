/**
 * The catalogue: categories, their subjects, and the tracks visible to
 * this person (published ones, plus their own drafts).
 */

import { browseSubject, listCatalogue } from '@glib-glub/curriculum';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Shell } from '@/components/shell';
import { Card, Empty } from '@/components/ui';
import { getDeps } from '@/lib/deps';
import { getSessionFromHeaders } from '@/lib/session';

export const metadata = { title: 'Tracks' };

export default async function TracksPage() {
  const session = await getSessionFromHeaders();
  if (!session.ok) redirect('/sign-in');
  const deps = getDeps();
  if (!deps.ok)
    return (
      <Shell user={session.val} title="Tracks">
        Configuration error.
      </Shell>
    );
  const catalogue = await listCatalogue(deps.val.curriculum);
  const entries = catalogue.ok ? catalogue.val : [];
  const bySubject = new Map<string, Awaited<ReturnType<typeof browseSubject>>>();
  for (const entry of entries) {
    for (const subject of entry.subjects) {
      bySubject.set(
        subject.id,
        await browseSubject(deps.val.curriculum, {
          viewerId: session.val.userId,
          subjectId: subject.id,
        })
      );
    }
  }

  return (
    <Shell user={session.val} title="Tracks">
      {entries.length === 0 ? <Empty>The catalogue is empty.</Empty> : null}
      {entries.map((entry) => (
        <Card key={entry.category.id} title={entry.category.name}>
          {entry.subjects.map((subject) => {
            const tracks = bySubject.get(subject.id);
            const list = tracks?.ok ? tracks.val : [];
            return (
              <div key={subject.id} className="mb-3">
                <h3 className="font-medium">{subject.name}</h3>
                {list.length === 0 ? (
                  <Empty>No tracks yet.</Empty>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {list.map((track) => (
                      <li key={track.id}>
                        <Link
                          href={`/tracks/${track.id}`}
                          className="block rounded-xl border border-line p-3 hover:bg-accent-soft"
                        >
                          <span className="font-medium">{track.title}</span>
                          <span className="block text-xs opacity-70">
                            {track.levelMin === track.levelMax
                              ? track.levelMin
                              : `${track.levelMin} – ${track.levelMax}`}
                            {' · '}
                            {track.language}
                            {track.visibility !== 'published' ? ` · ${track.visibility}` : ''}
                          </span>
                          <span className="mt-1 block text-sm">{track.summary}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </Card>
      ))}
    </Shell>
  );
}
