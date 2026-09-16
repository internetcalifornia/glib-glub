/**
 * The Postgres CurriculumStore against the seeded catalogue: the seeds are
 * there in teaching order, and an enrollment with its plan and progress
 * round-trips.
 */

import type { DB } from '@glib-glub/db';
import { IDENTITY_TABLES, kyselyIdentityStore } from '@glib-glub/identity';
import { connectTestDb, describeLive } from '@glib-glub/testing';
import { afterAll, beforeEach, expect, it } from 'vitest';

import { getOutline, lessonsInOrder } from './authoring';
import { enroll, whatIsDue, completeLesson } from './enrollment';
import { CURRICULUM_TABLES, kyselyCurriculumStore } from './store';

describeLive('CurriculumStore on Postgres', () => {
  const handle = connectTestDb<DB>();
  if (!handle.ok) return;
  const { db, clear, close } = handle.val;
  const store = kyselyCurriculumStore(db);
  const identity = kyselyIdentityStore(db);

  beforeEach(async () => {
    void (await clear([...CURRICULUM_TABLES, ...IDENTITY_TABLES]));
  });
  afterAll(async () => {
    await close();
  });

  it('has the seeded Grade 6 Mathematics track with six units of three lessons', async () => {
    const subjects = await store.listSubjects();
    const math = subjects.ok
      ? subjects.val.find((s) => s.name === 'Grade 6 Mathematics')
      : undefined;
    expect(math).toBeDefined();
    if (!math) return;

    const tracks = await store.listTracksInSubject(math.id);
    const track = tracks.ok ? tracks.val[0] : undefined;
    expect(track?.origin).toBe('seed');
    expect(track?.visibility).toBe('published');
    if (!track) return;

    const outline = await getOutline({ store }, track.id);
    expect(outline.ok && outline.val.units.length).toBe(6);
    expect(outline.ok && outline.val.units.every((u) => u.lessons.length === 3)).toBe(true);
    expect(outline.ok && lessonsInOrder(outline.val)[0]?.title).toBe('What a ratio says');
  });

  it('enrolls a learner, records progress, and reports what is due', async () => {
    const user = await identity.createUser({
      email: 'maya@example.com',
      name: 'Maya',
      emailVerified: true,
    });
    expect(user.ok).toBe(true);
    if (!user.ok) return;
    const subjects = await store.listSubjects();
    const japanese = subjects.ok ? subjects.val.find((s) => s.name === 'Japanese') : undefined;
    const tracks = japanese ? await store.listTracksInSubject(japanese.id) : undefined;
    const track = tracks?.ok ? tracks.val[0] : undefined;
    expect(track).toBeDefined();
    if (!track) return;

    const start = new Date('2026-09-14T09:00:00Z');
    const enrolled = await enroll(
      { store },
      {
        learnerId: user.val.id,
        trackId: track.id,
        cadence: 'daily',
        sessionsPerPeriod: 1,
        now: start,
      }
    );
    expect(enrolled.ok).toBe(true);

    const outline = await getOutline({ store }, track.id);
    const first = outline.ok ? lessonsInOrder(outline.val)[0] : undefined;
    if (first)
      void (await completeLesson(
        { store },
        { learnerId: user.val.id, trackId: track.id, lessonId: first.id, now: start }
      ));

    const due = await whatIsDue(
      { store },
      { learnerId: user.val.id, trackId: track.id, now: new Date('2026-09-15T09:00:00Z') }
    );
    expect(due.ok && due.val.behindBy).toBe(0);
    expect(due.ok && due.val.due[0]?.title).toBe('The s, t and n rows');
  });
});
