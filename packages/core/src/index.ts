/**
 * @glib-glub/core — the vocabulary every other package shares.
 *
 * Branding, branded ids, the injected clock, shared error tags, the one
 * sanctioned `invariant`, and a couple of Result helpers. No I/O, no
 * dependencies beyond @campfhir/safe-functions.
 */

export { PRODUCT_NAME, TUTOR_NAME } from './branding';
export { brandId, isUuid, newId } from './ids';
export type {
  AssessmentId,
  AttemptId,
  Brand,
  CardId,
  CategoryId,
  CourseId,
  DeckId,
  EnrollmentId,
  GradingId,
  LearnerProfileId,
  LessonId,
  McpApiKeyId,
  QuestionId,
  SubjectId,
  TrackId,
  TutorSessionId,
  UnitId,
  UploadId,
  UserId,
} from './ids';
export { fixedClock, systemClock } from './clock';
export type { Clock } from './clock';
export { invariant } from './invariant';
export { statusForTag } from './errors';
export type {
  CommonErrorTag,
  Conflict,
  DbError,
  Forbidden,
  NotFound,
  ValidationError,
} from './errors';
export { fromNullable } from './result';
