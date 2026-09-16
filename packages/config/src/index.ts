/**
 * @glib-glub/config — the environment, validated once.
 */

export {
  azureEnvSchema,
  databaseEnvSchema,
  loadEnv,
  socialProvidersOf,
  voiceGatewayEnvSchema,
  webEnvSchema,
} from './env';
export type {
  AzureEnv,
  DatabaseEnv,
  EnvSource,
  SocialProviders,
  VoiceGatewayEnv,
  WebEnv,
} from './env';
export type { ConfigErrorTag } from './errors';
