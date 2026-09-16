/**
 * One browser connection ↔ one tutoring session ↔ one Voice Live control
 * channel. The bridge is the whole behaviour of the gateway with the
 * sockets abstracted away: it takes the browser's frames as strings and a
 * `send` for the answers, opens the Voice Live connection through the
 * injected client, and turns every service event into either a stored
 * turn, a dispatched tool call, or a message to the page.
 *
 * Nothing here throws and nothing here holds an Azure credential: the
 * client port owns that. Every path returns a tagged Result; the server
 * logs what it cannot act on. The feature file in ../features is this
 * module's specification.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { AsyncResult, Result } from '@campfhir/safe-functions/types';
import {
  functionCallOutput,
  responseCreate,
  sdpCreate,
  sessionUpdate,
  userTextTurn,
  type VoiceLiveClient,
  type VoiceLiveConnection,
  type VoiceLiveServerEvent,
  type VoiceLiveSessionConfig,
} from '@glib-glub/ai';
import { brandId, TUTOR_NAME, type Clock, type UserId } from '@glib-glub/core';
import { verifyGatewayTicket, type TicketErrorTag } from '@glib-glub/identity';
import type { LoggerPort } from '@glib-glub/logging';
import {
  attribute,
  calibrate,
  dispatchTool,
  endSession,
  failSession,
  recordTurn,
  startSession,
  TOOL_DEFINITIONS,
  type Participant,
  type Speaker,
  type SpeakerMap,
  type StartedSession,
  type Transport,
  type TutorDeps,
  type TutorSession,
} from '@glib-glub/tutor';

import {
  parseClientMessage,
  type ClientMessage,
  type ServerMessage,
  type SpeakerLabel,
} from './protocol';
import { transition, type GatewayEvent, type GatewayState } from './session-machine';

export interface BridgeDeps {
  tutor: TutorDeps;
  /** A client per transport: WebRTC calls and pure-WebSocket text use different Azure paths. */
  voiceLive: (transport: Transport) => VoiceLiveClient;
  /** Shared with the web app; verifies the ticket the page presents. */
  authSecret: string;
  clock: Clock;
  logger: LoggerPort;
}

export type BridgeErrorTag =
  | TicketErrorTag
  | 'INVALID_TRANSITION'
  | 'MALFORMED_MESSAGE'
  | 'SESSION_NOT_LIVE'
  | 'NOT_FOUND'
  | 'NOTHING_DUE'
  | 'VALIDATION_ERROR'
  | 'FORBIDDEN'
  | 'SUMMARY_FAILED'
  | 'DB_ERROR'
  | 'VOICE_LIVE_CONNECT_FAILED'
  | 'VOICE_LIVE_SEND_FAILED'
  | 'VOICE_LIVE_CLOSED'
  | 'NO_OPEN_PROBLEM'
  | 'UNKNOWN_TOOL';

export interface Bridge {
  state(): GatewayState;
  /** One frame from the browser. A failure here has already been reported to the page. */
  handle(raw: string): AsyncResult<void, BridgeErrorTag>;
  /** The browser went away: the session is closed out with a summary. */
  browserClosed(): AsyncResult<void, BridgeErrorTag>;
}

interface Live {
  userId: UserId;
  started: StartedSession;
  config: VoiceLiveSessionConfig;
  connection: VoiceLiveConnection | null;
  speakers: SpeakerMap;
}

type ToolCallEvent = Extract<
  VoiceLiveServerEvent,
  { type: 'response.function_call_arguments.done' }
>;

function parseToolArguments(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw || '{}');
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed))
      return { ...parsed };
  } catch {
    // Fall through: the tool sees no arguments and answers VALIDATION_ERROR.
  }
  return {};
}

