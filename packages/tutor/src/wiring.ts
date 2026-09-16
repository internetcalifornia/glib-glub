/**
 * The production `TutorDeps`: the tutor's narrow ports satisfied by the
 * other packages' Postgres stores. Shared by the voice gateway and the web
 * app's text sessions so the two transports cannot drift in what the tutor
 * knows. Every adapter here is a thin translation; the policy stays in the
 * packages it belongs to.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { LlmProvider } from '@glib-glub/ai';
import type { Clock, LessonId, UserId } from '@glib-glub/core';
import {
  completeLesson,
  getOutline,
  kyselyCurriculumStore,
  lessonsInOrder,
  whatIsDue,
} from '@glib-glub/curriculum';
import type { DB } from '@glib-glub/db';
import { addCard, createDeck, kyselyFlashcardStore } from '@glib-glub/flashcards';
import { kyselyIdentityStore } from '@glib-glub/identity';
import { kyselyProfileStore, renderSnapshot } from '@glib-glub/learner-profile';
import type { Kysely } from 'kysely';

import type { Flashcards, Learners, Lessons, Progress, TutorDeps } from './ports';
import { kyselySessionStore } from './store';
import { llmSummariser, recordSummariser } from './summarise';

export interface WiringOptions {
  db: Kysely<DB>;
  clock: Clock;
  /** With a model, session summaries are written by it; without, from the record alone. */
  llm?: LlmProvider | null;
}

export function tutorDepsFromStores(options: WiringOptions): TutorDeps {
  const identity = kyselyIdentityStore(options.db);
  const profiles = kyselyProfileStore(options.db);
  const curriculum = kyselyCurriculumStore(options.db);
  const flashcardStore = kyselyFlashcardStore(options.db);

  const learners: Learners = {
    learnerContext: async (learnerId): ReturnType<Learners['learnerContext']> => {
      const user = await identity.getUser(learnerId);
      if (!user.ok) return user;
      const ageBand = await identity.getAgeBand(learnerId);
      if (!ageBand.ok) return ageBand;
      const snapshot = await profiles.latestSnapshot(learnerId);
      if (!snapshot.ok) return snapshot;
      return ok({
        name: user.val.name,
        ageBand: ageBand.val,
        snapshotText: snapshot.val ? renderSnapshot(snapshot.val.content) : '',
      });
    },
  };

  const lessons: Lessons = {
    nextLesson: async (learnerId, trackId): ReturnType<Lessons['nextLesson']> => {
      let chosenTrack = trackId;
      if (!chosenTrack) {
        const enrollments = await curriculum.listEnrollments(learnerId);
        if (!enrollments.ok) return enrollments;
        const active = enrollments.val.find((e) => e.status === 'active');
        if (!active) return err('NOTHING_DUE', { message: 'Not enrolled in any track yet' });
        chosenTrack = active.trackId;
      }
      const due = await whatIsDue(
        { store: curriculum },
        { learnerId, trackId: chosenTrack, now: options.clock.now() }
      );
      if (!due.ok) return due;
      if (due.val.finished) return err('NOTHING_DUE', { message: 'Every lesson is done' });
      // Ahead of the plan: the next uncompleted lesson still counts, so a
      // keen learner is never turned away.
      let lesson = due.val.due[0] ?? null;
      if (!lesson) {
        const outline = await getOutline({ store: curriculum }, chosenTrack);
        if (!outline.ok) return outline;
        const enrollment = await curriculum.getEnrollment(learnerId, chosenTrack);
        if (!enrollment.ok) return enrollment;
        if (!enrollment.val) return err('NOT_FOUND', { message: 'Not enrolled' });
        const completed = await curriculum.listCompletedLessons(enrollment.val.id);
        if (!completed.ok) return completed;
        const done = new Set<LessonId>(completed.val.map((p) => p.lessonId));
        lesson = lessonsInOrder(outline.val).find((l) => !done.has(l.id)) ?? null;
      }
      if (!lesson) return err('NOTHING_DUE', { message: 'Every lesson is done' });
      const track = await curriculum.getTrack(chosenTrack);
      if (!track.ok) return track;
      if (!track.val) return err('NOT_FOUND', { message: 'No such track' });
      return ok({
        trackId: chosenTrack,
        track: {
          title: track.val.title,
          pedagogy: track.val.pedagogy,
          language: track.val.language,
        },
        lessonId: lesson.id,
        lesson: { title: lesson.title, objectives: lesson.objectives, notes: lesson.content },
      });
    },
  };

  const progress: Progress = {
    completeLesson: (input): ReturnType<Progress['completeLesson']> =>
      completeLesson({ store: curriculum }, input),
  };

  const flashcards: Flashcards = {
    addCard: async (input): ReturnType<Flashcards['addCard']> => {
      const decks = await flashcardStore.listDecks(input.learnerId);
      if (!decks.ok) return decks;
      let deck = decks.val.find((d) => d.lessonId === input.lessonId) ?? null;
      if (!deck) {
        const created = await createDeck(
          { store: flashcardStore },
          { learnerId: input.learnerId, title: input.lessonTitle, lessonId: input.lessonId }
        );
        if (!created.ok) return created;
        deck = created.val;
      }
      const card = await addCard(
        { store: flashcardStore },
        {
          learnerId: input.learnerId,
          deckId: deck.id,
          front: input.front,
          back: input.back,
          now: input.now,
        }
      );
      if (!card.ok) {
        // The deck was just looked up or created for this learner; the
        // ownership and existence tags cannot apply, so they fold into
        // the port's own vocabulary.
        return err(card.err.type === 'VALIDATION_ERROR' ? 'VALIDATION_ERROR' : 'DB_ERROR', {
          message: card.err.message,
        });
      }
      return ok();
    },
  };

  return {
    store: kyselySessionStore(options.db),
    learners,
    lessons,
    progress,
    flashcards,
    summariser: options.llm ? llmSummariser(options.llm) : recordSummariser,
    clock: options.clock,
  };
}

/** A learner id typed for callers that only hold a string (route params, tickets). */
export type { UserId };
