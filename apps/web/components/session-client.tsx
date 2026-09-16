'use client';

/**
 * The live session in the browser. One WebSocket to the gateway carries
 * control (start, SDP, text turns, end) and the authoritative transcript;
 * for voice, one RTCPeerConnection to Azure carries the audio itself, set
 * up from the SDP answer the gateway relays. The Azure credential never
 * reaches this file — the gateway holds it.
 *
 * Push-to-talk is the default on a phone (the mic track is enabled only
 * while the button is held); hands-free lets the server's VAD decide.
 */

import { useEffect, useRef, useState } from 'react';

import { Button, Card, inputClass } from '@/components/ui';

import type { TicketResponse } from '@/app/session/actions';

export interface StartRequest {
  trackId: string | null;
  transport: 'voice' | 'text';
  mode: 'solo' | 'with_guardian' | 'with_educator';
  others: Array<{ name: string; role: 'guardian' | 'educator' }>;
}

interface Line {
  id: number;
  speaker: string;
  name: string | null;
  text: string;
}

type Status = 'idle' | 'connecting' | 'starting' | 'live' | 'ended' | 'failed';

interface Summary {
  narrative: string;
  problemsPresented: number;
  problemsSolved: number;
  misconceptions: string[];
  nextSteps: string[];
  minutes: number;
}

type Incoming =
  | { type: 'session.started'; sessionId: string; lessonTitle: string; transport: 'voice' | 'text' }
  | { type: 'sdp.answer'; sdp: string }
  | { type: 'transcript'; speaker: string; name: string | null; text: string }
  | { type: 'tool'; name: string; result: Record<string, unknown> }
  | { type: 'listening'; state: 'speech_started' | 'speech_stopped' }
  | { type: 'ended'; summary: Summary | null }
  | { type: 'error'; tag: string; message: string; fatal: boolean };

function parseIncoming(raw: string): Incoming | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === 'object' &&
      value !== null &&
      'type' in value &&
      typeof value.type === 'string'
    ) {
      // The gateway's protocol is closed and typed on its side; here the
      // shape is trusted after the type check, and every field is read
      // defensively below.
      return value as Incoming; // eslint-disable-line @typescript-eslint/consistent-type-assertions -- wire message from our own gateway
    }
  } catch {
    // ignore malformed frames
  }
  return null;
}

