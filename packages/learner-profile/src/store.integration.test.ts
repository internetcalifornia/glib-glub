/**
 * The Postgres ProfileStore round-trips what the memory store does: a
 * profile with arrays, objectives with status changes, uploads with their
 * extraction, and snapshots ordered by version.
 */

import { newId, type UserId } from '@glib-glub/core';
import type { DB } from '@glib-glub/db';
import { IDENTITY_TABLES, kyselyIdentityStore } from '@glib-glub/identity';
import { connectTestDb, describeLive } from '@glib-glub/testing';
import { afterAll, beforeEach, expect, it } from 'vitest';

import { kyselyProfileStore, PROFILE_TABLES } from './store';

describeLive('ProfileStore on Postgres', () => {
  const handle = connectTestDb<DB>();
  if (!handle.ok) return;
  const { db, truncate, close } = handle.val;
  const store = kyselyProfileStore(db);
  const identity = kyselyIdentityStore(db);
  let learnerId: UserId;

  beforeEach(async () => {
    void (await truncate([...PROFILE_TABLES, ...IDENTITY_TABLES]));
    const user = await identity.createUser({
      email: 'maya@example.com',
      name: 'Maya',
      emailVerified: true,
    });
    expect(user.ok).toBe(true);
    if (user.ok) learnerId = user.val.id;
  });

  afterAll(async () => {
    await close();
  });

  it('round-trips a profile with array columns', async () => {
    void (await store.upsertProfile({
      learnerId,
      about: 'I like geometry',
      interests: ['dinosaurs', 'space'],
      learningStyles: ['visual', 'hands-on'],
      preferredLanguage: 'en',
      gradeLabel: '6th grade',
    }));

    const profile = await store.getProfile(learnerId);

    expect(profile.ok && profile.val).toEqual({
      learnerId,
      about: 'I like geometry',
      interests: ['dinosaurs', 'space'],
      learningStyles: ['visual', 'hands-on'],
      preferredLanguage: 'en',
      gradeLabel: '6th grade',
    });
  });

  it('stores objectives and changes their status', async () => {
    const id = newId<'objective'>();
    void (await store.addObjective({
      id,
      learnerId,
      title: 'Add fractions',
      description: null,
      status: 'active',
      setBy: learnerId,
    }));

    const changed = await store.setObjectiveStatus(id, 'achieved');
    const list = await store.listObjectives(learnerId);

    expect(changed.ok).toBe(true);
    expect(list.ok && list.val.map((o) => o.status)).toEqual(['achieved']);
    expect(!(await store.setObjectiveStatus(newId<'objective'>(), 'achieved')).ok).toBe(true);
  });

  it('keeps an upload with its extraction and deletes both together', async () => {
    const id = newId<'upload'>();
    void (await store.addUpload({
      id,
      learnerId,
      fileName: 'a.txt',
      mimeType: 'text/plain',
      byteSize: 3,
      blobKey: `uploads/${learnerId}/${id}`,
      status: 'pending',
      rejectionReason: null,
    }));
    void (await store.saveExtraction({
      uploadId: id,
      text: 'abc',
      summary: 'letters',
      tags: ['alphabet'],
    }));
    void (await store.setUploadStatus(id, 'extracted', null));

    const upload = await store.getUpload(id);
    const extraction = await store.getExtraction(id);
    expect(upload.ok && upload.val?.status).toBe('extracted');
    expect(extraction.ok && extraction.val?.tags).toEqual(['alphabet']);

    void (await store.deleteUpload(id));
    const gone = await store.getExtraction(id);
    expect(gone.ok && gone.val).toBeNull();
  });

  it('returns the newest snapshot', async () => {
    const content = {
      about: 'x',
      interests: [],
      learningStyles: [],
      preferredLanguage: 'en',
      gradeLabel: null,
      objectives: [],
      uploads: [],
      levelEstimates: [],
    };
    void (await store.saveSnapshot({ learnerId, version: 1, digest: 'a', content }));
    void (await store.saveSnapshot({
      learnerId,
      version: 2,
      digest: 'b',
      content: { ...content, about: 'y' },
    }));

    const latest = await store.latestSnapshot(learnerId);

    expect(latest.ok && latest.val?.version).toBe(2);
    expect(latest.ok && latest.val?.content.about).toBe('y');
  });
});
