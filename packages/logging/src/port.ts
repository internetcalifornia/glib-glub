/**
 * The slice of a logger the domain packages depend on.
 *
 * bored-logs' `Logger` is a rich object (adapters, templates, queries). A
 * package that takes the whole thing needs bored-logs in its test setup and
 * can never be handed a simpler logger. So packages take `LoggerPort` — the
 * four methods they call, with bored-logs' `{placeholder}` message convention
 * — and the apps hand them the real logger, which satisfies it structurally.
 * Tests hand them `memoryLogger()` from ./testing and assert on the records.
 */

export type LogAttributes = Record<string, unknown>;

export interface LoggerPort {
  debug(message: string, attributes?: LogAttributes): unknown;
  info(message: string, attributes?: LogAttributes): unknown;
  warn(message: string, attributes?: LogAttributes): unknown;
  error(message: string, attributes?: LogAttributes): unknown;
}
