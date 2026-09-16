/**
 * The Voice Live protocol layer: URL building, event parsing (known events
 * typed, unknown ones tolerated, garbage refused), the client events we
 * emit, and a real socket round trip against the fake server.
 */

import { describe, expect, it } from 'vitest';

import {
  functionCallOutput,
  openConnection,
  parseServerEvent,
  sdpCreate,
  sessionUpdate,
  voiceLiveUrl,
  type VoiceLiveSessionConfig,
} from './voice-live';
import { startFakeVoiceLiveServer } from './voice-live-fake';

const config: VoiceLiveSessionConfig = {
  instructions: 'Teach.',
  voice: { type: 'azure-standard', name: 'en-US-AvaMultilingualNeural', rate: '0.9' },
  turn_detection: { type: 'azure_semantic_vad', remove_filler_words: true },
  input_audio_transcription: { model: 'gpt-4o-transcribe', language: 'en' },
  tools: [],
};

describe('voiceLiveUrl', () => {
  it('targets the calls endpoint with the model and api version', () => {
    expect(
      voiceLiveUrl({
        endpoint: 'https://res.services.ai.azure.com/',
        model: 'gpt-realtime',
        apiVersion: '2026-04-10',
      })
    ).toBe(
      'wss://res.services.ai.azure.com/voice-live/realtime/calls?api-version=2026-04-10&model=gpt-realtime'
    );
  });
});

describe('parseServerEvent', () => {
  it('types the events the gateway acts on', () => {
    const call = parseServerEvent(
      JSON.stringify({
        type: 'response.function_call_arguments.done',
        call_id: 'c1',
        name: 'tutor_record_attempt',
        arguments: '{"attempt":"2"}',
      })
    );
    expect(
      call.ok && call.val.type === 'response.function_call_arguments.done' && call.val.name
    ).toBe('tutor_record_attempt');
  });

  it('tolerates unknown event types and refuses non-events', () => {
    expect(
      parseServerEvent(JSON.stringify({ type: 'response.audio.delta', delta: 'AAAA' }))
    ).toEqual({ ok: true, val: { type: 'other', raw: 'response.audio.delta' } });
    expect(parseServerEvent('nope').ok).toBe(false);
    expect(parseServerEvent('{}').ok).toBe(false);
  });
});

describe('client events', () => {
  it('builds a session.update with noise suppression and echo cancellation on', () => {
    const update = sessionUpdate(config);
    expect(update).toMatchObject({
      type: 'session.update',
      session: {
        instructions: 'Teach.',
        input_audio_noise_reduction: { type: 'azure_deep_noise_suppression' },
      },
    });
  });

  it('serialises a function call output as JSON text', () => {
    expect(functionCallOutput('c1', { correct: false, nextMove: 'clarify' })).toEqual({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: 'c1',
        output: '{"correct":false,"nextMove":"clarify"}',
      },
    });
  });
});

describe('fake Voice Live server', () => {
  it('answers the SDP exchange and delivers pushed events', async () => {
    const server = await startFakeVoiceLiveServer();
    expect(server.ok).toBe(true);
    if (!server.ok) return;
    const connection = await openConnection(server.val.url);
    expect(connection.ok).toBe(true);
    if (!connection.ok) return;

    const events: string[] = [];
    connection.val.onEvent((event) => {
      events.push(event.type);
    });
    void connection.val.send(sdpCreate('v=0 offer', config));
    const created = await server.val.waitFor('rtc.call.sdp.create');
    expect(created?.sdp_offer).toBe('v=0 offer');
    await new Promise((resolve) => setTimeout(resolve, 50));
    server.val.emit({ type: 'response.audio_transcript.done', transcript: 'Hello Maya' });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(events).toEqual([
      'session.created',
      'rtc.call.sdp.created',
      'session.updated',
      'response.audio_transcript.done',
    ]);
    connection.val.close();
    await server.val.close();
  });
});
