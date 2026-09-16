/**
 * Helpers the seed migrations share (Decision #7: seeds ship as migrations).
 *
 * Ids are deterministic — a UUID derived from a name — so the same seed
 * produces the same rows in every environment and a later migration can
 * refer to a seeded track by its known id. Not a migration itself (no
 * leading number), so the runner never loads it as one.
 */

import { createHash } from 'node:crypto';
import type { Kysely } from 'kysely';

/** A v4-shaped UUID derived from a name. */
export function seedId(name: string): string {
  const hex = createHash('sha256').update(`glib-glub:${name}`).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

export interface SeedLesson {
  title: string;
  objectives: string[];
  content: string;
  minutes?: number;
}

export interface SeedUnit {
  title: string;
  lessons: SeedLesson[];
}

export interface SeedTrack {
  key: string;
  category: string;
  subject: string;
  title: string;
  summary: string;
  levelMin: string;
  levelMax: string;
  language: string;
  pedagogy: string;
  units: SeedUnit[];
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Seeds write raw rows through Kysely<unknown>; the table shapes are the
// ones migration 004 created and are typed loosely here on purpose — a seed
// must keep working as the generated DB type evolves.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped Kysely handle for seed inserts
type Db = Kysely<any>;

export async function seedTrack(db: Db, track: SeedTrack): Promise<void> {
  const categoryId = seedId(`category:${track.category}`);
  const subjectId = seedId(`subject:${track.category}/${track.subject}`);
  const trackId = seedId(`track:${track.key}`);

  await db
    .insertInto('categories')
    .values({ id: categoryId, slug: slug(track.category), name: track.category })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();
  await db
    .insertInto('subjects')
    .values({
      id: subjectId,
      category_id: categoryId,
      slug: slug(track.subject),
      name: track.subject,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();
  await db
    .insertInto('tracks')
    .values({
      id: trackId,
      subject_id: subjectId,
      title: track.title,
      summary: track.summary,
      level_min: track.levelMin,
      level_max: track.levelMax,
      language: track.language,
      visibility: 'published',
      authored_by: null,
      origin: 'seed',
      pedagogy: track.pedagogy,
    })
    .execute();

  let unitPosition = 0;
  for (const unit of track.units) {
    unitPosition += 1;
    const unitId = seedId(`unit:${track.key}/${unitPosition}`);
    await db
      .insertInto('units')
      .values({ id: unitId, track_id: trackId, position: unitPosition, title: unit.title })
      .execute();
    let lessonPosition = 0;
    for (const lesson of unit.lessons) {
      lessonPosition += 1;
      await db
        .insertInto('lessons')
        .values({
          id: seedId(`lesson:${track.key}/${unitPosition}/${lessonPosition}`),
          unit_id: unitId,
          position: lessonPosition,
          title: lesson.title,
          objectives: lesson.objectives,
          content: lesson.content,
          estimated_minutes: lesson.minutes ?? 20,
        })
        .execute();
    }
  }
}

export async function unseedTrack(db: Db, key: string): Promise<void> {
  await db
    .deleteFrom('tracks')
    .where('id', '=', seedId(`track:${key}`))
    .execute();
}
