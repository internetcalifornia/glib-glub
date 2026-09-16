/**
 * The content-safety port and its Azure adapter.
 *
 * Every piece of learner-supplied text that will be stored or shown back —
 * uploads, bios, transcripts — passes through `screenText` first. The
 * verdict is a value: `allowed`, or `blocked` with the categories that
 * tripped, so the caller can record a reason without ever storing the text.
 *
 * The Azure adapter calls AI Content Safety's `text:analyze`. Severity is
 * 0–7 per category; the threshold is conservative for a platform with
 * minors (anything at or above 2 blocks) and is a config knob, not a
 * constant buried in a prompt.
 */

import { err, ok, wrapAsync } from '@campfhir/safe-functions/helpers';
import type { AsyncResult } from '@campfhir/safe-functions/types';

export type SafetyCategory = 'Hate' | 'SelfHarm' | 'Sexual' | 'Violence';

export type SafetyVerdict =
  | { allowed: true }
  | { allowed: false; categories: ReadonlyArray<{ category: SafetyCategory; severity: number }> };

export type SafetyErrorTag = 'SAFETY_UNAVAILABLE' | 'auth';

export interface ContentSafety {
  screenText(text: string): AsyncResult<SafetyVerdict, SafetyErrorTag>;
}

export interface AzureContentSafetyConfig {
  endpoint: string;
  apiKey: string;
  /** Block at or above this severity (0–7). Default 2. */
  blockAtSeverity?: number;
  fetch?: typeof fetch;
}

interface WireAnalysisEntry {
  category?: unknown;
  severity?: unknown;
}

const CATEGORIES: ReadonlyArray<SafetyCategory> = ['Hate', 'SelfHarm', 'Sexual', 'Violence'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The analysis entries of a reply, or none when the body is not the shape we expect. */
function analysesOf(body: unknown): ReadonlyArray<WireAnalysisEntry> {
  if (!isRecord(body) || !Array.isArray(body.categoriesAnalysis)) return [];
  return body.categoriesAnalysis.filter(isRecord);
}

export function azureContentSafety(config: AzureContentSafetyConfig): ContentSafety {
  const doFetch = config.fetch ?? fetch;
  const threshold = config.blockAtSeverity ?? 2;
  const url = `${config.endpoint.replace(/\/+$/, '')}/contentsafety/text:analyze?api-version=2024-09-01`;

  return {
    async screenText(text): ReturnType<ContentSafety['screenText']> {
      const response = await wrapAsync(
        () =>
          doFetch(url, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'Ocp-Apim-Subscription-Key': config.apiKey,
            },
            body: JSON.stringify({
              text,
              categories: CATEGORIES,
              outputType: 'FourSeverityLevels',
            }),
            signal: AbortSignal.timeout(15_000),
          }),
        'SAFETY_UNAVAILABLE'
      );
      if (!response.ok) return response;
      if (response.val.status === 401 || response.val.status === 403) {
        return err('auth', { message: 'Content Safety rejected the credential' });
      }
      if (!response.val.ok) {
        return err('SAFETY_UNAVAILABLE', {
          message: `Content Safety answered ${response.val.status}`,
        });
      }
      const parsed = await wrapAsync(
        (): Promise<unknown> => response.val.json(),
        'SAFETY_UNAVAILABLE'
      );
      if (!parsed.ok) return parsed;

      const tripped = analysesOf(parsed.val).flatMap((entry) => {
        const category = CATEGORIES.find((candidate) => candidate === entry.category);
        const severity = typeof entry.severity === 'number' ? entry.severity : 0;
        return category && severity >= threshold ? [{ category, severity }] : [];
      });
      return ok(tripped.length === 0 ? { allowed: true } : { allowed: false, categories: tripped });
    },
  };
}
