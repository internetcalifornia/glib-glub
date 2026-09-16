'use server';

/**
 * The profile's mutations: bio, objectives, uploads, and a snapshot rebuild.
 * Each verifies the session itself and acts as that person on their own
 * profile; guardians act on a learner's profile through the learner id in
 * the form, and the profile module decides whether they may.
 */

import { brandId, isUuid, type UserId } from '@glib-glub/core';
import {
  addObjective,
  deleteUpload,
  setBio,
  setObjectiveStatus,
  uploadWork,
} from '@glib-glub/learner-profile';
import { revalidatePath } from 'next/cache';

import { failed, succeeded, type ActionState } from '@/lib/actions';
import { getDeps, type Deps } from '@/lib/deps';
import { getSessionFromHeaders } from '@/lib/session';
import { rebuildLearnerSnapshot } from '@/lib/snapshot';

type Ready = { deps: Deps; actorId: UserId; learnerId: UserId };

/** The session, the wiring, and who the form is about. */
async function ready(formData: FormData): Promise<ActionState | Ready> {
  const session = await getSessionFromHeaders();
  if (!session.ok) return failed(session);
  const deps = getDeps();
  if (!deps.ok) return failed(deps);
  const learner = formData.get('learnerId');
  const learnerId =
    typeof learner === 'string' && isUuid(learner) ? brandId<'user'>(learner) : session.val.userId;
  return { deps: deps.val, actorId: session.val.userId, learnerId };
}

function isReady(value: ActionState | Ready): value is Ready {
  return 'deps' in value;
}

function list(value: FormDataEntryValue | null): string[] {
  return typeof value === 'string'
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

export async function saveBioAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const r = await ready(formData);
  if (!isReady(r)) return r;
  const saved = await setBio(
    { store: r.deps.profiles, guardians: r.deps.guardians },
    { actorId: r.actorId, learnerId: r.learnerId },
    {
      about: String(formData.get('about') ?? ''),
      interests: list(formData.get('interests')),
      learningStyles: formData.getAll('learningStyles').map(String),
      preferredLanguage: String(formData.get('preferredLanguage') ?? 'en'),
      gradeLabel: String(formData.get('gradeLabel') ?? '').trim() || null,
    }
  );
  if (!saved.ok) return failed(saved);
  void (await rebuildLearnerSnapshot(r.deps, r.learnerId));
  revalidatePath('/profile');
  return succeeded('Saved.');
}

export async function addObjectiveAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const r = await ready(formData);
  if (!isReady(r)) return r;
  const added = await addObjective(
    { store: r.deps.profiles, guardians: r.deps.guardians },
    { actorId: r.actorId, learnerId: r.learnerId },
    { title: String(formData.get('title') ?? '') }
  );
  if (!added.ok) return failed(added);
  void (await rebuildLearnerSnapshot(r.deps, r.learnerId));
  revalidatePath('/profile');
  return succeeded('Objective added.');
}

export async function setObjectiveStatusAction(
  objectiveId: string,
  status: 'achieved' | 'archived',
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const r = await ready(formData);
  if (!isReady(r)) return r;
  const changed = await setObjectiveStatus(
    { store: r.deps.profiles, guardians: r.deps.guardians },
    { actorId: r.actorId, learnerId: r.learnerId },
    brandId<'objective'>(objectiveId),
    status
  );
  if (!changed.ok) return failed(changed);
  void (await rebuildLearnerSnapshot(r.deps, r.learnerId));
  revalidatePath('/profile');
  return succeeded(status === 'achieved' ? 'Marked achieved.' : 'Archived.');
}

export async function uploadWorkAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const r = await ready(formData);
  if (!isReady(r)) return r;
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: 'Choose a file first.' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const uploaded = await uploadWork(
    {
      store: r.deps.profiles,
      guardians: r.deps.guardians,
      blobs: r.deps.blobs,
      extractor: r.deps.extractor,
      safety: r.deps.safety,
      summariser: r.deps.summariser,
    },
    { actorId: r.actorId, learnerId: r.learnerId },
    { fileName: file.name, mimeType: file.type || 'application/octet-stream', bytes }
  );
  if (!uploaded.ok) return failed(uploaded);
  void (await rebuildLearnerSnapshot(r.deps, r.learnerId));
  revalidatePath('/profile');
  return succeeded(
    uploaded.val.status === 'extracted'
      ? `Read "${uploaded.val.fileName}" — the tutor knows about it now.`
      : `"${uploaded.val.fileName}" was ${uploaded.val.status}.`
  );
}

export async function deleteUploadAction(
  uploadId: string,
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const r = await ready(formData);
  if (!isReady(r)) return r;
  const deleted = await deleteUpload(
    {
      store: r.deps.profiles,
      guardians: r.deps.guardians,
      blobs: r.deps.blobs,
      extractor: r.deps.extractor,
      safety: r.deps.safety,
      summariser: r.deps.summariser,
    },
    { actorId: r.actorId, learnerId: r.learnerId },
    brandId<'upload'>(uploadId)
  );
  if (!deleted.ok) return failed(deleted);
  void (await rebuildLearnerSnapshot(r.deps, r.learnerId));
  revalidatePath('/profile');
  return succeeded('Removed.');
}
