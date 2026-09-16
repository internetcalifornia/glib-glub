/**
 * Files under a root directory (`.blobs/` in development). Content type is
 * kept in a sidecar `<key>.meta.json` because a filesystem has nowhere else
 * to put it. Not for production — no Azure account is the only reason to
 * use it.
 */

import { err, ok, wrapAsync } from '@campfhir/safe-functions/helpers';
import { promises as fs } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { isValidBlobKey, type BlobStore } from './port';

function contentTypeOf(meta: unknown): string {
  if (
    typeof meta === 'object' &&
    meta !== null &&
    'contentType' in meta &&
    typeof meta.contentType === 'string'
  ) {
    return meta.contentType;
  }
  return 'application/octet-stream';
}

export function diskBlobStore(root: string): BlobStore {
  const pathFor = (key: string) => resolve(root, key);
  const metaFor = (key: string) => `${pathFor(key)}.meta.json`;

  return {
    put: async (key, bytes, contentType): ReturnType<BlobStore['put']> => {
      if (!isValidBlobKey(key)) return err('BLOB_ERROR', { message: `Invalid blob key ${key}` });
      const written = await wrapAsync(async () => {
        await fs.mkdir(dirname(pathFor(key)), { recursive: true });
        await fs.writeFile(pathFor(key), bytes);
        await fs.writeFile(metaFor(key), JSON.stringify({ contentType }));
      }, 'BLOB_ERROR');
      if (!written.ok) return written;
      return ok();
    },
    get: async (key): ReturnType<BlobStore['get']> => {
      const read = await wrapAsync(async () => {
        const bytes = await fs.readFile(pathFor(key));
        const meta: unknown = JSON.parse(await fs.readFile(metaFor(key), 'utf8'));
        return {
          bytes: new Uint8Array(bytes),
          contentType: contentTypeOf(meta),
        };
      }, 'BLOB_ERROR');
      if (!read.ok) {
        const code =
          typeof read.err.cause === 'object' && read.err.cause && 'code' in read.err.cause
            ? read.err.cause.code
            : undefined;
        return code === 'ENOENT' ? err('NOT_FOUND') : read;
      }
      return ok(read.val);
    },
    delete: async (key): ReturnType<BlobStore['delete']> => {
      const removed = await wrapAsync(async () => {
        await fs.rm(pathFor(key), { force: true });
        await fs.rm(metaFor(key), { force: true });
      }, 'BLOB_ERROR');
      if (!removed.ok) return removed;
      return ok();
    },
    exists: async (key): ReturnType<BlobStore['exists']> => {
      const stat = await wrapAsync(() => fs.stat(pathFor(key)), 'BLOB_ERROR');
      return ok(stat.ok);
    },
  };
}
