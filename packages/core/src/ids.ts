/**
 * Branded identifiers.
 *
 * Every table's primary key is a UUID string. Without brands, a `userId` slips
 * into a `trackId` parameter without complaint and the bug surfaces as an
 * empty query result in production. A brand is a phantom type the compiler
 * checks and the runtime never sees.
 *
 * The brand is minted in exactly one function, `brandId`, which carries the
 * only sanctioned `as` cast in the repository (see eslint.config.js: casts are
 * otherwise an error). Every other module obtains a branded id either from
 * `newId()` or from a database row that was typed at the store boundary.
 */

declare const brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type UserId = Brand<string, 'user'>;
export type LearnerProfileId = Brand<string, 'learner_profile'>;
export type UploadId = Brand<string, 'upload'>;
export type TrackId = Brand<string, 'track'>;
export type CourseId = Brand<string, 'course'>;
export type UnitId = Brand<string, 'unit'>;
export type LessonId = Brand<string, 'lesson'>;
export type CategoryId = Brand<string, 'category'>;
export type SubjectId = Brand<string, 'subject'>;
export type EnrollmentId = Brand<string, 'enrollment'>;
export type QuestionId = Brand<string, 'question'>;
export type AssessmentId = Brand<string, 'assessment'>;
export type AttemptId = Brand<string, 'attempt'>;
export type GradingId = Brand<string, 'grading'>;
export type DeckId = Brand<string, 'deck'>;
export type CardId = Brand<string, 'card'>;
export type TutorSessionId = Brand<string, 'tutor_session'>;
export type McpApiKeyId = Brand<string, 'mcp_api_key'>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/**
 * Stamp a brand onto a string. The caller vouches for the id's origin — a
 * store reading its own table, a validated request parameter. Never call this
 * on user input that has not been checked with `isUuid` first.
 */
export function brandId<B extends string>(value: string): Brand<string, B> {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the single place a brand is minted; brands are phantom types with no runtime form
  return value as Brand<string, B>;
}

/** A fresh v4 UUID, branded. */
export function newId<B extends string>(): Brand<string, B> {
  return brandId<B>(globalThis.crypto.randomUUID());
}
