/**
 * Who the learner is as a learner: the bio, objectives, uploaded work, and
 * the snapshot the tutor will read — shown verbatim so there is no mystery
 * about what the tutor is told.
 */

import {
  getProfile,
  LEARNING_STYLES,
  listObjectives,
  renderSnapshot,
} from '@glib-glub/learner-profile';
import { redirect } from 'next/navigation';

import { ActionForm } from '@/components/action-form';
import { Shell } from '@/components/shell';
import { Card, Empty, Field, inputClass } from '@/components/ui';
import { getDeps } from '@/lib/deps';
import { getSessionFromHeaders } from '@/lib/session';

import {
  addObjectiveAction,
  deleteUploadAction,
  saveBioAction,
  setObjectiveStatusAction,
  uploadWorkAction,
} from './actions';

export const metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const session = await getSessionFromHeaders();
  if (!session.ok) redirect('/sign-in');
  const deps = getDeps();
  if (!deps.ok)
    return (
      <Shell user={session.val} title="Profile">
        Configuration error.
      </Shell>
    );
  const learnerId = session.val.userId;
  const [profile, objectives, uploads, snapshot] = await Promise.all([
    getProfile({ store: deps.val.profiles }, learnerId),
    listObjectives({ store: deps.val.profiles }, learnerId, 'active'),
    deps.val.profiles.listUploads(learnerId),
    deps.val.profiles.latestSnapshot(learnerId),
  ]);
  const bio = profile.ok ? profile.val : null;

  return (
    <Shell user={session.val} title="Profile">
      <Card title="About you">
        <ActionForm action={saveBioAction} submit="Save">
          <Field
            label="Tell the tutor about yourself"
            hint="Interests, what you find hard, how you like to learn."
          >
            <textarea
              name="about"
              rows={4}
              className={inputClass}
              defaultValue={bio?.about ?? ''}
              required
            />
          </Field>
          <Field label="Interests" hint="Comma separated.">
            <input
              name="interests"
              className={inputClass}
              defaultValue={bio?.interests.join(', ') ?? ''}
            />
          </Field>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">You learn best by</legend>
            <div className="flex flex-wrap gap-3">
              {LEARNING_STYLES.map((style) => (
                <label key={style} className="flex min-h-12 items-center gap-2">
                  <input
                    type="checkbox"
                    name="learningStyles"
                    value={style}
                    defaultChecked={bio?.learningStyles.includes(style) ?? false}
                  />
                  {style}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Grade or level" hint="For example “Grade 6” or “Adult beginner”.">
            <input name="gradeLabel" className={inputClass} defaultValue={bio?.gradeLabel ?? ''} />
          </Field>
          <Field label="Preferred language">
            <input
              name="preferredLanguage"
              className={inputClass}
              defaultValue={bio?.preferredLanguage ?? 'en'}
              maxLength={5}
            />
          </Field>
        </ActionForm>
      </Card>

      <Card title="Objectives">
        {!objectives.ok || objectives.val.length === 0 ? (
          <Empty>Nothing yet. What do you want to get better at?</Empty>
        ) : (
          <ul className="mb-3 space-y-2">
            {objectives.val.map((objective) => (
              <li key={objective.id} className="flex items-center justify-between gap-2">
                <span>{objective.title}</span>
                <span className="flex gap-2">
                  <ActionForm
                    action={setObjectiveStatusAction.bind(null, objective.id, 'achieved')}
                    submit="Done"
                    variant="secondary"
                    className="inline"
                  />
                  <ActionForm
                    action={setObjectiveStatusAction.bind(null, objective.id, 'archived')}
                    submit="Drop"
                    variant="secondary"
                    className="inline"
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={addObjectiveAction} submit="Add objective">
          <Field label="New objective">
            <input name="title" className={inputClass} required maxLength={120} />
          </Field>
        </ActionForm>
      </Card>

      <Card title="Past work">
        {!uploads.ok || uploads.val.length === 0 ? (
          <Empty>
            Upload a worksheet, an essay, or a report card. The tutor reads a summary, never the
            text itself.
          </Empty>
        ) : (
          <ul className="mb-3 space-y-2">
            {uploads.val.map((upload) => (
              <li key={upload.id} className="flex items-center justify-between gap-2">
                <span>
                  {upload.fileName}
                  <span className="block text-xs opacity-70">{upload.status}</span>
                </span>
                <ActionForm
                  action={deleteUploadAction.bind(null, upload.id)}
                  submit="Remove"
                  variant="secondary"
                  className="inline"
                />
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={uploadWorkAction} submit="Upload">
          <Field label="File" hint="PDF, Word, or plain text.">
            <input
              name="file"
              type="file"
              className={inputClass}
              accept=".pdf,.docx,.txt,.md,text/plain,application/pdf"
              required
            />
          </Field>
        </ActionForm>
      </Card>

      <Card title="What the tutor is told">
        {snapshot.ok && snapshot.val ? (
          <pre className="whitespace-pre-wrap text-sm">
            {renderSnapshot(snapshot.val.content) || '(nothing yet)'}
          </pre>
        ) : (
          <Empty>Save your bio to build the first snapshot.</Empty>
        )}
      </Card>
    </Shell>
  );
}
