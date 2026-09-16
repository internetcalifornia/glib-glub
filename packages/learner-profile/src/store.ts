/**
 * The Postgres ProfileStore. Arrays are Postgres text[] columns; the
 * snapshot content is jsonb, written whole and read whole — it is a
 * document the tutor consumes, not a table anyone queries by field.
 */

import { err, ok, wrapAsync } from '@campfhir/safe-functions/helpers';
import { brandId } from '@glib-glub/core';
import type { DB } from '@glib-glub/db';
import type { Kysely } from 'kysely';

import { parseLearningStyles } from './bio';
import type { ProfileStore } from './ports';
import type {
  Objective,
  ObjectiveStatus,
  Snapshot,
  SnapshotContent,
  Upload,
  UploadStatus,
} from './types';

function toObjectiveStatus(value: string): ObjectiveStatus {
  return value === 'achieved' ? 'achieved' : value === 'archived' ? 'archived' : 'active';
}

function toUploadStatus(value: string): UploadStatus {
  return value === 'extracted'
    ? 'extracted'
    : value === 'rejected'
      ? 'rejected'
      : value === 'failed'
        ? 'failed'
        : 'pending';
}

function isSnapshotContent(value: unknown): value is SnapshotContent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'about' in value &&
    'objectives' in value &&
    'uploads' in value &&
    Array.isArray(value.objectives) &&
    Array.isArray(value.uploads)
  );
}

