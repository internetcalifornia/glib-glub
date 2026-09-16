import esbuild from 'esbuild';
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Entry point: runs migrations, bundled with its dependencies. The CJS bundle
// turns import.meta.url into undefined, so the container must set
// MIGRATIONS_DIR (the Dockerfile migrate stage does).
await esbuild.build({
  entryPoints: [resolve(packageRoot, 'scripts/migrate.ts')],
  outfile: resolve(packageRoot, 'dist/migrate.cjs'),
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  external: ['pg'],
  logLevel: 'info',
});

// Migration files are loaded individually at runtime (directory scan +
// dynamic import), so they must exist on disk as plain files rather than
// live inside the bundle above. Same numbered filter as the runtime provider.
const migrationsSourceDir = resolve(packageRoot, 'src/migrations');
const entryPoints = readdirSync(migrationsSourceDir)
  .filter((name) => /^\d{3}-.*\.ts$/.test(name))
  .map((name) => resolve(migrationsSourceDir, name));

if (entryPoints.length > 0) {
  await esbuild.build({
    entryPoints,
    outdir: resolve(packageRoot, 'dist/migrations'),
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'cjs',
    external: ['pg', 'kysely'],
    outExtension: { '.js': '.cjs' },
    logLevel: 'info',
  });
}

console.log('✓ Migrations compiled');
