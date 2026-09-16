/**
 * The chat adapter for Azure AI Foundry's OpenAI-compatible v1 surface,
 * over plain fetch (Decision: no vendor SDK — the wire format is small,
 * the failure modes are HTTP status codes, and a fake is a fetch stub).
 *
 * `model` is the DEPLOYMENT name. The key is sent as both
 * `Authorization: Bearer` and `api-key`: OpenAI-shaped gateways read the
 * first, classic Azure surfaces the second, each ignores the other. With
 * Microsoft Entra, `tokenProvider` supplies the bearer and no api-key is
 * sent.
 *
 * `max_completion_tokens`, not the deprecated `max_tokens`: the newer
 * reasoning models reject the old name and current chat models accept the
 * new one everywhere this adapter targets.
 */

import { err, ok, wrapAsync } from '@campfhir/safe-functions/helpers';
import type { Result } from '@campfhir/safe-functions/types';

import {
  errorKindOf,
  transportErrorKind,
  type LlmErrorKind,
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
} from './contract';

const REQUEST_TIMEOUT_MS = 120_000;

export interface AzureOpenAiConfig {
  /** https://<resource>.services.ai.azure.com or https://<resource>.openai.azure.com */
  endpoint: string;
  /** Deployment name. */
  deployment: string;
  apiKey?: string | undefined;
  /** Entra bearer token supplier (scope https://cognitiveservices.azure.com/.default). */
  tokenProvider?: (() => Promise<string>) | undefined;
  /** Injected for tests; defaults to global fetch. */
  fetch?: typeof fetch;
}

interface WireChoice {
  message?: { content?: unknown };
  finish_reason?: unknown;
}

interface WireResponse {
  choices?: WireChoice[];
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
  model?: unknown;
}

function chatCompletionsUrl(endpoint: string): string {
  return `${endpoint.replace(/\/+$/, '')}/openai/v1/chat/completions`;
}

export function azureOpenAiProvider(config: AzureOpenAiConfig): LlmProvider {
  const doFetch = config.fetch ?? fetch;

  return {
    async complete(request: LlmRequest): Promise<Result<LlmResponse, LlmErrorKind>> {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (config.tokenProvider) {
        const token = await wrapAsync(() => config.tokenProvider!(), 'auth');
        if (!token.ok)
          return err('auth', {
            message: 'Could not obtain an Entra token',
            cause: token.err.cause,
          });
        headers.authorization = `Bearer ${token.val}`;
      } else if (config.apiKey) {
        headers.authorization = `Bearer ${config.apiKey}`;
        headers['api-key'] = config.apiKey;
      } else {
        return err('auth', { message: 'No Azure credential configured' });
      }

      const body = {
        model: config.deployment,
        messages: [{ role: 'system', content: request.system }, ...request.messages],
        max_completion_tokens: request.maxTokens,
        ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
        ...(request.json ? { response_format: { type: 'json_object' } } : {}),
      };

      const signal = request.signal
        ? AbortSignal.any([
            request.signal,
            AbortSignal.timeout(request.timeoutMs ?? REQUEST_TIMEOUT_MS),
          ])
        : AbortSignal.timeout(request.timeoutMs ?? REQUEST_TIMEOUT_MS);

      const response = await wrapAsync(
        () =>
          doFetch(chatCompletionsUrl(config.endpoint), {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal,
          }),
        'network'
      );
      if (!response.ok) {
        return err(transportErrorKind(response.err.cause, request.signal), {
          message: response.err.message,
          cause: response.err.cause,
        });
      }

      const text = await wrapAsync(() => response.val.text(), 'network');
      if (!text.ok) return err('network', { message: 'Could not read the response body' });

      if (!response.val.ok) {
        return err(errorKindOf(response.val.status, text.val), {
          message: `Azure OpenAI answered ${response.val.status}: ${text.val.slice(0, 300)}`,
        });
      }

      let wire: WireResponse;
      try {
        wire = JSON.parse(text.val);
      } catch {
        return err('provider_error', { message: 'Azure OpenAI answered with non-JSON' });
      }
      const choice = wire.choices?.[0];
      const content = choice?.message?.content;
      if (typeof content !== 'string') {
        return err('provider_error', { message: 'Azure OpenAI answered without message content' });
      }
      const usage = wire.usage ?? {};
      return ok({
        text: content,
        stopReason: choice?.finish_reason === 'length' ? 'max_tokens' : 'end_turn',
        usage: {
          inputTokens: typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0,
          outputTokens: typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0,
        },
        model: typeof wire.model === 'string' ? wire.model : config.deployment,
      });
    },
  };
}
