/**
 * The upload pipeline: keep the file, extract its text, screen it,
 * summarise it. Each step's failure is a value and each leaves the upload
 * row in a state the UI can show — `failed` with nothing kept, `rejected`
 * with a reason and nothing kept, or `extracted` with the summary the
 * snapshot will use.
 *
 * The raw file never goes to an LLM; only extracted text does, and only
 * after the safety screen passed. A rejected upload's file is deleted.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import { newId, type UploadId, type UserId } from '@glib-glub/core';

import { assertMayUpload, type Actor } from './access';
import type { UploadDeps } from './ports';
import type { Upload } from './types';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function blobKeyFor(learnerId: UserId, uploadId: UploadId): string {
  return `uploads/${learnerId}/${uploadId}`;
}

export interface UploadInput {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}

export async function uploadWork(
  deps: UploadDeps,
  actor: Actor,
  input: UploadInput
): AsyncResult<
  Upload,
  'FORBIDDEN' | 'VALIDATION_ERROR' | 'UNSUPPORTED_TYPE' | 'BLOB_ERROR' | 'DB_ERROR'
> {
  const allowed = await assertMayUpload(deps.guardians, actor);
  if (!allowed.ok) return allowed;
  if (input.bytes.byteLength === 0)
    return err('VALIDATION_ERROR', { message: 'The file is empty' });
  if (input.bytes.byteLength > MAX_UPLOAD_BYTES) {
    return err('VALIDATION_ERROR', { message: 'The file is larger than 25 MB' });
  }
  if (!deps.extractor.supports(input.mimeType)) {
    return err('UNSUPPORTED_TYPE', { message: `Cannot read ${input.mimeType} files yet` });
  }

  const id = newId<'upload'>();
  const blobKey = blobKeyFor(actor.learnerId, id);
  const stored = await deps.blobs.put(blobKey, input.bytes, input.mimeType);
  if (!stored.ok) return stored;

  const upload: Upload = {
    id,
    learnerId: actor.learnerId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    byteSize: input.bytes.byteLength,
    blobKey,
    status: 'pending',
    rejectionReason: null,
  };
  const added = await deps.store.addUpload(upload);
  if (!added.ok) return added;

  return processUpload(deps, upload, input.bytes);
}

/**
 * Extract → screen → summarise. Runs inline today; the same function can be
 * handed to a worker later, which is why it takes the bytes rather than
 * re-reading the blob.
 */
async function processUpload(
  deps: UploadDeps,
  upload: Upload,
  bytes: Uint8Array
): AsyncResult<Upload, 'DB_ERROR'> {
  const text = await deps.extractor.extract(bytes, upload.mimeType);
  if (!text.ok) return finish(deps, upload, 'failed', `Could not read the file (${text.err.type})`);

  const verdict = await deps.safety.screenText(text.val);
  if (!verdict.ok)
    return finish(deps, upload, 'failed', 'Safety screening was unavailable; try again later');
  if (!verdict.val.allowed) {
    const categories = verdict.val.categories.map((entry) => entry.category).join(', ');
    // Nothing of a rejected upload survives but the reason.
    void (await deps.blobs.delete(upload.blobKey));
    return finish(deps, upload, 'rejected', `Content was flagged (${categories})`);
  }

  const summary = await deps.summariser.summarise({ fileName: upload.fileName, text: text.val });
  if (!summary.ok)
    return finish(deps, upload, 'failed', 'Could not summarise the file; try again later');

  const saved = await deps.store.saveExtraction({
    uploadId: upload.id,
    text: text.val,
    summary: summary.val.summary,
    tags: summary.val.tags,
  });
  if (!saved.ok) return saved;
  return finish(deps, upload, 'extracted', null);
}

async function finish(
  deps: UploadDeps,
  upload: Upload,
  status: Upload['status'],
  reason: string | null
): AsyncResult<Upload, 'DB_ERROR'> {
  const updated = await deps.store.setUploadStatus(upload.id, status, reason);
  if (!updated.ok) return updated;
  return ok({ ...upload, status, rejectionReason: reason });
}

export async function deleteUpload(
  deps: UploadDeps,
  actor: Actor,
  uploadId: UploadId
): AsyncResult<void, 'FORBIDDEN' | 'NOT_FOUND' | 'BLOB_ERROR' | 'DB_ERROR'> {
  const allowed = await assertMayUpload(deps.guardians, actor);
  if (!allowed.ok) return allowed;
  const upload = await deps.store.getUpload(uploadId);
  if (!upload.ok) return upload;
  if (!upload.val || upload.val.learnerId !== actor.learnerId) {
    return err('NOT_FOUND', { message: 'No such upload for this learner' });
  }
  const removedBlob = await deps.blobs.delete(upload.val.blobKey);
  if (!removedBlob.ok) return removedBlob;
  return deps.store.deleteUpload(uploadId);
}
