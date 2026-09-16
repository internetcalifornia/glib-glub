/**
 * One track: its units and lessons, and the enrol form (cadence and how
 * many sessions per day or week) — or the current plan if already enrolled.
 */

import { getOutline, isVisibleTo } from '@glib-glub/curriculum';
import { brandId, isUuid } from '@glib-glub/core';
import { notFound, redirect } from 'next/navigation';

import { ActionForm } from '@/components/action-form';
import { Shell } from '@/components/shell';
import { Card, Field, inputClass, LinkButton } from '@/components/ui';
import { getDeps } from '@/lib/deps';
import { getSessionFromHeaders } from '@/lib/session';

import { enrollAction } from '../actions';

export default async function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromHeaders();
  if (!session.ok) redirect('/sign-in');
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const deps = getDeps();
  if (!deps.ok)
    return (
      <Shell user={session.val} title="Track">
        Configuration error.
      </Shell>
    );
  const trackId = brandId<'track'>(id);
  const outline = await getOutline({ store: deps.val.curriculum }, trackId);
  if (!outline.ok || !isVisibleTo(outline.val.track, session.val.userId)) notFound();
  const enrollment = await deps.val.curriculum.getEnrollment(session.val.userId, trackId);
  const enrolled = enrollment.ok && enrollment.val?.status === 'active';

  return (
    <Shell user={session.val} title={outline.val.track.title}>
      <Card>
        <p className="text-sm">{outline.val.track.summary}</p>
        <p className="mt-2 text-xs opacity-70">
          How the tutor teaches this: {outline.val.track.pedagogy}
        </p>
      </Card>
      <Card title={enrolled ? 'You are enrolled' : 'Enrol'}>
        {enrolled ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <LinkButton href={`/session?track=${trackId}&transport=voice`}>
              Start talking
            </LinkButton>
            <LinkButton href="/home" variant="secondary">
              Back home
            </LinkButton>
          </div>
        ) : (
          <ActionForm action={enrollAction.bind(null, id)} submit="Enrol">
            <Field label="How often">
              <select name="cadence" className={inputClass} defaultValue="daily">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </Field>
            <Field label="Sessions per period" hint="One lesson per session.">
              <input
                name="sessionsPerPeriod"
                type="number"
                min={1}
                max={7}
                defaultValue={1}
                className={inputClass}
              />
            </Field>
          </ActionForm>
        )}
      </Card>
      {outline.val.units.map((unit) => (
        <Card key={unit.id} title={unit.title}>
          <ol className="list-decimal space-y-1 pl-5">
            {unit.lessons.map((lesson) => (
              <li key={lesson.id}>
                <span className="font-medium">{lesson.title}</span>
                <span className="block text-xs opacity-70">
                  {lesson.estimatedMinutes} min · {lesson.objectives.join('; ')}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      ))}
    </Shell>
  );
}
