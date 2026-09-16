/**
 * The handful of primitives every page is built from. Hand-written rather
 * than a component library: the surface is small, mobile-first, and must
 * work with large tap targets and the system dark mode.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';

import type { ActionState } from '@/lib/actions';

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-paper/60 p-4 shadow-sm">
      {title ? <h2 className="mb-3 text-lg font-semibold">{title}</h2> : null}
      {children}
    </section>
  );
}

export function Button({
  children,
  variant = 'primary',
  ...rest
}: {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const tone =
    variant === 'primary'
      ? 'bg-accent text-white hover:opacity-90'
      : variant === 'danger'
        ? 'bg-warn text-white hover:opacity-90'
        : 'border border-line bg-transparent hover:bg-accent-soft';
  return (
    <button
      {...rest}
      className={`min-h-12 rounded-xl px-4 py-2 font-medium disabled:opacity-50 ${tone} ${rest.className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant = 'primary',
}: {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
}) {
  const tone =
    variant === 'primary'
      ? 'bg-accent text-white hover:opacity-90'
      : 'border border-line hover:bg-accent-soft';
  return (
    <Link
      href={href}
      className={`inline-flex min-h-12 items-center justify-center rounded-xl px-4 py-2 font-medium ${tone}`}
    >
      {children}
    </Link>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs opacity-70">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  'w-full min-h-12 rounded-xl border border-line bg-transparent px-3 py-2 focus:border-accent focus:outline-none';

export function Notice({ state }: { state: ActionState }) {
  if (state.error)
    return (
      <p role="alert" className="rounded-xl bg-warn/10 px-3 py-2 text-sm text-warn">
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p role="status" className="rounded-xl bg-good/10 px-3 py-2 text-sm text-good">
        {state.message}
      </p>
    );
  return null;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm opacity-70">{children}</p>;
}
