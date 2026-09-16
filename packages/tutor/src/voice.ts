/**
 * The voice profile: which voice speaks, how fast, how turns are detected,
 * and how speech is transcribed — chosen from the learner's age band, the
 * track's language, and whether more than one person is in the room.
 *
 * Names are Azure Voice Live's: `azure-standard` voices by locale, the
 * Azure semantic VAD (multilingual variant for non-English tracks), and
 * `gpt-4o-transcribe-diarize` when speakers must be told apart.
 */

import type { AgeBand } from '@glib-glub/identity';

import type { SessionMode } from './types';

export interface VoiceProfile {
  voice: { type: 'azure-standard'; name: string; rate: string };
  turnDetection: {
    type: 'azure_semantic_vad' | 'azure_semantic_vad_multilingual';
    languages?: string[];
    remove_filler_words: boolean;
  };
  transcription: {
    model: 'azure-speech' | 'gpt-4o-transcribe' | 'gpt-4o-transcribe-diarize';
    language: string;
  };
  /** Locale of the voice, e.g. en-US or ja-JP. */
  locale: string;
}

const VOICES: Record<string, { locale: string; name: string }> = {
  en: { locale: 'en-US', name: 'en-US-AvaMultilingualNeural' },
  ja: { locale: 'ja-JP', name: 'ja-JP-NanamiNeural' },
  es: { locale: 'es-ES', name: 'es-ES-XimenaMultilingualNeural' },
  fr: { locale: 'fr-FR', name: 'fr-FR-VivienneMultilingualNeural' },
  de: { locale: 'de-DE', name: 'de-DE-SeraphinaMultilingualNeural' },
};

export function rateFor(ageBand: AgeBand | null): string {
  return ageBand === 'k-5' || ageBand === '6-8' ? '0.9' : '1.0';
}

export function voiceProfile(input: {
  ageBand: AgeBand | null;
  language: string;
  mode: SessionMode;
}): VoiceProfile {
  const language = input.language.toLowerCase().slice(0, 2);
  const voice = VOICES[language] ?? VOICES.en!;
  const multilingual = language !== 'en';
  const multiSpeaker = input.mode !== 'solo';
  return {
    locale: voice.locale,
    voice: { type: 'azure-standard', name: voice.name, rate: rateFor(input.ageBand) },
    turnDetection: multilingual
      ? {
          type: 'azure_semantic_vad_multilingual',
          languages: [language, 'en'],
          remove_filler_words: true,
        }
      : { type: 'azure_semantic_vad', remove_filler_words: true },
    transcription: {
      model: multiSpeaker ? 'gpt-4o-transcribe-diarize' : 'gpt-4o-transcribe',
      language,
    },
  };
}
