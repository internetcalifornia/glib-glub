/**
 * The personalisation snapshot: everything the tutor should know, distilled
 * from the profile, active objectives, upload summaries and level estimates.
 *
 * `buildSnapshotContent` is pure. `rebuildSnapshot` compares the new
 * content's digest with the latest stored one: same digest, same version
 * (nothing new); different digest, version + 1. The tutor can therefore
 * say "since we last spoke you added an objective" from the version alone.
 */

import { ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import type { UserId } from '@glib-glub/core';
import { createHash } from 'node:crypto';

import type { ProfileStore } from './ports';
import type {
  LearnerProfile,
  LevelEstimate,
  Objective,
  Snapshot,
  SnapshotContent,
  Upload,
  UploadExtraction,
} from './types';

export interface SnapshotInputs {
  profile: LearnerProfile | null;
  objectives: ReadonlyArray<Objective>;
  uploads: ReadonlyArray<{ upload: Upload; extraction: UploadExtraction }>;
  levelEstimates: ReadonlyArray<LevelEstimate>;
}

export function buildSnapshotContent(inputs: SnapshotInputs): SnapshotContent {
  return {
    about: inputs.profile?.about ?? '',
    interests: inputs.profile?.interests ?? [],
    learningStyles: inputs.profile?.learningStyles ?? [],
    preferredLanguage: inputs.profile?.preferredLanguage ?? 'en',
    gradeLabel: inputs.profile?.gradeLabel ?? null,
    objectives: inputs.objectives
      .filter((objective) => objective.status === 'active')
      .map((objective) => ({ title: objective.title })),
    uploads: inputs.uploads
      .filter(({ upload }) => upload.status === 'extracted')
      .map(({ upload, extraction }) => ({
        fileName: upload.fileName,
        summary: extraction.summary,
        tags: extraction.tags,
      })),
    levelEstimates: inputs.levelEstimates,
  };
}

export function digestOf(content: SnapshotContent): string {
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

export interface SnapshotDeps {
  store: ProfileStore;
  /** Supplied by the caller (the assessment module owns level estimates). */
  levelEstimates?: (learnerId: UserId) => AsyncResult<LevelEstimate[], 'DB_ERROR'>;
}

export async function rebuildSnapshot(
  deps: SnapshotDeps,
  learnerId: UserId
): AsyncResult<Snapshot, 'DB_ERROR'> {
  const profile = await deps.store.getProfile(learnerId);
  if (!profile.ok) return profile;
  const objectives = await deps.store.listObjectives(learnerId);
  if (!objectives.ok) return objectives;
  const uploads = await deps.store.listUploads(learnerId);
  if (!uploads.ok) return uploads;

  const withExtractions: Array<{ upload: Upload; extraction: UploadExtraction }> = [];
  for (const upload of uploads.val) {
    if (upload.status !== 'extracted') continue;
    const extraction = await deps.store.getExtraction(upload.id);
    if (!extraction.ok) return extraction;
    if (extraction.val) withExtractions.push({ upload, extraction: extraction.val });
  }

  const estimates = deps.levelEstimates ? await deps.levelEstimates(learnerId) : ok([]);
  if (!estimates.ok) return estimates;

  const content = buildSnapshotContent({
    profile: profile.val,
    objectives: objectives.val,
    uploads: withExtractions,
    levelEstimates: estimates.val,
  });
  const digest = digestOf(content);

  const latest = await deps.store.latestSnapshot(learnerId);
  if (!latest.ok) return latest;
  if (latest.val && latest.val.digest === digest) return ok(latest.val);

  const snapshot: Snapshot = {
    learnerId,
    version: (latest.val?.version ?? 0) + 1,
    content,
    digest,
  };
  const saved = await deps.store.saveSnapshot(snapshot);
  if (!saved.ok) return saved;
  return ok(snapshot);
}

/**
 * The snapshot as prose for the tutor's instructions. Summaries and tags
 * only — the content already contains no raw upload text, and this keeps
 * it that way by construction.
 */
export function renderSnapshot(content: SnapshotContent): string {
  const lines: string[] = [];
  if (content.about) lines.push(`About: ${content.about}`);
  if (content.gradeLabel) lines.push(`Grade: ${content.gradeLabel}`);
  if (content.interests.length > 0) lines.push(`Interests: ${content.interests.join(', ')}`);
  if (content.learningStyles.length > 0)
    lines.push(`Learns best: ${content.learningStyles.join(', ')}`);
  if (content.preferredLanguage && content.preferredLanguage !== 'en')
    lines.push(`Preferred language: ${content.preferredLanguage}`);
  if (content.objectives.length > 0)
    lines.push(`Objectives: ${content.objectives.map((o) => o.title).join('; ')}`);
  for (const upload of content.uploads) {
    const tags = upload.tags.length > 0 ? ` [${upload.tags.join(', ')}]` : '';
    lines.push(`Prior work (${upload.fileName}): ${upload.summary}${tags}`);
  }
  for (const estimate of content.levelEstimates) {
    lines.push(
      `Baseline in ${estimate.subject}: ${estimate.level} (confidence ${Math.round(estimate.confidence * 100)}%)`
    );
  }
  return lines.join('\n');
}
