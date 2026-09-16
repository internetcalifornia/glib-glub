/**
 * The gateway's logger: identity from the package manifest plus the build
 * commit, console at boot, Postgres attached once the database is up.
 */

import { createAppLogger } from '@glib-glub/logging';

import packageJson from '../package.json' with { type: 'json' };

export const logger = createAppLogger({
  application: packageJson.name,
  version: packageJson.version,
  commit: process.env.GIT_COMMIT,
  consoleLevel: process.env.CONSOLE_LOG_LEVEL,
});
