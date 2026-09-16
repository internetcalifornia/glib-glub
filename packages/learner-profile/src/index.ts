/**
 * @glib-glub/learner-profile — who the learner is as a learner: bio,
 * uploads, objectives, and the snapshot the tutor reads.
 */

export { assertMayManage, assertMayUpload } from './access';
export type { Actor } from './access';
export { getProfile, parseLearningStyles, setBio } from './bio';
export type { BioDeps, BioInput } from './bio';
export { MAX_ACTIVE_OBJECTIVES } from './errors';
export type { ProfileErrorTag } from './errors';
export {
  compositeExtractor,
  defaultExtractor,
  docxExtractor,
  pdfExtractor,
  textExtractor,
} from './extractors';
export { addObjective, listObjectives, setObjectiveStatus } from './objectives';
export type { ObjectiveDeps } from './objectives';
export type {
  Guardians,
  ProfileStore,
  Summariser,
  Summary,
  TextExtractor,
  UploadDeps,
} from './ports';
export { buildSnapshotContent, digestOf, rebuildSnapshot, renderSnapshot } from './snapshot';
export type { SnapshotDeps, SnapshotInputs } from './snapshot';
export { kyselyProfileStore, PROFILE_TABLES } from './store';
export { keywordSummariser, llmSummariser, SUMMARISER_SYSTEM_PROMPT } from './summariser';
export { guardiansFromIdentity, memoryProfileStore } from './testing';
export { LEARNING_STYLES } from './types';
export type {
  LearnerProfile,
  LearningStyle,
  LevelEstimate,
  Objective,
  ObjectiveId,
  ObjectiveStatus,
  Snapshot,
  SnapshotContent,
  Upload,
  UploadExtraction,
  UploadStatus,
} from './types';
export { blobKeyFor, deleteUpload, uploadWork } from './uploads';
export type { UploadInput } from './uploads';
