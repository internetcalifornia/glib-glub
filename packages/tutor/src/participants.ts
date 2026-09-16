/**
 * Mapping diarised speaker labels to the people who declared themselves.
 * A label is mapped when its speaker says a calibration phrase naming a
 * participant ("I'm Maya", "this is Maya's dad"); an unmapped label stays
 * `unknown` — attributing a turn to the wrong person would be worse than
 * attributing it to nobody. A solo session has nothing to tell apart:
 * every label is the learner.
 */

import type { Participant, Speaker } from './types';

export type SpeakerMap = ReadonlyMap<string, string>;

const CALIBRATION = /\b(?:i am|i'm|im|this is|it's|its)\s+([^.,!?]+)/i;

export function calibrate(
  participants: ReadonlyArray<Participant>,
  map: SpeakerMap,
  label: string,
  text: string
): SpeakerMap {
  if (map.has(label)) return map;
  const match = text.match(CALIBRATION);
  if (!match?.[1]) return map;
  const said = match[1].trim().toLowerCase();
  const claimed = new Set(map.values());
  const participant = participants.find(
    (candidate) => !claimed.has(candidate.id) && said.startsWith(candidate.name.toLowerCase())
  );
  if (!participant) return map;
  const next = new Map(map);
  next.set(label, participant.id);
  return next;
}

export function attribute(
  participants: ReadonlyArray<Participant>,
  map: SpeakerMap,
  label: string
): Speaker {
  if (participants.length === 1 && participants[0])
    return { kind: 'participant', participantId: participants[0].id };
  const participantId = map.get(label);
  if (participantId) return { kind: 'participant', participantId };
  return { kind: 'unknown', label };
}
