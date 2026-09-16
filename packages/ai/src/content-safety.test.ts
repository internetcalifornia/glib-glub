/**
 * The Azure Content Safety adapter blocks at the configured severity and
 * names the categories; the keyword fake used by feature tests blocks on
 * its marker only.
 */

import { describe, expect, it } from 'vitest';

import { azureContentSafety } from './content-safety';
import { keywordSafety } from './testing';

function stub(body: unknown, status = 200) {
  return async (): Promise<Response> => new Response(JSON.stringify(body), { status });
}

describe('azureContentSafety', () => {
  it('allows text below the threshold', async () => {
    const safety = azureContentSafety({
      endpoint: 'https://x',
      apiKey: 'k',
      fetch: stub({
        categoriesAnalysis: [
          { category: 'Violence', severity: 0 },
          { category: 'Hate', severity: 0 },
        ],
      }),
    });

    const verdict = await safety.screenText('fractions homework');

    expect(verdict).toEqual({ ok: true, val: { allowed: true } });
  });

  it('blocks at or above the threshold and names the categories', async () => {
    const safety = azureContentSafety({
      endpoint: 'https://x',
      apiKey: 'k',
      blockAtSeverity: 2,
      fetch: stub({
        categoriesAnalysis: [
          { category: 'Violence', severity: 4 },
          { category: 'Hate', severity: 0 },
        ],
      }),
    });

    const verdict = await safety.screenText('…');

    expect(verdict.ok && verdict.val).toEqual({
      allowed: false,
      categories: [{ category: 'Violence', severity: 4 }],
    });
  });

  it('reports the service as unavailable rather than allowing by default', async () => {
    const safety = azureContentSafety({ endpoint: 'https://x', apiKey: 'k', fetch: stub({}, 500) });

    const verdict = await safety.screenText('…');

    expect(!verdict.ok && verdict.err.type).toBe('SAFETY_UNAVAILABLE');
  });
});

describe('keywordSafety', () => {
  it('blocks only text carrying the marker', async () => {
    const safety = keywordSafety();

    const fine = await safety.screenText('fine');
    const bad = await safety.screenText('x [unsafe content] y');

    expect(fine.ok && fine.val).toEqual({ allowed: true });
    expect(bad.ok && bad.val.allowed).toBe(false);
  });
});
