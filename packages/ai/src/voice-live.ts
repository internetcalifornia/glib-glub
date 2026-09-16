/**
 * Azure Voice Live's WebSocket protocol, typed. This is the subset the
 * gateway speaks: the SDP exchange that starts a WebRTC call, session
 * configuration, text turns and function-call outputs going out;
 * transcripts, function calls, lifecycle and errors coming in. Everything
 * else the service sends parses as `{ type: 'other' }` and is ignored —
 * an unknown event must never crash a lesson.
 *
 * Decision #4: raw `ws`, not the SDK. The client below is a port; the
 * Azure implementation and the fake server (voice-live-fake.ts) both
 * satisfy it, so the gateway's behaviour is tested without Azure.
 */

import { err, ok, wrapAsync } from '@campfhir/safe-functions/helpers';
import type { AsyncResult, Result } from '@campfhir/safe-functions/types';
import WebSocket from 'ws';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Session configuration (what we send in session.update / rtc.call.sdp.create)
// ---------------------------------------------------------------------------

export interface VoiceLiveTool {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface VoiceLiveSessionConfig {
  instructions: string;
  voice: { type: 'azure-standard'; name: string; rate: string };
  turn_detection: { type: string; languages?: string[]; remove_filler_words?: boolean };
  input_audio_transcription: { model: string; language?: string };
  tools: ReadonlyArray<VoiceLiveTool>;
  tool_choice?: 'auto';
  modalities?: Array<'text' | 'audio'>;
}

export function sessionUpdate(config: VoiceLiveSessionConfig): Record<string, unknown> {
  return {
    type: 'session.update',
    session: {
      modalities: config.modalities ?? ['text', 'audio'],
      instructions: config.instructions,
      voice: config.voice,
      turn_detection: config.turn_detection,
      input_audio_transcription: config.input_audio_transcription,
      input_audio_noise_reduction: { type: 'azure_deep_noise_suppression' },
      input_audio_echo_cancellation: { type: 'server_echo_cancellation' },
      tools: config.tools,
      tool_choice: config.tool_choice ?? 'auto',
    },
  };
}

// ---------------------------------------------------------------------------
// Server events (what we parse)
// ---------------------------------------------------------------------------

const serverEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('session.created'),
    session: z.object({ id: z.string().optional() }).passthrough().optional(),
  }),
  z.object({ type: z.literal('session.updated') }),
  z.object({
    type: z.literal('rtc.call.sdp.created'),
    sdp_answer: z.string(),
    rtc_call_id: z.string().optional(),
  }),
  z.object({
    type: z.literal('rtc.call.error'),
    error: z
      .object({
        type: z.string().optional(),
        code: z.string().optional(),
        message: z.string().optional(),
      })
      .optional(),
  }),
  z.object({
    type: z.literal('error'),
    error: z
      .object({
        type: z.string().optional(),
        code: z.string().optional(),
        message: z.string().optional(),
      })
      .optional(),
  }),
  z.object({
    type: z.literal('response.function_call_arguments.done'),
    call_id: z.string(),
    name: z.string(),
    arguments: z.string(),
  }),
  z.object({
    type: z.literal('response.audio_transcript.done'),
    transcript: z.string(),
    item_id: z.string().optional(),
  }),
  z.object({
    type: z.literal('response.text.done'),
    text: z.string(),
    item_id: z.string().optional(),
  }),
  z.object({
    type: z.literal('conversation.item.input_audio_transcription.completed'),
    transcript: z.string(),
    item_id: z.string().optional(),
    speaker: z.string().optional(),
  }),
  z.object({ type: z.literal('response.done') }),
  z.object({ type: z.literal('input_audio_buffer.speech_started') }),
  z.object({ type: z.literal('input_audio_buffer.speech_stopped') }),
]);

export type VoiceLiveServerEvent =
  z.infer<typeof serverEventSchema> | { type: 'other'; raw: string };

export function parseServerEvent(raw: string): Result<VoiceLiveServerEvent, 'MALFORMED_EVENT'> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return err('MALFORMED_EVENT', { message: 'Not JSON' });
  }
  const parsed = serverEventSchema.safeParse(json);
  if (parsed.success) return ok(parsed.data);
  if (
    typeof json === 'object' &&
    json !== null &&
    'type' in json &&
    typeof json.type === 'string'
  ) {
    return ok({ type: 'other', raw: json.type });
  }
  return err('MALFORMED_EVENT', { message: 'Event has no type' });
}

// ---------------------------------------------------------------------------
// Client events (what we send)
// ---------------------------------------------------------------------------

export function sdpCreate(
  sdpOffer: string,
  config: VoiceLiveSessionConfig
): Record<string, unknown> {
  const update = sessionUpdate(config);
  return { type: 'rtc.call.sdp.create', sdp_offer: sdpOffer, session: update.session };
}

