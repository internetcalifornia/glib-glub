/**
 * The seams. `ProfileStore` is the tables; `Guardians` is the slice of
 * identity this package needs (who may act for whom, and the learner's age
 * band); `TextExtractor`, `Summariser` and `ContentSafety` are the
 * processing steps an upload goes through, each replaceable in tests.
 */

import type { AsyncResult } from '@campfhir/safe-functions/types';
import type { ContentSafety } from '@glib-glub/ai';
import type { BlobStore } from '@glib-glub/blob-store';
import type { UploadId, UserId } from '@glib-glub/core';
import type { AgeBand } from '@glib-glub/identity';

import type {
  LearnerProfile,
  Objective,
  ObjectiveId,
  ObjectiveStatus,
  Snapshot,
  Upload,
  UploadExtraction,
  UploadStatus,
} from './types';

export interface Guardians {
  isGuardianOf(actorId: UserId, learnerId: UserId): AsyncResult<boolean, 'DB_ERROR'>;
  ageBandOf(learnerId: UserId): AsyncResult<AgeBand | null, 'DB_ERROR'>;
}

export interface ProfileStore {
  getProfile(learnerId: UserId): AsyncResult<LearnerProfile | null, 'DB_ERROR'>;
  upsertProfile(profile: LearnerProfile): AsyncResult<void, 'DB_ERROR'>;

  listObjectives(learnerId: UserId): AsyncResult<Objective[], 'DB_ERROR'>;
  addObjective(objective: Objective): AsyncResult<void, 'DB_ERROR'>;
  setObjectiveStatus(
    id: ObjectiveId,
    status: ObjectiveStatus
  ): AsyncResult<void, 'DB_ERROR' | 'NOT_FOUND'>;

  listUploads(learnerId: UserId): AsyncResult<Upload[], 'DB_ERROR'>;
  getUpload(id: UploadId): AsyncResult<Upload | null, 'DB_ERROR'>;
  addUpload(upload: Upload): AsyncResult<void, 'DB_ERROR'>;
  setUploadStatus(
    id: UploadId,
    status: UploadStatus,
    rejectionReason: string | null
  ): AsyncResult<void, 'DB_ERROR'>;
  saveExtraction(extraction: UploadExtraction): AsyncResult<void, 'DB_ERROR'>;
  getExtraction(uploadId: UploadId): AsyncResult<UploadExtraction | null, 'DB_ERROR'>;
  deleteUpload(id: UploadId): AsyncResult<void, 'DB_ERROR'>;

  latestSnapshot(learnerId: UserId): AsyncResult<Snapshot | null, 'DB_ERROR'>;
  saveSnapshot(snapshot: Snapshot): AsyncResult<void, 'DB_ERROR'>;
}

export interface TextExtractor {
  /** Which MIME types this extractor handles. */
  supports(mimeType: string): boolean;
  extract(
    bytes: Uint8Array,
    mimeType: string
  ): AsyncResult<string, 'UNSUPPORTED_TYPE' | 'EXTRACTION_FAILED'>;
}

export interface Summary {
  summary: string;
  tags: string[];
}

export interface Summariser {
  summarise(input: { fileName: string; text: string }): AsyncResult<Summary, 'SUMMARY_FAILED'>;
}

export interface UploadDeps {
  store: ProfileStore;
  guardians: Guardians;
  blobs: BlobStore;
  extractor: TextExtractor;
  safety: ContentSafety;
  summariser: Summariser;
}
