/**
 * Azure Blob Storage. One container, keys as blob names. Azurite serves the
 * same API locally (docker-compose.yml), so development and production run
 * the same code path with a different connection string.
 */

import { err, ok, wrapAsync } from '@campfhir/safe-functions/helpers';
import { BlobServiceClient } from '@azure/storage-blob';

import { isValidBlobKey, type BlobStore } from './port';

export interface AzureBlobConfig {
  connectionString: string;
  container: string;
}

export function azureBlobStore(config: AzureBlobConfig): BlobStore {
  const container = BlobServiceClient.fromConnectionString(
    config.connectionString
  ).getContainerClient(config.container);
  let ensured: Promise<unknown> | null = null;
  const ensureContainer = () => (ensured ??= container.createIfNotExists());

  return {
    put: async (key, bytes, contentType): ReturnType<BlobStore['put']> => {
      if (!isValidBlobKey(key)) return err('BLOB_ERROR', { message: `Invalid blob key ${key}` });
      const uploaded = await wrapAsync(async () => {
        await ensureContainer();
        await container.getBlockBlobClient(key).uploadData(bytes, {
          blobHTTPHeaders: { blobContentType: contentType },
        });
      }, 'BLOB_ERROR');
      if (!uploaded.ok) return uploaded;
      return ok();
    },
    get: async (key): ReturnType<BlobStore['get']> => {
      const client = container.getBlockBlobClient(key);
      const exists = await wrapAsync(() => client.exists(), 'BLOB_ERROR');
      if (!exists.ok) return exists;
      if (!exists.val) return err('NOT_FOUND');
      const downloaded = await wrapAsync(async () => {
        const buffer = await client.downloadToBuffer();
        const properties = await client.getProperties();
        return {
          bytes: new Uint8Array(buffer),
          contentType: properties.contentType ?? 'application/octet-stream',
        };
      }, 'BLOB_ERROR');
      if (!downloaded.ok) return downloaded;
      return ok(downloaded.val);
    },
    delete: async (key): ReturnType<BlobStore['delete']> => {
      const deleted = await wrapAsync(
        () => container.getBlockBlobClient(key).deleteIfExists(),
        'BLOB_ERROR'
      );
      if (!deleted.ok) return deleted;
      return ok();
    },
    exists: async (key): ReturnType<BlobStore['exists']> =>
      wrapAsync(() => container.getBlockBlobClient(key).exists(), 'BLOB_ERROR'),
  };
}
