/**
 * @glib-glub/ai — the LLM contract, structured output, the Azure Foundry
 * chat adapter, the content-safety port and adapter, and test doubles.
 * The voice tutor's protocol lives in ./voice-live and is exported from
 * there once the gateway lands.
 */

export { errorKindOf, looksLikeCredentialFailure, transportErrorKind } from './contract';
export type {
  LlmErrorKind,
  LlmMessage,
  LlmProvider,
  LlmRequest,
  LlmResponse,
  LlmUsage,
} from './contract';
export { completeJson } from './json';
export type { Structured, StructuredErrorTag } from './json';
export { azureOpenAiProvider } from './azure-openai';
export type { AzureOpenAiConfig } from './azure-openai';
export { azureContentSafety } from './content-safety';
export type {
  AzureContentSafetyConfig,
  ContentSafety,
  SafetyCategory,
  SafetyErrorTag,
  SafetyVerdict,
} from './content-safety';
export { allowAllSafety, functionLlm, keywordSafety, scriptedLlm } from './testing';
export type { ScriptedLlm } from './testing';
export {
  azureVoiceLiveClient,
  functionCallOutput,
  openConnection,
  parseServerEvent,
  responseCreate,
  sdpCreate,
  sessionUpdate,
  userTextTurn,
  voiceLiveUrl,
} from './voice-live';
export type {
  AzureVoiceLiveConfig,
  VoiceLiveClient,
  VoiceLiveConnection,
  VoiceLiveErrorTag,
  VoiceLiveServerEvent,
  VoiceLiveSessionConfig,
  VoiceLiveTool,
} from './voice-live';
export { startFakeVoiceLiveServer } from './voice-live-fake';
export type { FakeVoiceLiveServer } from './voice-live-fake';
