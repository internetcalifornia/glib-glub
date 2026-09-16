// Fixture for harness.test.ts: a plain `throw` in application code.
export function parseConfig(raw: string): string {
  if (!raw) throw new Error('empty config');
  return raw;
}
