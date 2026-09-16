/**
 * DENY BY DEFAULT for the whole HTTP surface.
 *
 * The App Router has no hook that forces a route to be authenticated, and a
 * layout check does not re-run on client-side navigation, so the guard lives
 * per page, route and server action. The only thing between us and a
 * forgotten check is this test: every `page.tsx`, `route.ts` and
 * `actions.ts` under app/ must reference a session guard, or be named below
 * with the mechanism that protects it instead. Adding an entry is a code
 * review event — one line saying why this path may be reached without a
 * session.
 *
 * What this test does NOT do is prove the mechanism works; the guards and
 * key resolution have their own tests. It proves someone decided.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../app', import.meta.url));

/** Symbols that resolve the signed-in person from the request. */
const SESSION_GUARDS = ['getSessionFromHeaders', 'getSessionFor'];

/** Reachable without a session but NOT unauthenticated: each names its credential. */
const NON_SESSION_AUTH: Record<string, string> = {
  'api/mcp/route.ts': 'API key as bearer token, resolved by lib/mcp/api-keys resolveApiKey',
};

/** Deliberately reachable by anyone. Keep the list short and the reasons real. */
const PUBLIC: Record<string, string> = {
  'api/auth/[...all]/route.ts': "Better Auth's own routes — the thing that mints sessions",
  'api/health/route.ts': 'liveness probe, content-free',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry === 'page.tsx' || entry === 'route.ts' || entry === 'actions.ts') out.push(full);
  }
  return out;
}

describe('route auth coverage', () => {
  const files = walk(APP_DIR).map((file) => relative(APP_DIR, file).split(sep).join('/'));

  it('finds the HTTP surface', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    it(`${file} references a session guard or is listed with a reason`, () => {
      const source = readFileSync(join(APP_DIR, file), 'utf8');
      const guarded = SESSION_GUARDS.some((guard) => source.includes(guard));
      const listed = file in NON_SESSION_AUTH || file in PUBLIC;
      expect(guarded || listed).toBe(true);
    });
  }

  it('lists only files that exist', () => {
    for (const listed of [...Object.keys(NON_SESSION_AUTH), ...Object.keys(PUBLIC)]) {
      expect(files).toContain(listed);
    }
  });
});
