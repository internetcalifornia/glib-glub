/**
 * Production wiring for the web app: every port the domain packages take,
 * satisfied once per process and handed to pages, actions and routes. This
 * is the only file in the app that knows which adapter backs which port,
 * so swapping Azure for a fake, or disk for Blob storage, is one decision
 * made here.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { Result } from '@campfhir/safe-functions/types';
import {
  allowAllSafety,
  azureContentSafety,
  azureOpenAiProvider,
  type ContentSafety,
  type LlmProvider,
} from '@glib-glub/ai';
import { kyselyAssessmentStore, type AssessmentStore } from '@glib-glub/assessment';
import { azureBlobStore, diskBlobStore, type BlobStore } from '@glib-glub/blob-store';
import { socialProvidersOf, type WebEnv } from '@glib-glub/config';
import { systemClock, type Clock } from '@glib-glub/core';
import { kyselyCurriculumStore, type CurriculumStore, type Roles } from '@glib-glub/curriculum';
import { getDatabase, type DB } from '@glib-glub/db';
import { kyselyFlashcardStore, type FlashcardStore } from '@glib-glub/flashcards';
import {
  betterAuthAuthenticator,
  createAuth,
  isGuardianOf,
  kyselyIdentityStore,
  type Auth,
  type Authenticator,
  type IdentityStore,
} from '@glib-glub/identity';
import {
  defaultExtractor,
  keywordSummariser,
  kyselyProfileStore,
  llmSummariser,
  type Guardians,
  type ProfileStore,
  type Summariser,
  type TextExtractor,
} from '@glib-glub/learner-profile';
import { tutorDepsFromStores, type TutorDeps } from '@glib-glub/tutor';
import type { Kysely } from 'kysely';

import { getEnv } from './env';

export interface Deps {
  env: WebEnv;
  db: Kysely<DB>;
  auth: Auth;
  authenticator: Authenticator;
  identity: IdentityStore;
  profiles: ProfileStore;
  curriculum: CurriculumStore;
  assessment: AssessmentStore;
  flashcards: FlashcardStore;
  blobs: BlobStore;
  safety: ContentSafety;
  extractor: TextExtractor;
  summariser: Summariser;
  llm: LlmProvider | null;
  guardians: Guardians;
  roles: Roles;
  tutor: TutorDeps;
  clock: Clock;
}

export type DepsErrorTag = 'INVALID_ENV' | 'DB_INIT_ERROR';

interface DepsSlot {
  __glibGlubDeps?: Deps;
}

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- globalThis has no declared slot for our state; this is the documented split-singleton guard
const slot = globalThis as unknown as DepsSlot;

function build(): Result<Deps, DepsErrorTag> {
  const env = getEnv();
  if (!env.ok) return env;
  const db = getDatabase();
  if (!db.ok) return err('DB_INIT_ERROR', { message: db.err.message });

  const identity = kyselyIdentityStore(db.val);
  const auth = createAuth({
    db: db.val,
    store: identity,
    env: env.val,
    providers: socialProvidersOf(env.val),
  });
  const llm =
    env.val.AZURE_FOUNDRY_ENDPOINT && env.val.AZURE_FOUNDRY_API_KEY
      ? azureOpenAiProvider({
          endpoint: env.val.AZURE_FOUNDRY_ENDPOINT,
          deployment: env.val.AZURE_CHAT_DEPLOYMENT,
          apiKey: env.val.AZURE_FOUNDRY_API_KEY,
        })
      : null;
  // The Foundry resource exposes Content Safety on the same endpoint and key.
  // Without a key nothing is screened — acceptable on a developer's machine,
  // never in production, which is why DEPLOYMENT.md lists the key as required.
  const safety =
    env.val.AZURE_FOUNDRY_ENDPOINT && env.val.AZURE_FOUNDRY_API_KEY
      ? azureContentSafety({
          endpoint: env.val.AZURE_FOUNDRY_ENDPOINT,
          apiKey: env.val.AZURE_FOUNDRY_API_KEY,
        })
      : allowAllSafety;
  const guardians: Guardians = {
    isGuardianOf: (actorId, learnerId) => isGuardianOf({ store: identity }, actorId, learnerId),
    ageBandOf: (learnerId) => identity.getAgeBand(learnerId),
  };

  return ok({
    env: env.val,
    db: db.val,
    auth,
    authenticator: betterAuthAuthenticator(auth),
    identity,
    profiles: kyselyProfileStore(db.val),
    curriculum: kyselyCurriculumStore(db.val),
    assessment: kyselyAssessmentStore(db.val),
    flashcards: kyselyFlashcardStore(db.val),
    blobs: env.val.AZURE_STORAGE_CONNECTION_STRING
      ? azureBlobStore({
          connectionString: env.val.AZURE_STORAGE_CONNECTION_STRING,
          container: env.val.BLOB_CONTAINER,
        })
      : diskBlobStore('.blobs'),
    safety,
    extractor: defaultExtractor,
    summariser: llm ? llmSummariser(llm) : keywordSummariser,
    llm,
    guardians,
    roles: { rolesOf: (userId) => identity.getRoles(userId) },
    tutor: tutorDepsFromStores({ db: db.val, clock: systemClock, llm }),
    clock: systemClock,
  });
}

export function getDeps(): Result<Deps, DepsErrorTag> {
  if (slot.__glibGlubDeps) return ok(slot.__glibGlubDeps);
  const built = build();
  if (!built.ok) return built;
  slot.__glibGlubDeps = built.val;
  return built;
}
