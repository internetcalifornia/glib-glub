/**
 * The port's contract, run against the memory and disk implementations:
 * put/get round-trips bytes and content type, a missing key is NOT_FOUND,
 * delete is idempotent, and a hostile key is refused.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { diskBlobStore } from './disk';
import { memoryBlobStore } from './memory';
import type { BlobStore } from './port';

const dir = await mkdtemp(join(tmpdir(), 'glib-glub-blobs-'));
afterAll(() => rm(dir, { recursive: true, force: true }));

const implementations: Array<[string, BlobStore]> = [
  ['memory', memoryBlobStore()],
  ['disk', diskBlobStore(dir)],
];

describe.each(implementations)('%s blob store', (_name, store) => {
  it('round-trips bytes and content type', async () => {
    const bytes = new TextEncoder().encode('hello');

    const put = await store.put('uploads/u1/f1', bytes, 'text/plain');
    const got = await store.get('uploads/u1/f1');

    expect(put.ok).toBe(true);
    expect(got.ok && new TextDecoder().decode(got.val.bytes)).toBe('hello');
    expect(got.ok && got.val.contentType).toBe('text/plain');
    const exists = await store.exists('uploads/u1/f1');
    expect(exists.ok && exists.val).toBe(true);
  });

  it('reports a missing key as NOT_FOUND', async () => {
    const got = await store.get('uploads/nobody/nothing');

    expect(!got.ok && got.err.type).toBe('NOT_FOUND');
  });

  it('deletes idempotently', async () => {
    void (await store.put('uploads/u1/f2', new Uint8Array([1]), 'application/octet-stream'));

    expect((await store.delete('uploads/u1/f2')).ok).toBe(true);
    expect((await store.delete('uploads/u1/f2')).ok).toBe(true);
    const exists = await store.exists('uploads/u1/f2');
    expect(exists.ok && exists.val).toBe(false);
  });

  it('refuses a key that escapes the namespace', async () => {
    const put = await store.put('../etc/passwd', new Uint8Array([1]), 'text/plain');

    expect(!put.ok && put.err.type).toBe('BLOB_ERROR');
  });
});
