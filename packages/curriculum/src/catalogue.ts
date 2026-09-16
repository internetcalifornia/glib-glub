/**
 * Browsing: the catalogue tree, and the tracks a viewer may see in a
 * subject — published tracks (a self-directed one only to its own learner)
 * plus the viewer's own drafts.
 */

import { ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import { newId, type SubjectId, type UserId } from '@glib-glub/core';

import type { CurriculumStore } from './ports';
import type { Category, Subject, Track } from './types';

export interface CatalogueEntry {
  category: Category;
  subjects: Subject[];
}

export async function listCatalogue(
  store: CurriculumStore
): AsyncResult<CatalogueEntry[], 'DB_ERROR'> {
  const categories = await store.listCategories();
  if (!categories.ok) return categories;
  const subjects = await store.listSubjects();
  if (!subjects.ok) return subjects;
  return ok(
    categories.val.map((category) => ({
      category,
      subjects: subjects.val.filter((subject) => subject.categoryId === category.id),
    }))
  );
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function ensureSubject(
  store: CurriculumStore,
  categoryName: string,
  subjectName: string
): AsyncResult<Subject, 'DB_ERROR'> {
  const categories = await store.listCategories();
  if (!categories.ok) return categories;
  let category = categories.val.find((candidate) => candidate.slug === slugify(categoryName));
  if (!category) {
    category = { id: newId<'category'>(), slug: slugify(categoryName), name: categoryName };
    const saved = await store.upsertCategory(category);
    if (!saved.ok) return saved;
  }
  const subjects = await store.listSubjects();
  if (!subjects.ok) return subjects;
  const categoryId = category.id;
  let subject = subjects.val.find(
    (candidate) => candidate.categoryId === categoryId && candidate.slug === slugify(subjectName)
  );
  if (!subject) {
    subject = { id: newId<'subject'>(), categoryId, slug: slugify(subjectName), name: subjectName };
    const saved = await store.upsertSubject(subject);
    if (!saved.ok) return saved;
  }
  return ok(subject);
}

export function isVisibleTo(track: Track, viewerId: UserId | null): boolean {
  if (track.visibility === 'published') {
    return track.origin !== 'self_directed' || track.authoredBy === viewerId;
  }
  return track.visibility === 'draft' && track.authoredBy !== null && track.authoredBy === viewerId;
}

export async function browseSubject(
  store: CurriculumStore,
  input: { viewerId: UserId | null; subjectId: SubjectId }
): AsyncResult<Track[], 'DB_ERROR'> {
  const tracks = await store.listTracksInSubject(input.subjectId);
  if (!tracks.ok) return tracks;
  return ok(tracks.val.filter((track) => isVisibleTo(track, input.viewerId)));
}
