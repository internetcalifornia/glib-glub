/**
 * The page frame: product name, the signed-in person, and the four
 * destinations, as a bottom bar on phones and a header on wider screens.
 */

import { PRODUCT_NAME } from '@glib-glub/core';
import type { SessionUser } from '@glib-glub/identity';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { SignOutButton } from './sign-out-button';

const NAV = [
  { href: '/home', label: 'Home' },
  { href: '/tracks', label: 'Tracks' },
  { href: '/profile', label: 'Profile' },
  { href: '/settings', label: 'Settings' },
];

export function Shell({
  user,
  title,
  children,
}: {
  user: SessionUser | null;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="flex items-center justify-between px-4 py-3">
        <Link href={user ? '/home' : '/'} className="text-lg font-bold">
          {PRODUCT_NAME}
        </Link>
        {user ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="opacity-70">{user.name}</span>
            <SignOutButton />
          </div>
        ) : null}
      </header>
      <main className="flex-1 space-y-4 px-4 pb-24 sm:pb-8">
        <h1 className="text-2xl font-bold">{title}</h1>
        {children}
      </main>
      {user ? (
        <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 backdrop-blur sm:static sm:border-0">
          <ul className="mx-auto flex max-w-2xl justify-around">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex min-h-14 min-w-16 items-center justify-center text-sm font-medium"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
