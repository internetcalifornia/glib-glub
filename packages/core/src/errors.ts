/**
 * Error tags shared across modules.
 *
 * Each module declares its own closed union in its `errors.ts`; these are the
 * tags that mean the same thing everywhere and that a boundary (a route
 * handler, an MCP tool) maps to a status code without knowing which module
 * produced them. A module's union may include these alongside its own tags.
 */

export type NotFound = 'NOT_FOUND';
export type Forbidden = 'FORBIDDEN';
export type ValidationError = 'VALIDATION_ERROR';
export type DbError = 'DB_ERROR';
export type Conflict = 'CONFLICT';

export type CommonErrorTag = NotFound | Forbidden | ValidationError | DbError | Conflict;

/** HTTP status a boundary answers with for a shared tag. Module-specific tags
 *  fall through to 500 unless the boundary maps them itself. */
export function statusForTag(tag: string): number {
  switch (tag) {
    case 'NOT_FOUND':
      return 404;
    case 'FORBIDDEN':
      return 403;
    case 'VALIDATION_ERROR':
      return 400;
    case 'CONFLICT':
      return 409;
    default:
      return 500;
  }
}
