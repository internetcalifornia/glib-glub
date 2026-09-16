import type { NextConfig } from 'next';

/**
 * Workspace packages ship TypeScript source (`main: ./src/index.ts`), so Next
 * compiles them in place. Native and file-reading dependencies stay outside
 * the server bundle: pg probes for optional native bindings, ws is a
 * runtime socket library, pdfjs resolves its worker from disk, and mammoth
 * is CJS with its own zip machinery.
 */
const nextConfig: NextConfig = {
  // Dev only: Next 16 blocks dev resources requested from an origin other
  // than "localhost", and counts 127.0.0.1 as other. Ignored in production.
  allowedDevOrigins: ['127.0.0.1'],
  transpilePackages: [
    '@glib-glub/ai',
    '@glib-glub/assessment',
    '@glib-glub/blob-store',
    '@glib-glub/config',
    '@glib-glub/core',
    '@glib-glub/curriculum',
    '@glib-glub/db',
    '@glib-glub/flashcards',
    '@glib-glub/identity',
    '@glib-glub/learner-profile',
    '@glib-glub/logging',
    '@glib-glub/mcp-tools',
    '@glib-glub/tutor',
  ],
  serverExternalPackages: ['pg', 'ws', 'pdfjs-dist', 'mammoth', '@azure/storage-blob'],
};

export default nextConfig;
