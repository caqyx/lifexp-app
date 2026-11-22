import type { ComponentChildren, JSX } from 'preact';
import './Button.css';

/**
 * primary: the one main action. secondary: a filled alternative. quiet: a text action.
 * danger: a destructive action that stands alone (a dialog's confirm). quiet-danger: a
 * destructive text action next to others (Usuń in a row or card), red so it never looks
 * like the safe actions beside it.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'quiet-danger';

export interface ButtonProps extends Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'class' | 'className' | 'size'> {
  variant?: ButtonVariant;
  /** lg = the main action at the bottom of a form (thumb zone). */
  size?: 'md' | 'lg';
  block?: boolean;
  /** Work in progress: disabled and announced as busy, label stays. */
  busy?: boolean;
  children: ComponentChildren;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  busy = false,
  type = 'button',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const classes = ['ui-button', `ui-button--${variant}`, `ui-button--${size}`, block ? 'ui-button--block' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <button {...rest} type={type} class={classes} disabled={disabled || busy} aria-busy={busy || undefined}>
      {children}
    </button>
  );
}
