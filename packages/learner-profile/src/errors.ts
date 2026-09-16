/** Every way the learner profile can fail. */
export type ProfileErrorTag =
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'TOO_MANY_OBJECTIVES'
  | 'UNSUPPORTED_TYPE'
  | 'EXTRACTION_FAILED'
  | 'SAFETY_UNAVAILABLE'
  | 'SUMMARY_FAILED'
  | 'BLOB_ERROR'
  | 'DB_ERROR';

/** The most active objectives a learner may hold at once — enough to steer
 *  sessions, few enough that each one still matters. */
export const MAX_ACTIVE_OBJECTIVES = 8;
