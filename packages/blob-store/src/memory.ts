/**
 * The in-memory blob store: a Map. Exposes `keys()` so a scenario can say
 * "the blob store is empty".
 */

import { err, ok } from '@campfhir/safe-functions/helpers';

import { isValidBlobKey, type BlobStore, type StoredBlob } from './port';

export interface MemoryBlobStore extends BlobStore {
  keys(): string[];
}

export function memoryBlobStore(): MemoryBlobStore {
  const blobs = new Map<string, StoredBlob>();
  return {
    keys: () => [...blobs.keys()],
    put: async (key, bytes, contentType): ReturnType<BlobStore['put']> => {
      if (!isValidBlobKey(key)) return err('BLOB_ERROR', { message: `Invalid blob key ${key}` });
      blobs.set(key, { bytes: new Uint8Array(bytes), contentType });
      return ok();
    },
    get: async (key): ReturnType<BlobStore['get']> => {
      const blob = blobs.get(key);
      return blob ? ok(blob) : err('NOT_FOUND');
    },
    delete: async (key): ReturnType<BlobStore['delete']> => {
      blobs.delete(key);
      return ok();
    },
    exists: async (key): ReturnType<BlobStore['exists']> => ok(blobs.has(key)),
  };
}
