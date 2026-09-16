/**
 * Boot: validate the environment, open the database, wire the tutor's
 * ports to the Postgres stores, pick the Voice Live client (Azure, or the
 * in-process fake when VOICE_LIVE_FAKE=1), and listen.
 *
 * The Azure credential is read here and handed to the client port; nothing
 * downstream sees it. With no API key, Entra is used through
 * DefaultAzureCredential (the deployment's managed identity in Azure, the
 * developer's `az login` locally).
 */

import { DefaultAzureCredential } from '@azure/identity';
import { err, ok, wrapAsync } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';
import {
  azureOpenAiProvider,
  azureVoiceLiveClient,
  openConnection,
  startFakeVoiceLiveServer,
  type VoiceLiveClient,
} from '@glib-glub/ai';
import { loadEnv, voiceGatewayEnvSchema } from '@glib-glub/config';
import { systemClock } from '@glib-glub/core';
import { closeDatabase, getDatabase, getMigrationStatus } from '@glib-glub/db';
import { attachPostgresAdapter } from '@glib-glub/logging';
import { tutorDepsFromStores, type Transport } from '@glib-glub/tutor';
import { sql } from 'kysely';

import { logger } from './logger';
import { startGateway, type HealthErrorTag } from './server';

const env = loadEnv(voiceGatewayEnvSchema);
if (!env.ok) {
  logger.error('invalid environment: {detail}', {
    component: 'gateway/boot',
    detail: env.err.message ?? '',
  });
  process.exit(1);
}
const db = getDatabase();
if (!db.ok) {
  logger.error('database unavailable: {detail}', {
    component: 'gateway/boot',
    detail: db.err.message ?? '',
  });
  process.exit(1);
}
const attached = attachPostgresAdapter(logger, db.val, env.val.LOG_DB_LEVEL);
if (!attached.ok)
  logger.warn('logging to console only: {detail}', {
    component: 'gateway/boot',
    detail: attached.err.message ?? '',
  });

const fake = env.val.VOICE_LIVE_FAKE ? await startFakeVoiceLiveServer() : null;
if (fake && !fake.ok) {
  logger.error('fake voice live failed: {detail}', {
    component: 'gateway/boot',
    detail: fake.err.message ?? '',
  });
  process.exit(1);
}

function voiceLiveFor(transport: Transport): VoiceLiveClient {
  if (fake?.ok) {
    const url = fake.val.url;
    return { connect: () => openConnection(url) };
  }
  const endpoint = env.ok ? env.val.AZURE_FOUNDRY_ENDPOINT : undefined;
  if (!env.ok || !endpoint) {
    return {
      connect: (): ReturnType<VoiceLiveClient['connect']> =>
        Promise.resolve(
          err('VOICE_LIVE_CONNECT_FAILED', { message: 'AZURE_FOUNDRY_ENDPOINT is not set' })
        ),
    };
  }
  const credential = env.val.AZURE_FOUNDRY_API_KEY ? null : new DefaultAzureCredential();
  return azureVoiceLiveClient({
    endpoint,
    model: env.val.VOICE_LIVE_MODEL,
    apiVersion: env.val.VOICE_LIVE_API_VERSION,
    apiKey: env.val.AZURE_FOUNDRY_API_KEY,
    // A plain promise by the port's design: the client wraps it in wrapAsync.
    tokenProvider: credential
      ? () => credential.getToken('https://ai.azure.com/.default').then((t) => t?.token ?? '')
      : undefined,
    path: transport === 'voice' ? '/voice-live/realtime/calls' : '/voice-live/realtime',
  });
}

const llm =
  env.val.AZURE_FOUNDRY_ENDPOINT && env.val.AZURE_FOUNDRY_API_KEY
    ? azureOpenAiProvider({
        endpoint: env.val.AZURE_FOUNDRY_ENDPOINT,
        deployment: env.val.AZURE_CHAT_DEPLOYMENT,
        apiKey: env.val.AZURE_FOUNDRY_API_KEY,
      })
    : null;

const server = await startGateway(
  {
    tutor: tutorDepsFromStores({ db: db.val, clock: systemClock, llm }),
    voiceLive: voiceLiveFor,
    authSecret: env.val.AUTH_SECRET,
    clock: systemClock,
    logger,
  },
  {
    port: env.val.VOICE_GATEWAY_PORT,
    healthy: async (): AsyncResult<void, HealthErrorTag> => {
      if (!db.ok) return err('DB_UNREACHABLE');
      const ping = await wrapAsync(() => sql`select 1`.execute(db.val), 'DB_UNREACHABLE');
      if (!ping.ok) return ping;
      const status = await getMigrationStatus();
      if (!status.ok) return err('DB_UNREACHABLE', { message: status.err.message });
      if (status.val.pending.length > 0) return err('MIGRATIONS_PENDING');
      return ok();
    },
  }
);
if (!server.ok) {
  logger.error('could not listen: {detail}', {
    component: 'gateway/boot',
    detail: server.err.message ?? '',
  });
  process.exit(1);
}
logger.info('voice gateway listening on {port} ({voiceMode})', {
  component: 'gateway/boot',
  port: server.val.port,
  voiceMode: fake ? 'fake voice live' : 'azure voice live',
});

const shutdown = async (): AsyncResult<void, 'CLOSE_FAILED' | 'DB_CLOSE_ERROR'> => {
  if (!server.ok) return ok();
  const closed = await server.val.close();
  if (!closed.ok) return closed;
  if (fake?.ok) {
    const fakeClosed = await wrapAsync(() => fake.val.close(), 'CLOSE_FAILED');
    if (!fakeClosed.ok) return fakeClosed;
  }
  return closeDatabase();
};
const exitAfterShutdown = () => {
  void shutdown().then((result) => process.exit(result.ok ? 0 : 1));
};
process.on('SIGTERM', exitAfterShutdown);
process.on('SIGINT', exitAfterShutdown);
