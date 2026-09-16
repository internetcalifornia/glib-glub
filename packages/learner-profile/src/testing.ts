/**
 * The in-memory ProfileStore, the Guardians adapter over identity (used in
 * production and in tests alike — it is four lines), and the scenario world
 * the step definitions share: an identity world for people and
 * guardianships, a memory blob store, the keyword summariser, and the
 * keyword safety screen.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import { keywordSafety } from '@glib-glub/ai';
import { memoryBlobStore, type MemoryBlobStore } from '@glib-glub/blob-store';
import type { UploadId, UserId } from '@glib-glub/core';
import {
  identityWorld,
  isGuardianOf,
  type IdentityStore,
  type IdentityWorld,
} from '@glib-glub/identity';

import { textExtractor } from './extractors';
import type { Guardians, ProfileStore, UploadDeps } from './ports';
import { keywordSummariser } from './summariser';
import type { LearnerProfile, Objective, Snapshot, Upload, UploadExtraction } from './types';

export function guardiansFromIdentity(store: IdentityStore): Guardians {
  return {
    isGuardianOf: (actorId, learnerId) => isGuardianOf({ store }, actorId, learnerId),
    ageBandOf: (learnerId) => store.getAgeBand(learnerId),
  };
}

export function memoryProfileStore(): ProfileStore {
  const profiles = new Map<UserId, LearnerProfile>();
  const objectives: Objective[] = [];
  const uploads: Upload[] = [];
  const extractions = new Map<UploadId, UploadExtraction>();
  const snapshots: Snapshot[] = [];

  return {
    getProfile: async (learnerId): ReturnType<ProfileStore['getProfile']> =>
      ok(profiles.get(learnerId) ?? null),
    upsertProfile: async (profile): ReturnType<ProfileStore['upsertProfile']> => {
      profiles.set(profile.learnerId, profile);
      return ok();
    },
    listObjectives: async (learnerId): ReturnType<ProfileStore['listObjectives']> =>
      ok(objectives.filter((objective) => objective.learnerId === learnerId)),
    addObjective: async (objective): ReturnType<ProfileStore['addObjective']> => {
      objectives.push(objective);
      return ok();
    },
    setObjectiveStatus: async (id, status): ReturnType<ProfileStore['setObjectiveStatus']> => {
      const index = objectives.findIndex((objective) => objective.id === id);
      if (index < 0) return err('NOT_FOUND');
      const current = objectives[index];
      if (current) objectives[index] = { ...current, status };
      return ok();
    },
    listUploads: async (learnerId): ReturnType<ProfileStore['listUploads']> =>
      ok(uploads.filter((upload) => upload.learnerId === learnerId)),
    getUpload: async (id): ReturnType<ProfileStore['getUpload']> =>
      ok(uploads.find((upload) => upload.id === id) ?? null),
    addUpload: async (upload): ReturnType<ProfileStore['addUpload']> => {
      uploads.push(upload);
      return ok();
    },
    setUploadStatus: async (
      id,
      status,
      rejectionReason
    ): ReturnType<ProfileStore['setUploadStatus']> => {
      const index = uploads.findIndex((upload) => upload.id === id);
      const current = uploads[index];
      if (current) uploads[index] = { ...current, status, rejectionReason };
      return ok();
    },
    saveExtraction: async (extraction): ReturnType<ProfileStore['saveExtraction']> => {
      extractions.set(extraction.uploadId, extraction);
      return ok();
    },
    getExtraction: async (uploadId): ReturnType<ProfileStore['getExtraction']> =>
      ok(extractions.get(uploadId) ?? null),
    deleteUpload: async (id): ReturnType<ProfileStore['deleteUpload']> => {
      const index = uploads.findIndex((upload) => upload.id === id);
      if (index >= 0) uploads.splice(index, 1);
      extractions.delete(id);
      return ok();
    },
    latestSnapshot: async (learnerId): ReturnType<ProfileStore['latestSnapshot']> =>
      ok(
        snapshots
          .filter((snapshot) => snapshot.learnerId === learnerId)
          .sort((a, b) => b.version - a.version)[0] ?? null
      ),
    saveSnapshot: async (snapshot): ReturnType<ProfileStore['saveSnapshot']> => {
      snapshots.push(snapshot);
      return ok();
    },
  };
}

export interface ProfileWorld extends UploadDeps {
  identity: IdentityWorld;
  blobs: MemoryBlobStore;
  last:
    | Awaited<ReturnType<UploadDeps['store']['getProfile']>>
    | { ok: boolean; err?: { type: string } }
    | undefined;
  /** Create a learner with an age band, signed up through identity. */
  learner(email: string, band: string): Promise<UserId>;
  userIdOf(email: string): Promise<UserId>;
}

export function profileWorld(): ProfileWorld {
  const identity = identityWorld();
  const blobs = memoryBlobStore();
  const world: ProfileWorld = {
    identity,
    store: memoryProfileStore(),
    guardians: guardiansFromIdentity(identity.store),
    blobs,
    extractor: textExtractor,
    safety: keywordSafety(),
    summariser: keywordSummariser,
    last: undefined,
    async learner(email, band) {
      await identity.signUp(email, 'correct horse battery');
      const id = await identity.userIdOf(email);
      if (
        band === 'k-5' ||
        band === '6-8' ||
        band === '9-12' ||
        band === 'university' ||
        band === 'adult'
      ) {
        void (await identity.store.setAgeBand(id, band));
      }
      return id;
    },
    userIdOf: (email) => identity.userIdOf(email),
  };
  return world;
}
