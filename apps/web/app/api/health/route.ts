/**
 * Liveness, and whether the schema matches this build. Answers 503 while
 * migrations are pending: the app boots and serves what it can, but a
 * deployment gate or container healthcheck must notice that it is not
 * correctly deployed.
 */

import { getMigrationStatus, MIGRATION_COMMAND } from '@glib-glub/db';

export async function GET(): Promise<Response> {
  const status = await getMigrationStatus();
  if (!status.ok) {
    return Response.json(
      { status: 'degraded', reason: 'migration check failed', detail: status.err.type },
      { status: 503 }
    );
  }
  if (status.val.pending.length > 0) {
    return Response.json(
      {
        status: 'degraded',
        reason: 'database schema is behind this build',
        pendingMigrations: status.val.pending,
        action: MIGRATION_COMMAND,
      },
      { status: 503 }
    );
  }
  return Response.json({ status: 'ok', migrationsApplied: status.val.applied });
}