export function kyselyProfileStore(db: Kysely<DB>): ProfileStore {
  return {
    getProfile: async (learnerId): ReturnType<ProfileStore['getProfile']> => {
      const row = await wrapAsync(
        () =>
          db
            .selectFrom('learner_profiles')
            .selectAll()
            .where('user_id', '=', learnerId)
            .executeTakeFirst(),
        'DB_ERROR'
      );
      if (!row.ok) return row;
      if (!row.val) return ok(null);
      return ok({
        learnerId,
        about: row.val.about,
        interests: row.val.interests,
        learningStyles: parseLearningStyles(row.val.learning_styles),
        preferredLanguage: row.val.preferred_language,
        gradeLabel: row.val.grade_label,
      });
    },

    upsertProfile: async (profile): ReturnType<ProfileStore['upsertProfile']> => {
      const values = {
        user_id: profile.learnerId,
        about: profile.about,
        interests: [...profile.interests],
        learning_styles: [...profile.learningStyles],
        preferred_language: profile.preferredLanguage,
        grade_label: profile.gradeLabel,
        updated_at: new Date(),
      };
      const upserted = await wrapAsync(
        () =>
          db
            .insertInto('learner_profiles')
            .values(values)
            .onConflict((oc) => oc.column('user_id').doUpdateSet(values))
            .execute(),
        'DB_ERROR'
      );
      if (!upserted.ok) return upserted;
      return ok();
    },

    listObjectives: async (learnerId): ReturnType<ProfileStore['listObjectives']> => {
      const rows = await wrapAsync(
        () =>
          db
            .selectFrom('learning_objectives')
            .selectAll()
            .where('learner_id', '=', learnerId)
            .orderBy('created_at')
            .execute(),
        'DB_ERROR'
      );
      if (!rows.ok) return rows;
      return ok(
        rows.val.map<Objective>((row) => ({
          id: brandId<'objective'>(row.id),
          learnerId,
          title: row.title,
          description: row.description,
          status: toObjectiveStatus(row.status),
          setBy: brandId<'user'>(row.set_by),
        }))
      );
    },

    addObjective: async (objective): ReturnType<ProfileStore['addObjective']> => {
      const inserted = await wrapAsync(
        () =>
          db
            .insertInto('learning_objectives')
            .values({
              id: objective.id,
              learner_id: objective.learnerId,
              title: objective.title,
              description: objective.description,
              status: objective.status,
              set_by: objective.setBy,
            })
            .execute(),
        'DB_ERROR'
      );
      if (!inserted.ok) return inserted;
      return ok();
    },

    setObjectiveStatus: async (id, status): ReturnType<ProfileStore['setObjectiveStatus']> => {
      const updated = await wrapAsync(
        () =>
          db
            .updateTable('learning_objectives')
            .set({ status, updated_at: new Date() })
            .where('id', '=', id)
            .executeTakeFirst(),
        'DB_ERROR'
      );
      if (!updated.ok) return updated;
      if (updated.val.numUpdatedRows === 0n) return err('NOT_FOUND');
      return ok();
    },

    listUploads: async (learnerId): ReturnType<ProfileStore['listUploads']> => {
      const rows = await wrapAsync(
        () =>
          db
            .selectFrom('uploads')
            .selectAll()
            .where('learner_id', '=', learnerId)
            .orderBy('created_at')
            .execute(),
        'DB_ERROR'
      );
      if (!rows.ok) return rows;
      return ok(rows.val.map(toUpload));
    },

    getUpload: async (id): ReturnType<ProfileStore['getUpload']> => {
      const row = await wrapAsync(
        () => db.selectFrom('uploads').selectAll().where('id', '=', id).executeTakeFirst(),
        'DB_ERROR'
      );
      if (!row.ok) return row;
      return ok(row.val ? toUpload(row.val) : null);
    },

    addUpload: async (upload): ReturnType<ProfileStore['addUpload']> => {
      const inserted = await wrapAsync(
        () =>
          db
            .insertInto('uploads')
            .values({
              id: upload.id,
              learner_id: upload.learnerId,
              file_name: upload.fileName,
              mime_type: upload.mimeType,
              byte_size: upload.byteSize,
              blob_key: upload.blobKey,
              status: upload.status,
              rejection_reason: upload.rejectionReason,
            })
            .execute(),
        'DB_ERROR'
      );
      if (!inserted.ok) return inserted;
      return ok();
    },

    setUploadStatus: async (
      id,
      status,
      rejectionReason
    ): ReturnType<ProfileStore['setUploadStatus']> => {
      const updated = await wrapAsync(
        () =>
          db
            .updateTable('uploads')
            .set({ status, rejection_reason: rejectionReason })
            .where('id', '=', id)
            .execute(),
        'DB_ERROR'
      );
      if (!updated.ok) return updated;
      return ok();
    },

    saveExtraction: async (extraction): ReturnType<ProfileStore['saveExtraction']> => {
      const values = {
        upload_id: extraction.uploadId,
        text: extraction.text,
        summary: extraction.summary,
        tags: [...extraction.tags],
      };
      const saved = await wrapAsync(
        () =>
          db
            .insertInto('upload_extractions')
            .values(values)
            .onConflict((oc) => oc.column('upload_id').doUpdateSet(values))
            .execute(),
        'DB_ERROR'
      );
      if (!saved.ok) return saved;
      return ok();
    },

    getExtraction: async (uploadId): ReturnType<ProfileStore['getExtraction']> => {
      const row = await wrapAsync(
        () =>
          db
            .selectFrom('upload_extractions')
            .selectAll()
            .where('upload_id', '=', uploadId)
            .executeTakeFirst(),
        'DB_ERROR'
      );
      if (!row.ok) return row;
      if (!row.val) return ok(null);
      return ok({ uploadId, text: row.val.text, summary: row.val.summary, tags: row.val.tags });
    },

    deleteUpload: async (id): ReturnType<ProfileStore['deleteUpload']> => {
      const deleted = await wrapAsync(
        () => db.deleteFrom('uploads').where('id', '=', id).execute(),
        'DB_ERROR'
      );
      if (!deleted.ok) return deleted;
      return ok();
    },

    latestSnapshot: async (learnerId): ReturnType<ProfileStore['latestSnapshot']> => {
      const row = await wrapAsync(
        () =>
          db
            .selectFrom('personalisation_snapshots')
            .selectAll()
            .where('learner_id', '=', learnerId)
            .orderBy('version', 'desc')
            .executeTakeFirst(),
        'DB_ERROR'
      );
      if (!row.ok) return row;
      if (!row.val) return ok(null);
      if (!isSnapshotContent(row.val.content)) {
        return err('DB_ERROR', {
          message: `Snapshot ${learnerId} v${row.val.version} has an unreadable content document`,
        });
      }
      const snapshot: Snapshot = {
        learnerId,
        version: row.val.version,
        digest: row.val.digest,
        content: row.val.content,
      };
      return ok(snapshot);
    },

    saveSnapshot: async (snapshot): ReturnType<ProfileStore['saveSnapshot']> => {
      const inserted = await wrapAsync(
        () =>
          db
            .insertInto('personalisation_snapshots')
            .values({
              learner_id: snapshot.learnerId,
              version: snapshot.version,
              digest: snapshot.digest,
              content: JSON.stringify(snapshot.content),
            })
            .execute(),
        'DB_ERROR'
      );
      if (!inserted.ok) return inserted;
      return ok();
    },
  };
}

function toUpload(row: {
  id: string;
  learner_id: string;
  file_name: string;
  mime_type: string;
  byte_size: number;
  blob_key: string;
  status: string;
  rejection_reason: string | null;
}): Upload {
  return {
    id: brandId<'upload'>(row.id),
    learnerId: brandId<'user'>(row.learner_id),
    fileName: row.file_name,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    blobKey: row.blob_key,
    status: toUploadStatus(row.status),
    rejectionReason: row.rejection_reason,
  };
}

/** Everything this package writes, for the integration tier's truncate. */
export const PROFILE_TABLES: ReadonlyArray<string> = [
  'personalisation_snapshots',
  'upload_extractions',
  'uploads',
  'learning_objectives',
  'learner_profiles',
];
