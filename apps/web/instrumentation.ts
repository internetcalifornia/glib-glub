/**
 * Runs once when the server starts: attaches the Postgres log adapter so
 * every request from the first one on is recorded. Only in the Node runtime
 * — the edge graph has no database.
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { attachPersistentLogging, logger } = await import('./lib/logger');
  const attached = attachPersistentLogging();
  if (!attached.ok) {
    logger.warn('logging to console only: {reason}', {
      component: 'web/boot',
      reason: attached.err.type,
    });
  }
}
