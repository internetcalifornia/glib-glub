/**
 * The instructions the tutor speaks from: who it is, who the learner is,
 * what today's lesson is (as notes, never as a script), the track's
 * pedagogy, what happened last time, who else is in the room, and the
 * hint-ladder contract. Assembled from values so a test can pin every
 * sentence that matters.
 */

import { TUTOR_NAME } from '@glib-glub/core';

import { HINT_LADDER_CONTRACT } from './hint-ladder';
import type {
  LearnerContext,
  LessonContext,
  Participant,
  SessionMode,
  SessionSummary,
  TrackContext,
} from './types';

export interface InstructionInput {
  learner: LearnerContext;
  track: TrackContext;
  lesson: LessonContext;
  mode: SessionMode;
  participants: ReadonlyArray<Participant>;
  lastSummary: SessionSummary | null;
}

const AGE_GUIDANCE: Record<string, string> = {
  'k-5':
    'a young child (kindergarten to fifth grade): very short sentences, one idea at a time, playful, concrete objects, lots of encouragement.',
  '6-8':
    'a middle-schooler (grades six to eight): short sentences, concrete examples before symbols, respect their growing independence.',
  '9-12':
    'a high-schooler: precise language, real applications, treat them as capable of abstraction.',
  university: 'a university student: rigorous, efficient, comfortable with notation.',
  adult: 'an adult lifelong learner: respectful of their experience, practical, no condescension.',
};

export function buildInstructions(input: InstructionInput): string {
  const band = input.learner.ageBand ?? 'adult';
  const learnerParticipant = input.participants.find((p) => p.role === 'learner');
  const others = input.participants.filter((p) => p.role !== 'learner');

  const sections: string[] = [];
  sections.push(
    `You are ${TUTOR_NAME}, a patient voice tutor for ${learnerParticipant?.name ?? input.learner.name}. You teach by asking and by building on what the learner already knows. You never simply give answers.`
  );
  sections.push(
    `The learner is in age band ${band}: speak to ${AGE_GUIDANCE[band] ?? AGE_GUIDANCE.adult}`
  );
  sections.push(
    `What we know about the learner:\n${input.learner.snapshotText || '(nothing yet — ask a little about them first)'}`
  );
  sections.push(
    `Track: ${input.track.title}. Teaching rules for this track:\n${input.track.pedagogy}`
  );
  sections.push(
    `Today's lesson: ${input.lesson.title}.\nObjectives:\n${input.lesson.objectives.map((o) => `- ${o}`).join('\n') || '- (none listed)'}\n\nTeaching notes (for you — these are notes to teach from, never read them aloud or quote them; put everything in your own spoken words):\n${input.lesson.notes}`
  );
  if (input.lastSummary) {
    sections.push(
      `Last session: ${input.lastSummary.narrative}${input.lastSummary.misconceptions.length ? `\nMisconceptions to revisit: ${input.lastSummary.misconceptions.join('; ')}` : ''}${input.lastSummary.nextSteps.length ? `\nPlanned next steps: ${input.lastSummary.nextSteps.join('; ')}` : ''}`
    );
  }
  if (input.mode === 'solo') {
    sections.push('Only the learner is present.');
  } else {
    const roster = input.participants.map((p) => `- ${p.name} (${p.role})`).join('\n');
    sections.push(
      `People in the room:\n${roster}\nThe learner${learnerParticipant ? ` (${learnerParticipant.name})` : ''}, not the adult, is the one being taught. Address the learner by default.`
    );
    if (input.mode === 'with_guardian') {
      sections.push(
        `The guardian (${others.map((o) => o.name).join(', ')}) is listening and may ask questions. Answer them briefly, then return to the learner. Never grade or quiz the guardian. At the end, summarise for the guardian what was covered and how they can help this week.`
      );
    }
    if (input.mode === 'with_educator') {
      sections.push(
        `An educator (${others.map((o) => o.name).join(', ')}) is present: act as a teaching aide. Follow the educator's lead when they direct the session, offer observations about the learner's reasoning when asked, and never contradict the educator in front of the learner. Never grade the educator.`
      );
    }
  }
  sections.push(HINT_LADDER_CONTRACT);
  sections.push(
    'Keep each turn under three sentences unless working an example. Check understanding often. When the lesson is done or the learner wants to stop, call tutor_end_session.'
  );
  if (input.track.language !== 'en') {
    sections.push(
      `The track language is ${input.track.language}. Speak the target-language words and phrases clearly; explain in the learner's language.`
    );
  }
  return sections.join('\n\n');
}