export function functionCallOutput(callId: string, output: unknown): Record<string, unknown> {
  return {
    type: 'conversation.item.create',
    item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(output) },
  };
}

export function userTextTurn(text: string): Record<string, unknown> {
  return {
    type: 'conversation.item.create',
    item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] },
  };
}

export const responseCreate = { type: 'response.create' } as const;

// ---------------------------------------------------------------------------
// The client port
// ---------------------------------------------------------------------------

export type VoiceLiveErrorTag =
  'VOICE_LIVE_CONNECT_FAILED' | 'VOICE_LIVE_SEND_FAILED' | 'VOICE_LIVE_CLOSED';

export interface VoiceLiveConnection {
  send(event: Record<string, unknown>): Result<void, 'VOICE_LIVE_SEND_FAILED'>;
  onEvent(handler: (event: VoiceLiveServerEvent) => void): void;
  onClose(handler: (reason: string) => void): void;
  close(): void;
}

export interface VoiceLiveClient {
  connect(): AsyncResult<VoiceLiveConnection, 'VOICE_LIVE_CONNECT_FAILED'>;
}

export interface AzureVoiceLiveConfig {
  /** wss://<resource>.services.ai.azure.com — the gateway appends the path. */
  endpoint: string;
  model: string;
  apiVersion: string;
  apiKey?: string | undefined;
  tokenProvider?: (() => Promise<string>) | undefined;
  /** `/voice-live/realtime/calls` for WebRTC sessions (default), `/voice-live/realtime` for pure WebSocket. */
  path?: string;
}

export function voiceLiveUrl(config: AzureVoiceLiveConfig): string {
  const base = config.endpoint.replace(/^http/, 'ws').replace(/\/+$/, '');
  const path = config.path ?? '/voice-live/realtime/calls';
  const params = new URLSearchParams({ 'api-version': config.apiVersion, model: config.model });
  return `${base}${path}?${params.toString()}`;
}

export function azureVoiceLiveClient(config: AzureVoiceLiveConfig): VoiceLiveClient {
  return {
    connect: async (): ReturnType<VoiceLiveClient['connect']> => {
      const headers: Record<string, string> = {};
      if (config.tokenProvider) {
        const token = await wrapAsync(() => config.tokenProvider!(), 'VOICE_LIVE_CONNECT_FAILED');
        if (!token.ok) return token;
        headers.authorization = `Bearer ${token.val}`;
      } else if (config.apiKey) {
        headers['api-key'] = config.apiKey;
      } else {
        return err('VOICE_LIVE_CONNECT_FAILED', { message: 'No Azure credential configured' });
      }
      return openConnection(voiceLiveUrl(config), headers);
    },
  };
}

/** Shared by the Azure client and tests against the fake server. */
export function openConnection(
  url: string,
  headers: Record<string, string> = {}
): Promise<Result<VoiceLiveConnection, 'VOICE_LIVE_CONNECT_FAILED'>> {
  return new Promise((resolve) => {
    const socket = new WebSocket(url, ['realtime'], { headers });
    const eventHandlers: Array<(event: VoiceLiveServerEvent) => void> = [];
    const closeHandlers: Array<(reason: string) => void> = [];
    // Azure sends `session.created` the moment the socket opens, before the
    // caller has awaited this promise and attached a handler. Events that
    // arrive with nobody listening are held and replayed to the first handler.
    const pending: VoiceLiveServerEvent[] = [];
    let settled = false;

    socket.on('open', () => {
      settled = true;
      resolve(
        ok({
          send: (event) => {
            if (socket.readyState !== WebSocket.OPEN)
              return err('VOICE_LIVE_SEND_FAILED', { message: 'Socket is not open' });
            socket.send(JSON.stringify(event));
            return ok();
          },
          onEvent: (handler) => {
            eventHandlers.push(handler);
            for (const event of pending.splice(0)) handler(event);
          },
          onClose: (handler) => {
            closeHandlers.push(handler);
          },
          close: () => {
            socket.close();
          },
        })
      );
    });
    socket.on('message', (data) => {
      const parsed = parseServerEvent(data.toString());
      if (!parsed.ok) return;
      if (eventHandlers.length === 0) {
        pending.push(parsed.val);
        return;
      }
      for (const handler of eventHandlers) handler(parsed.val);
    });
    socket.on('close', (code, reason) => {
      const why = `${code} ${reason.toString()}`.trim();
      if (!settled) {
        settled = true;
        resolve(err('VOICE_LIVE_CONNECT_FAILED', { message: why }));
      }
      for (const handler of closeHandlers) handler(why);
    });
    socket.on('error', (error) => {
      if (!settled) {
        settled = true;
        resolve(err('VOICE_LIVE_CONNECT_FAILED', { message: error.message, cause: error }));
      }
    });
  });
}
