/**
 * @glib-glub/logging — the structural logger port every package depends on,
 * and the bored-logs construction the apps use to satisfy it.
 */

export type { LogAttributes, LoggerPort } from './port';
export { attachPostgresAdapter, createAppLogger } from './logger';
export type { AppLogger, AppLoggerOptions, LoggingErrorTag } from './logger';
export { memoryLogger, noopLogger } from './testing';
export type { LogLevel, LogRecord, MemoryLogger } from './testing';