export function SessionClient({
  issueTicket,
  start,
  learnerName,
}: {
  issueTicket: () => Promise<TicketResponse>;
  start: StartRequest;
  learnerName: string;
}) {
  const [status, setStatus] = useState<Status>('idle');
  const [lesson, setLesson] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [listening, setListening] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [text, setText] = useState('');
  const socket = useRef<WebSocket | null>(null);
  const peer = useRef<RTCPeerConnection | null>(null);
  const mic = useRef<MediaStream | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const counter = useRef(0);
  const bottom = useRef<HTMLDivElement | null>(null);

  const send = (message: Record<string, unknown>) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(message));
  };

  const setMicEnabled = (enabled: boolean) => {
    for (const track of mic.current?.getAudioTracks() ?? []) track.enabled = enabled;
  };

  const startCall = async () => {
    const pc = new RTCPeerConnection();
    peer.current = pc;
    pc.ontrack = (event) => {
      if (audio.current && event.streams[0]) audio.current.srcObject = event.streams[0];
    };
    // Events straight from Azure for low-latency UI hints; the gateway's
    // transcript messages remain the record.
    const events = pc.createDataChannel('voice-live-events');
    events.onmessage = (event) => {
      const message = parseIncoming(String(event.data));
      if (message?.type === 'listening') setListening(message.state === 'speech_started');
    };
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mic.current = stream;
    for (const track of stream.getAudioTracks()) {
      track.enabled = handsFree;
      pc.addTrack(track, stream);
    }
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send({ type: 'sdp.offer', sdp: offer.sdp });
  };

  const teardown = () => {
    for (const track of mic.current?.getTracks() ?? []) track.stop();
    mic.current = null;
    peer.current?.close();
    peer.current = null;
    socket.current?.close();
    socket.current = null;
  };

  const connect = async () => {
    setStatus('connecting');
    setError(null);
    const ticket = await issueTicket();
    if (!ticket.ok) {
      setError(ticket.error);
      setStatus('failed');
      return;
    }
    const ws = new WebSocket(ticket.gatewayUrl);
    socket.current = ws;
    ws.onopen = () => {
      setStatus('starting');
      send({
        type: 'session.start',
        ticket: ticket.ticket,
        mode: start.mode,
        transport: start.transport,
        trackId: start.trackId,
        others: start.others,
      });
    };
    ws.onmessage = (event) => {
      const message = parseIncoming(String(event.data));
      if (!message) return;
      switch (message.type) {
        case 'session.started':
          setLesson(message.lessonTitle);
          if (message.transport === 'voice')
            void startCall().catch((cause: unknown) => {
              setError(cause instanceof Error ? cause.message : 'Could not start the microphone');
              setStatus('failed');
              send({ type: 'session.end' });
            });
          else setStatus('live');
          return;
        case 'sdp.answer':
          void peer.current
            ?.setRemoteDescription({ type: 'answer', sdp: message.sdp })
            .then(() => setStatus('live'));
          return;
        case 'transcript':
          setLines((previous) => [
            ...previous,
            {
              id: counter.current++,
              speaker: message.speaker,
              name: message.name,
              text: message.text,
            },
          ]);
          return;
        case 'listening':
          setListening(message.state === 'speech_started');
          return;
        case 'tool':
          return;
        case 'ended':
          setSummary(message.summary);
          setStatus('ended');
          teardown();
          return;
        case 'error':
          setError(message.message);
          if (message.fatal) {
            setStatus('failed');
            teardown();
          }
          return;
      }
    };
    ws.onclose = () => {
      setStatus((current) => (current === 'ended' || current === 'failed' ? current : 'failed'));
    };
  };

  // The teardown only closes what this component opened; it needs no deps.
  useEffect(() => teardown, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const live = status === 'live';

  return (
    <div className="space-y-4">
      <audio ref={audio} autoPlay />
      {status === 'idle' ? (
        <Card>
          <p className="mb-3">
            {start.transport === 'voice'
              ? 'You will be asked for the microphone. Hold the button to talk, or switch to hands-free.'
              : 'Type to the tutor; it answers in text.'}
            {start.others[0] ? ` ${start.others[0].name} is in the room.` : ''}
          </p>
          <Button type="button" onClick={() => void connect()}>
            Begin
          </Button>
        </Card>
      ) : null}

      {status !== 'idle' ? (
        <Card title={lesson ?? 'Starting…'}>
          <p className="text-sm opacity-70">
            {status === 'connecting' && 'Connecting…'}
            {status === 'starting' && 'Getting things ready…'}
            {live && (listening ? 'Listening…' : 'Your turn whenever you are ready.')}
            {status === 'ended' && 'Session over.'}
            {status === 'failed' && 'The session stopped.'}
          </p>
          {error ? (
            <p role="alert" className="mt-2 text-sm text-warn">
              {error}
            </p>
          ) : null}
        </Card>
      ) : null}

      {lines.length > 0 ? (
        <Card title="Transcript">
          <ol className="max-h-[50dvh] space-y-2 overflow-y-auto">
            {lines.map((line) => (
              <li key={line.id}>
                <span className="text-xs font-medium opacity-70">
                  {line.speaker === 'tutor'
                    ? 'Tutor'
                    : (line.name ?? (line.speaker === 'learner' ? learnerName : line.speaker))}
                </span>
                <span className="block">{line.text}</span>
              </li>
            ))}
            <div ref={bottom} />
          </ol>
        </Card>
      ) : null}

      {live && start.transport === 'voice' ? (
        <Card>
          <div className="flex flex-col gap-3">
            {handsFree ? (
              <p className="text-sm">Hands-free: just talk.</p>
            ) : (
              <Button
                type="button"
                className="w-full select-none py-6 text-lg"
                onPointerDown={() => setMicEnabled(true)}
                onPointerUp={() => setMicEnabled(false)}
                onPointerLeave={() => setMicEnabled(false)}
                onPointerCancel={() => setMicEnabled(false)}
              >
                Hold to talk
              </Button>
            )}
            <label className="flex min-h-12 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={handsFree}
                onChange={(event) => {
                  setHandsFree(event.target.checked);
                  setMicEnabled(event.target.checked);
                }}
              />
              Hands-free
            </label>
          </div>
        </Card>
      ) : null}

      {live ? (
        <Card>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = text.trim();
              if (!trimmed) return;
              send({ type: 'text.turn', text: trimmed });
              setText('');
            }}
          >
            <input
              className={inputClass}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Type instead…"
              maxLength={2000}
            />
            <Button type="submit" variant="secondary">
              Send
            </Button>
          </form>
          <div className="mt-3">
            <Button type="button" variant="danger" onClick={() => send({ type: 'session.end' })}>
              End session
            </Button>
          </div>
        </Card>
      ) : null}

      {summary ? (
        <Card title="What we did">
          <p className="mb-2">{summary.narrative}</p>
          <p className="text-sm opacity-70">
            {summary.problemsSolved} of {summary.problemsPresented} problems solved ·{' '}
            {summary.minutes} min
          </p>
          {summary.nextSteps.length > 0 ? (
            <p className="mt-2 text-sm">Next time: {summary.nextSteps.join('; ')}</p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
