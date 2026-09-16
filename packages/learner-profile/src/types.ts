/**
 * What the platform knows about a learner as a learner: their own words,
 * what they want, what they have already done, and the distilled snapshot
 * the tutor reads.
 */

import type { Brand, UploadId, UserId } from '@glib-glub/core';

export const LEARNING_STYLES = ['visual', 'auditory', 'reading', 'hands-on'] as const;
export type LearningStyle = (typeof LEARNING_STYLES)[number];

export interface LearnerProfile {
  readonly learnerId: UserId;
  readonly about: string;
  readonly interests: ReadonlyArray<string>;
  readonly learningStyles: ReadonlyArray<LearningStyle>;
  readonly preferredLanguage: string;
  readonly gradeLabel: string | null;
}

export type ObjectiveId = Brand<string, 'objective'>;
export type ObjectiveStatus = 'active' | 'achieved' | 'archived';

export interface Objective {
  readonly id: ObjectiveId;
  readonly learnerId: UserId;
  readonly title: string;
  readonly description: string | null;
  readonly status: ObjectiveStatus;
  readonly setBy: UserId;
}

export type UploadStatus = 'pending' | 'extracted' | 'rejected' | 'failed';

export interface Upload {
  readonly id: UploadId;
  readonly learnerId: UserId;
  readonly fileName: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly blobKey: string;
  readonly status: UploadStatus;
  readonly rejectionReason: string | null;
}

export interface UploadExtraction {
  readonly uploadId: UploadId;
  readonly text: string;
  readonly summary: string;
  readonly tags: ReadonlyArray<string>;
}

export interface LevelEstimate {
  readonly subject: string;
  readonly level: string;
  readonly confidence: number;
}

/** What the tutor reads at session start. Summaries only — never raw text. */
export interface SnapshotContent {
  readonly about: string;
  readonly interests: ReadonlyArray<string>;
  readonly learningStyles: ReadonlyArray<LearningStyle>;
  readonly preferredLanguage: string;
  readonly gradeLabel: string | null;
  readonly objectives: ReadonlyArray<{ title: string }>;
  readonly uploads: ReadonlyArray<{
    fileName: string;
    summary: string;
    tags: ReadonlyArray<string>;
  }>;
  readonly levelEstimates: ReadonlyArray<LevelEstimate>;
}

export interface Snapshot {
  readonly learnerId: UserId;
  readonly version: number;
  readonly content: SnapshotContent;
  /** Content hash; equal inputs → equal digest → same version. */
  readonly digest: string;
}
