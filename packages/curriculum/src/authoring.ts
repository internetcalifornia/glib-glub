/**
 * Authoring: educators (and admins) create draft tracks, add units and
 * lessons in order, and publish. Only the author edits a draft; a track
 * cannot be published without at least one lesson.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import {
  newId,
  type LessonId,
  type SubjectId,
  type TrackId,
  type UnitId,
  type UserId,
} from '@glib-glub/core';
import type { AgeBand } from '@glib-glub/identity';

import type { CurriculumDeps } from './ports';
import type { Lesson, Track, TrackOrigin, TrackOutline, Unit } from './types';

export const DEFAULT_PEDAGOGY =
  'Teach by asking. Build on what the learner already knows. Never state the answer to a problem before the learner has attempted it at least twice; offer a hint, then a parallel worked example. Praise reasoning, not just correct answers. Keep turns short and check understanding often.';

async function assertMayAuthor(
  deps: CurriculumDeps,
  actorId: UserId
): AsyncResult<void, 'FORBIDDEN' | 'DB_ERROR'> {
  const roles = await deps.roles.rolesOf(actorId);
  if (!roles.ok) return roles;
  if (roles.val.includes('educator') || roles.val.includes('admin')) return ok();
  return err('FORBIDDEN', { message: 'Only an educator or admin can author tracks' });
}

async function loadDraftOwnedBy(
  deps: CurriculumDeps,
  actorId: UserId,
  trackId: TrackId
): AsyncResult<Track, 'FORBIDDEN' | 'NOT_FOUND' | 'TRACK_NOT_DRAFT' | 'DB_ERROR'> {
  const track = await deps.store.getTrack(trackId);
  if (!track.ok) return track;
  if (!track.val) return err('NOT_FOUND', { message: 'No such track' });
  if (track.val.authoredBy !== actorId) {
    return err('FORBIDDEN', { message: 'Only the author can change a track' });
  }
  if (track.val.visibility !== 'draft') {
    return err('TRACK_NOT_DRAFT', { message: 'Unpublish the track before editing it' });
  }
  return ok(track.val);
}

export interface CreateTrackInput {
  subjectId: SubjectId;
  title: string;
  summary?: string;
  levelMin?: AgeBand;
  levelMax?: AgeBand;
  language?: string;
  pedagogy?: string;
  origin?: Extract<TrackOrigin, 'educator' | 'mcp'>;
}

export async function createTrack(
  deps: CurriculumDeps,
  actorId: UserId,
  input: CreateTrackInput
): AsyncResult<Track, 'FORBIDDEN' | 'VALIDATION_ERROR' | 'NOT_FOUND' | 'DB_ERROR'> {
  const allowed = await assertMayAuthor(deps, actorId);
  if (!allowed.ok) return allowed;
  const title = input.title.trim();
  if (title.length === 0 || title.length > 200)
    return err('VALIDATION_ERROR', { message: 'A track title is 1–200 characters' });
  const subject = await deps.store.getSubject(input.subjectId);
  if (!subject.ok) return subject;
  if (!subject.val) return err('NOT_FOUND', { message: 'No such subject' });

  const track: Track = {
    id: newId<'track'>(),
    subjectId: input.subjectId,
    title,
    summary: input.summary?.trim() ?? '',
    levelMin: input.levelMin ?? 'k-5',
    levelMax: input.levelMax ?? 'adult',
    language: input.language ?? 'en',
    visibility: 'draft',
    authoredBy: actorId,
    origin: input.origin ?? 'educator',
    pedagogy: input.pedagogy?.trim() || DEFAULT_PEDAGOGY,
  };
  const saved = await deps.store.createTrack(track);
  if (!saved.ok) return saved;
  return ok(track);
}

export async function addUnit(
  deps: CurriculumDeps,
  actorId: UserId,
  input: { trackId: TrackId; title: string }
): AsyncResult<
  Unit,
  'FORBIDDEN' | 'NOT_FOUND' | 'TRACK_NOT_DRAFT' | 'VALIDATION_ERROR' | 'DB_ERROR'
> {
  const track = await loadDraftOwnedBy(deps, actorId, input.trackId);
  if (!track.ok) return track;
  const title = input.title.trim();
  if (title.length === 0) return err('VALIDATION_ERROR', { message: 'A unit needs a title' });
  const units = await deps.store.listUnits(input.trackId);
  if (!units.ok) return units;
  const unit: Unit = {
    id: newId<'unit'>(),
    trackId: input.trackId,
    position: units.val.length + 1,
    title,
  };
  const saved = await deps.store.addUnit(unit);
  if (!saved.ok) return saved;
  return ok(unit);
}

export interface AddLessonInput {
  trackId: TrackId;
  unitId: UnitId;
  title: string;
  objectives?: ReadonlyArray<string>;
  content?: string;
  estimatedMinutes?: number;
}

export async function addLesson(
  deps: CurriculumDeps,
  actorId: UserId,
  input: AddLessonInput
): AsyncResult<
  Lesson,
  'FORBIDDEN' | 'NOT_FOUND' | 'TRACK_NOT_DRAFT' | 'VALIDATION_ERROR' | 'DB_ERROR'
> {
  const track = await loadDraftOwnedBy(deps, actorId, input.trackId);
  if (!track.ok) return track;
  const unit = await deps.store.getUnit(input.unitId);
  if (!unit.ok) return unit;
  if (!unit.val || unit.val.trackId !== input.trackId)
    return err('NOT_FOUND', { message: 'No such unit in this track' });
  const title = input.title.trim();
  if (title.length === 0) return err('VALIDATION_ERROR', { message: 'A lesson needs a title' });
  const lessons = await deps.store.listLessons(input.trackId);
  if (!lessons.ok) return lessons;
  const inUnit = lessons.val.filter((lesson) => lesson.unitId === input.unitId);
  const lesson: Lesson = {
    id: newId<'lesson'>(),
    unitId: input.unitId,
    position: inUnit.length + 1,
    title,
    objectives: input.objectives ?? [],
    content: input.content ?? '',
    estimatedMinutes: input.estimatedMinutes ?? 20,
  };
  const saved = await deps.store.addLesson(lesson);
  if (!saved.ok) return saved;
  return ok(lesson);
}

export async function publishTrack(
  deps: CurriculumDeps,
  actorId: UserId,
  trackId: TrackId
): AsyncResult<Track, 'FORBIDDEN' | 'NOT_FOUND' | 'TRACK_NOT_DRAFT' | 'TRACK_EMPTY' | 'DB_ERROR'> {
  const track = await loadDraftOwnedBy(deps, actorId, trackId);
  if (!track.ok) return track;
  const lessons = await deps.store.listLessons(trackId);
  if (!lessons.ok) return lessons;
  if (lessons.val.length === 0)
    return err('TRACK_EMPTY', { message: 'Add at least one lesson before publishing' });
  const updated = await deps.store.setTrackVisibility(trackId, 'published');
  if (!updated.ok) return updated;
  return ok({ ...track.val, visibility: 'published' });
}

export async function getOutline(
  deps: { store: CurriculumDeps['store'] },
  trackId: TrackId
): AsyncResult<TrackOutline, 'NOT_FOUND' | 'DB_ERROR'> {
  const track = await deps.store.getTrack(trackId);
  if (!track.ok) return track;
  if (!track.val) return err('NOT_FOUND', { message: 'No such track' });
  const units = await deps.store.listUnits(trackId);
  if (!units.ok) return units;
  const lessons = await deps.store.listLessons(trackId);
  if (!lessons.ok) return lessons;
  return ok({
    track: track.val,
    units: [...units.val]
      .sort((a, b) => a.position - b.position)
      .map((unit) => ({
        ...unit,
        lessons: lessons.val
          .filter((lesson) => lesson.unitId === unit.id)
          .sort((a, b) => a.position - b.position),
      })),
  });
}

/** Lessons in teaching order: unit by unit, lesson by lesson. */
export function lessonsInOrder(outline: TrackOutline): Lesson[] {
  return outline.units.flatMap((unit) => unit.lessons);
}

export type { LessonId };
