/**
 * @glib-glub/tutor — the session model, instruction assembly, the hint
 * ladder, the tool contract, speaker mapping and summaries.
 */

export {
  answersMatch,
  HINT_LADDER_CONTRACT,
  MOVES,
  moveAfterWrongAttempt,
  recordAttempt,
} from './hint-ladder';
export type { AttemptOutcome, Move } from './hint-ladder';
export { buildInstructions } from './instructions';
export type { InstructionInput } from './instructions';
export { attribute, calibrate } from './participants';
export type { SpeakerMap } from './participants';
export type {
  Flashcards,
  Learners,
  Lessons,
  NextLesson,
  Progress,
  SessionStore,
  SessionSummariser,
  SummaryInput,
  TutorDeps,
} from './ports';
export { endSession, failSession, recordTurn, startSession } from './session';
export type { ParticipantInput, StartedSession, StartInput } from './session';
export { kyselySessionStore, TUTOR_TABLES } from './store';
export {
  llmSummariser,
  recordSummariser,
  SUMMARY_SYSTEM_PROMPT,
  summaryFromRecord,
} from './summarise';
export { memorySessionStore, tutorWorld } from './testing';
export type { TutorWorld } from './testing';
export { dispatchTool, TOOL_DEFINITIONS, TOOL_NAMES } from './tools';
export type { ToolDefinition, ToolErrorTag } from './tools';
export type { TutorErrorTag } from './errors';
export type {
  LearnerContext,
  LessonContext,
  Participant,
  ParticipantRole,
  Problem,
  SessionMode,
  SessionStatus,
  SessionSummary,
  Speaker,
  ToolCall,
  TrackContext,
  Transport,
  Turn,
  TutorSession,
} from './types';
export { rateFor, voiceProfile } from './voice';
export { tutorDepsFromStores } from './wiring';
export type { WiringOptions } from './wiring';
export type { VoiceProfile } from './voice';
