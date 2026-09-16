/**
 * The bio: the learner in their own words (or a guardian's), plus the
 * structured hints the tutor's instructions are built from.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import type { UserId } from '@glib-glub/core';

import { assertMayManage, type Actor } from './access';
import type { Guardians, ProfileStore } from './ports';
import { LEARNING_STYLES, type LearnerProfile, type LearningStyle } from './types';

export interface BioDeps {
  store: ProfileStore;
  guardians: Guardians;
}

export interface BioInput {
  about: string;
  interests?: ReadonlyArray<string>;
  learningStyles?: ReadonlyArray<string>;
  preferredLanguage?: string;
  gradeLabel?: string | null;
}

const MAX_ABOUT = 4_000;

export function parseLearningStyles(values: ReadonlyArray<string>): LearningStyle[] {
  return values.flatMap((value) => {
    const style = LEARNING_STYLES.find((candidate) => candidate === value.trim().toLowerCase());
    return style ? [style] : [];
  });
}

export async function setBio(
  deps: BioDeps,
  actor: Actor,
  input: BioInput
): AsyncResult<LearnerProfile, 'FORBIDDEN' | 'VALIDATION_ERROR' | 'DB_ERROR'> {
  const allowed = await assertMayManage(deps.guardians, actor, 'bio');
  if (!allowed.ok) return allowed;
  if (input.about.trim().length === 0)
    return err('VALIDATION_ERROR', { message: 'The bio is empty' });
  if (input.about.length > MAX_ABOUT) {
    return err('VALIDATION_ERROR', { message: `The bio is longer than ${MAX_ABOUT} characters` });
  }

  const existing = await deps.store.getProfile(actor.learnerId);
  if (!existing.ok) return existing;

  const profile: LearnerProfile = {
    learnerId: actor.learnerId,
    about: input.about.trim(),
    interests: input.interests ?? existing.val?.interests ?? [],
    learningStyles: input.learningStyles
      ? parseLearningStyles(input.learningStyles)
      : (existing.val?.learningStyles ?? []),
    preferredLanguage: input.preferredLanguage ?? existing.val?.preferredLanguage ?? 'en',
    gradeLabel:
      input.gradeLabel === undefined ? (existing.val?.gradeLabel ?? null) : input.gradeLabel,
  };
  const saved = await deps.store.upsertProfile(profile);
  if (!saved.ok) return saved;
  return ok(profile);
}

export async function getProfile(
  deps: { store: ProfileStore },
  learnerId: UserId
): AsyncResult<LearnerProfile | null, 'DB_ERROR'> {
  return deps.store.getProfile(learnerId);
}
