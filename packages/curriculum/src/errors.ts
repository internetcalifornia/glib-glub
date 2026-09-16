/** Every way the curriculum can fail. */
export type CurriculumErrorTag =
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'TRACK_EMPTY'
  | 'TRACK_NOT_PUBLISHED'
  | 'TRACK_NOT_DRAFT'
  | 'ALREADY_ENROLLED'
  | 'GENERATION_FAILED'
  | 'DB_ERROR';
