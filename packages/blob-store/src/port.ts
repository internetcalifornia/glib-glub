/**
 * Where uploaded files live. Three implementations: memory (tests), disk
 * (development without Azure), Azure Blob (Azurite locally, a storage
 * account in production). Keys are opaque paths chosen by the caller
 * (`uploads/<learnerId>/<uploadId>`), never file names from users.
 */

import type { AsyncResult } from '@campfhir/safe-functions/types';

export type BlobErrorTag = 'BLOB_ERROR' | 'NOT_FOUND';

export interface StoredBlob {
  bytes: Uint8Array;
  contentType: string;
}

export interface BlobStore {
  put(key: string, bytes: Uint8Array, contentType: string): AsyncResult<void, 'BLOB_ERROR'>;
  get(key: string): AsyncResult<StoredBlob, BlobErrorTag>;
  delete(key: string): AsyncResult<void, 'BLOB_ERROR'>;
  exists(key: string): AsyncResult<boolean, 'BLOB_ERROR'>;
}

const KEY = /^[a-zA-Z0-9_\-./]+$/;

/** Keys are our own; a bad one is a programmer error surfaced as a value. */
export function isValidBlobKey(key: string): boolean {
  return KEY.test(key) && !key.includes('..') && !key.startsWith('/');
}
