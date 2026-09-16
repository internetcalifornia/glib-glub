/**
 * Regenerate src/db.types.ts from a migrated database:
 *
 *   DATABASE_URL=… pnpm --filter @glib-glub/db db:types
 */

import { Cli } from 'kysely-codegen';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const cli = new Cli();
await cli.generate({
  dialect: 'postgres',
  outFile: './src/db.types.ts',
  url,
});
console.log('✓ Generated src/db.types.ts');
