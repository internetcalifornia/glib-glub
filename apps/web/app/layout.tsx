import { PRODUCT_NAME } from '@glib-glub/core';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: { default: PRODUCT_NAME, template: `%s · ${PRODUCT_NAME}` },
  description: 'A voice-first tutor that builds on what you already know.',
  applicationName: PRODUCT_NAME,
  robots: { index: false, follow: false },
};

/** The on-screen keyboard shrinks the layout viewport, so the session page's
 *  controls stay above it. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