export function createBridge(deps: BridgeDeps, send: (message: ServerMessage) => void): Bridge {
  let state: GatewayState = 'idle';
  let live: Live | null = null;
  const log = (fields: Record<string, unknown>) => ({ component: 'gateway/bridge', ...fields });

  const move = (event: GatewayEvent): Result<void, 'INVALID_TRANSITION'> => {
    const next = transition(state, event);
    if (!next.ok) return next;
    state = next.val;
    return ok();
  };

  /** Report a fatal failure to the page, mark the session failed, and settle the machine. */
  const fail = async (tag: BridgeErrorTag, message: string): AsyncResult<void, BridgeErrorTag> => {
    send({ type: 'error', tag, message, fatal: true });
    if (live) {
      const failed = await failSession(deps.tutor, live.started.session.id, message);
      if (!failed.ok)
        deps.logger.warn(
          'could not mark session failed: {reason}',
          log({ reason: failed.err.type })
        );
      live.connection?.close();
    }
    void move('fail');
    return err(tag, { message });
  };

  const speakerLabel = (
    session: TutorSession,
    speaker: Speaker
  ): { speaker: SpeakerLabel; name: string | null } => {
    if (speaker.kind === 'tutor') return { speaker: 'tutor', name: TUTOR_NAME };
    if (speaker.kind === 'unknown') return { speaker: 'unknown', name: null };
    const participant = session.participants.find((p) => p.id === speaker.participantId);
    return participant
      ? { speaker: participant.role, name: participant.name }
      : { speaker: 'unknown', name: null };
  };

  const record = async (
    speaker: Speaker,
    text: string
  ): AsyncResult<void, 'NOT_FOUND' | 'SESSION_NOT_LIVE' | 'DB_ERROR'> => {
    if (!live) return err('NOT_FOUND', { message: 'No session' });
    const turn = await recordTurn(deps.tutor, {
      sessionId: live.started.session.id,
      speaker,
      text,
    });
    if (!turn.ok) {
      deps.logger.warn('turn not recorded: {reason}', log({ reason: turn.err.type }));
      return turn;
    }
    send({ type: 'transcript', ...speakerLabel(live.started.session, speaker), text });
    return ok();
  };

  /** Close the session out with a summary; the tutor may already have done so through its tool. */
  const finish = async (): AsyncResult<void, BridgeErrorTag> => {
    if (!live) return err('NOT_FOUND', { message: 'No session' });
    const ended = await endSession(deps.tutor, {
      actorId: live.userId,
      sessionId: live.started.session.id,
    });
    if (ended.ok) {
      send({ type: 'ended', summary: ended.val.summary });
    } else {
      const current = await deps.tutor.store.getSession(live.started.session.id);
      if (!(current.ok && current.val?.status === 'ended'))
        return fail(ended.err.type, ended.err.message ?? 'Could not end the session');
      send({ type: 'ended', summary: current.val.summary });
    }
    live.connection?.close();
    void move('ended');
    return ok();
  };

  const onToolCall = async (event: ToolCallEvent): AsyncResult<void, BridgeErrorTag> => {
    if (!live?.connection) return err('SESSION_NOT_LIVE', { message: 'No voice connection' });
    const outcome = await dispatchTool(
      deps.tutor,
      live.started.session.id,
      event.name,
      parseToolArguments(event.arguments)
    );
    const output = outcome.ok
      ? outcome.val
      : { error: outcome.err.type, message: outcome.err.message ?? '' };
    const delivered = live.connection.send(functionCallOutput(event.call_id, output));
    if (!delivered.ok) return delivered;
    send({ type: 'tool', name: event.name, result: output });
    if (event.name === 'tutor_end_session' && outcome.ok) {
      // The tutor said goodbye through the tool; close out the same way an
      // explicit session.end would, without asking Voice Live for more.
      const moved = move('end');
      if (!moved.ok) return moved;
      return finish();
    }
    return live.connection.send(responseCreate);
  };

  const report = <S extends string>(result: Result<unknown, S>, what: string): void => {
    if (!result.ok)
      deps.logger.warn('{what} failed: {reason}', log({ what, reason: result.err.type }));
  };

  const onVoiceLiveEvent = (event: VoiceLiveServerEvent): void => {
    if (!live) return;
    const session = live.started.session;
    switch (event.type) {
      case 'rtc.call.sdp.created':
        send({ type: 'sdp.answer', sdp: event.sdp_answer });
        report(move('started'), 'go live');
        return;
      case 'conversation.item.input_audio_transcription.completed': {
        const label = event.speaker ?? 'speaker_0';
        live.speakers = calibrate(session.participants, live.speakers, label, event.transcript);
        void record(attribute(session.participants, live.speakers, label), event.transcript).then(
          (r) => report(r, 'record learner turn')
        );
        return;
      }
      case 'response.audio_transcript.done':
        void record({ kind: 'tutor' }, event.transcript).then((r) =>
          report(r, 'record tutor turn')
        );
        return;
      case 'response.text.done':
        void record({ kind: 'tutor' }, event.text).then((r) => report(r, 'record tutor turn'));
        return;
      case 'response.function_call_arguments.done':
        void onToolCall(event).then((r) => report(r, `tool ${event.name}`));
        return;
      case 'input_audio_buffer.speech_started':
        send({ type: 'listening', state: 'speech_started' });
        return;
      case 'input_audio_buffer.speech_stopped':
        send({ type: 'listening', state: 'speech_stopped' });
        return;
      case 'error':
      case 'rtc.call.error':
        deps.logger.warn(
          'voice live reported {code}: {detail}',
          log({ code: event.error?.code ?? 'unknown', detail: event.error?.message ?? '' })
        );
        send({
          type: 'error',
          tag: 'VOICE_LIVE_ERROR',
          message: event.error?.message ?? 'Voice service error',
          fatal: false,
        });
        return;
      default:
        return;
    }
  };

  const start = async (
    message: Extract<ClientMessage, { type: 'session.start' }>
  ): AsyncResult<void, BridgeErrorTag> => {
    const verified = verifyGatewayTicket({
      secret: deps.authSecret,
      ticket: message.ticket,
      now: deps.clock.now(),
    });
    if (!verified.ok) return verified;
    const moved = move('start');
    if (!moved.ok) return moved;
    const started = await startSession(deps.tutor, {
      learnerId: verified.val,
      trackId: message.trackId ? brandId<'track'>(message.trackId) : null,
      mode: message.mode,
      transport: message.transport,
      others: message.others,
    });
    if (!started.ok) return started;
    const config: VoiceLiveSessionConfig = {
      instructions: started.val.instructions,
      voice: started.val.voice.voice,
      turn_detection: started.val.voice.turnDetection,
      input_audio_transcription: started.val.voice.transcription,
      tools: TOOL_DEFINITIONS,
      tool_choice: 'auto',
      modalities: message.transport === 'text' ? ['text'] : ['text', 'audio'],
    };
    live = {
      userId: verified.val,
      started: started.val,
      config,
      connection: null,
      speakers: new Map(),
    };

    const connection = await deps.voiceLive(message.transport).connect();
    if (!connection.ok) return connection;
    live.connection = connection.val;
    connection.val.onEvent(onVoiceLiveEvent);
    connection.val.onClose((reason) => {
      if (state === 'live' || state === 'starting')
        void fail('VOICE_LIVE_CLOSED', `Voice service closed: ${reason}`);
    });
    send({
      type: 'session.started',
      sessionId: started.val.session.id,
      lessonTitle: started.val.session.lessonTitle,
      mode: started.val.session.mode,
      transport: message.transport,
      participants: started.val.session.participants.map(({ id, name, role }: Participant) => ({
        id,
        name,
        role,
      })),
    });
    if (message.transport === 'text') {
      // No media to negotiate: configure the session and go live.
      const sent = connection.val.send(sessionUpdate(config));
      if (!sent.ok) return sent;
      return move('started');
    }
    return ok();
  };

  const refuse = (tag: BridgeErrorTag, message: string): Result<void, BridgeErrorTag> => {
    send({ type: 'error', tag, message, fatal: false });
    return err(tag, { message });
  };

  const handle = async (raw: string): AsyncResult<void, BridgeErrorTag> => {
    const parsed = parseClientMessage(raw);
    if (!parsed.ok) return refuse(parsed.err.type, parsed.err.message ?? 'Bad message');
    const message = parsed.val;
    switch (message.type) {
      case 'session.start': {
        const started = await start(message);
        if (!started.ok)
          return fail(started.err.type, started.err.message ?? 'Could not start the session');
        return ok();
      }
      case 'sdp.offer': {
        if (state !== 'starting' || !live?.connection)
          return refuse('INVALID_TRANSITION', `No session to negotiate while ${state}`);
        const sent = live.connection.send(sdpCreate(message.sdp, live.config));
        if (!sent.ok)
          return fail(sent.err.type, sent.err.message ?? 'Could not reach the voice service');
        return ok();
      }
      case 'text.turn': {
        if (state !== 'live' || !live?.connection)
          return refuse('SESSION_NOT_LIVE', `Cannot take a turn while ${state}`);
        const learner = live.started.session.participants.find((p) => p.role === 'learner');
        const recorded = await record(
          learner
            ? { kind: 'participant', participantId: learner.id }
            : { kind: 'unknown', label: 'text' },
          message.text
        );
        if (!recorded.ok) return recorded;
        const sent = live.connection.send(userTextTurn(message.text));
        if (!sent.ok) return sent;
        return live.connection.send(responseCreate);
      }
      case 'session.end': {
        const moved = move('end');
        if (!moved.ok) return refuse(moved.err.type, moved.err.message ?? 'Nothing to end');
        return finish();
      }
    }
  };

  return {
    state: () => state,
    handle,
    browserClosed: async (): AsyncResult<void, BridgeErrorTag> => {
      if (state !== 'live' && state !== 'starting') return ok();
      const moved = move('end');
      if (!moved.ok) return moved;
      return finish();
    },
  };
}
