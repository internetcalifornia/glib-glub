/**
 * The one function in this repository allowed to throw.
 *
 * `Result` is for failures a caller can act on: a row that is not there, a
 * provider that said no, an input that did not validate. An invariant is
 * different — it is a programmer error, a state the code's own reasoning says
 * cannot happen. There is no caller that can act on it, and pretending
 * otherwise (returning `err('IMPOSSIBLE')` and handling it everywhere) buries
 * the real bug under ceremony. So it aborts, loudly, with the message.
 *
 * eslint.config.js lists this file in `result/no-throw`'s `allow` option.
 * Nowhere else is `throw` permitted, and calling `invariant` is itself exempt
 * from transitive-throw analysis because the rule sees this file as allowed.
 */

export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invariant violated: ${message}`);
  }
}
