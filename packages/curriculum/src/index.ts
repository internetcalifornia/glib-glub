/**
 * @glib-glub/curriculum — categories, subjects, tracks, units, lessons;
 * authoring, browsing, enrollment and pacing; self-directed tracks.
 */

export {
  addLesson,
  addUnit,
  createTrack,
  DEFAULT_PEDAGOGY,
  getOutline,
  lessonsInOrder,
  publishTrack,
} from './authoring';
export type { AddLessonInput, CreateTrackInput } from './authoring';
export { browseSubject, ensureSubject, isVisibleTo, listCatalogue, slugify } from './catalogue';
export type { CatalogueEntry } from './catalogue';
export { completeLesson, enroll, whatIsDue } from './enrollment';
export type { EnrollInput } from './enrollment';
export type { CurriculumErrorTag } from './errors';
export { dueLessons, periodLengthMs } from './pacing';
export type { DueReport } from './pacing';
export type { CurriculumDeps, CurriculumStore, Roles } from './ports';
export {
  generateSelfDirectedTrack,
  publishSelfDirectedTrack,
  SELF_DIRECTED_SYSTEM_PROMPT,
} from './self-directed';
export type { SelfDirectedInput } from './self-directed';
export { CURRICULUM_TABLES, kyselyCurriculumStore } from './store';
export { curriculumWorld, memoryCurriculumStore, rolesFromIdentity } from './testing';
export type { CurriculumWorld } from './testing';
export type {
  Cadence,
  Category,
  Enrollment,
  EnrollmentStatus,
  Lesson,
  LessonProgress,
  PacingPlan,
  Subject,
  Track,
  TrackOrigin,
  TrackOutline,
  TrackVisibility,
  Unit,
} from './types';
