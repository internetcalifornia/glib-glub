/**
 * Loggers for tests: one that remembers everything it was told, one that
 * forgets. A test that wants to assert "the failure was logged with the
 * session id" reads `records`; everything else passes `noopLogger`.
 */

import type { LogAttributes, LoggerPort } from './port';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogRecord {
  level: LogLevel;
  message: string;
  attributes: LogAttributes;
}

export interface MemoryLogger extends LoggerPort {
  records: LogRecord[];
}

export function memoryLogger(): MemoryLogger {
  const records: LogRecord[] = [];
  const at =
    (level: LogLevel) =>
    (message: string, attributes: LogAttributes = {}): void => {
      records.push({ level, message, attributes });
    };
  return {
    records,
    debug: at('debug'),
    info: at('info'),
    warn: at('warn'),
    error: at('error'),
  };
}

export const noopLogger: LoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
