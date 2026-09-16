/**
 * What the browser and the gateway say to each other. Four client
 * messages, parsed with Zod so a malformed frame is a tagged failure the
 * bridge answers with an `error` message rather than a crash; a closed
 * union of server messages so the session page can switch exhaustively.
 *
 * The Azure credential never appears here: the browser talks to Azure only
 * through the WebRTC media path it negotiates via the `sdp.*` pair.
 */

import { err, ok } from '@campfhir/safe-functions/helpers';
import type { Result } from '@campfhir/safe-functions/types';
import type { ParticipantRole, SessionMode, SessionSummary, Transport } from '@glib-glub/tutor';
import { z } from 'zod';

const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('session.start'),
    /** Issued by the web app (identity's `issueGatewayTicket`). */
    ticket: z.string().min(1),
    mode: z.enum(['solo', 'with_guardian', 'with_educator']).default('solo'),
    transport: z.enum(['voice', 'text']).default('voice'),
    trackId: z.uuid().nullable().default(null),
    others: z
      .array(
        z.object({ name: z.string().trim().min(1).max(80), role: z.enum(['guardian', 'educator']) })
      )
      .default([]),
  }),
  z.object({ type: z.literal('sdp.offer'), sdp: z.string().min(1) }),
  z.object({ type: z.literal('text.turn'), text: z.string().trim().min(1).max(2_000) }),
  z.object({ type: z.literal('session.end') }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export function parseClientMessage(raw: string): Result<ClientMessage, 'MALFORMED_MESSAGE'> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return err('MALFORMED_MESSAGE', { message: 'Not JSON' });
  }
  const parsed = clientMessageSchema.safeParse(json);
  if (!parsed.success)
    return err('MALFORMED_MESSAGE', { message: parsed.error.issues[0]?.message ?? 'Bad message' });
  return ok(parsed.data);
}

export type SpeakerLabel = ParticipantRole | 'tutor' | 'unknown';

export type ServerMessage =
  | {
      type: 'session.started';
      sessionId: string;
      lessonTitle: string;
      mode: SessionMode;
      transport: Transport;
      participants: Array<{ id: string; name: string; role: ParticipantRole }>;
    }
  | { type: 'sdp.answer'; sdp: string }
  | { type: 'transcript'; speaker: SpeakerLabel; name: string | null; text: string }
  | { type: 'tool'; name: string; result: Record<string, unknown> }
  | { type: 'listening'; state: 'speech_started' | 'speech_stopped' }
  | { type: 'ended'; summary: SessionSummary | null }
  | { type: 'error'; tag: string; message: string; fatal: boolean };
