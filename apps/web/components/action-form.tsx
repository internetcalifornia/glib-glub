'use client';

/**
 * A form bound to a server action through useActionState: the inputs come
 * from the server component as children, the outcome renders as a Notice,
 * and the submit button disables while the action runs.
 */

import { useActionState, type ReactNode } from 'react';

import { Button, Notice } from '@/components/ui';
import { idle, type ActionState } from '@/lib/actions';

export type FormAction = (previous: ActionState, formData: FormData) => Promise<ActionState>;

export function ActionForm({
  action,
  children,
  submit,
  variant = 'primary',
  className,
}: {
  action: FormAction;
  children?: ReactNode;
  submit: string;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, idle);
  return (
    <form action={formAction} className={className ?? 'space-y-3'}>
      {children}
      <Notice state={state} />
      <Button type="submit" disabled={pending} variant={variant}>
        {submit}
      </Button>
    </form>
  );
}
