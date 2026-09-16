/**
 * The safe-coding harness is itself under test.
 *
 * A lint rule that has silently stopped firing — a config refactor dropped a
 * glob, a plugin upgrade renamed a rule — looks exactly like a codebase with
 * no violations. These tests run the repository's real eslint.config.js over
 * fixtures that each break one rule and assert the rule reports it, and over
 * one clean fixture and assert nothing does. If this file fails, no other
 * green result in the repository means what it claims.
 *
 * The fixtures live under src/harness-fixtures so the package tsconfig covers
 * them (the rules are type-aware and refuse files outside a project). They
 * are ignored by the root config so `pnpm lint` stays green; this test lints
 * them with `ignore: false`.
 */

import { ESLint } from 'eslint';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');
const FIXTURES = resolve(import.meta.dirname, 'harness-fixtures');

let ruleIdsByFixture: Map<string, string[]>;

beforeAll(async () => {
  const eslint = new ESLint({
    cwd: REPO_ROOT,
    overrideConfigFile: resolve(REPO_ROOT, 'eslint.config.js'),
    ignore: false,
  });
  const results = await eslint.lintFiles([`${FIXTURES}/*.ts`]);
  ruleIdsByFixture = new Map(
    results.map((result) => [
      result.filePath.slice(FIXTURES.length + 1),
      result.messages.flatMap((message) => (message.ruleId ? [message.ruleId] : [])),
    ])
  );
});

function rulesFor(fixture: string): string[] {
  return ruleIdsByFixture.get(fixture) ?? [];
}

describe('the safe-coding harness', () => {
  it('reports a plain throw', () => {
    expect(rulesFor('throws.ts')).toContain('result/no-throw');
  });

  it('reports an async function that returns a naked Promise', () => {
    expect(rulesFor('naked-promise.ts')).toContain('result/no-unwrapped-async');
  });

  it('reports .val read without checking .ok', () => {
    expect(rulesFor('unhandled-result.ts')).toContain('result/require-result-handling');
  });

  it('reports an error tag widened to string', () => {
    expect(rulesFor('widened-tag.ts')).toContain('result/require-tagged-errors');
  });

  it('reports an `as` cast', () => {
    expect(rulesFor('cast.ts')).toContain('@typescript-eslint/consistent-type-assertions');
  });

  it('accepts code that returns Results', () => {
    expect(rulesFor('clean.ts')).toEqual([]);
  });
});
