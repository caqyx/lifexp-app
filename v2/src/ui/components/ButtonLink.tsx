// A link that looks like a Button: for actions that leave the screen (e.g. "open
// this in the current version of LifeXP"), where a <button> would be the wrong element.
import type { ComponentChildren } from 'preact';
import type { ButtonVariant } from './Button';
import './Button.css';

interface ButtonLinkProps {
  href: string;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  block?: boolean;
  /** A fuller name than the visible text, e.g. "Graj: Wartime" for a "Graj" among several. */
  label?: string;
  children: ComponentChildren;
}

export function ButtonLink({ href, variant = 'secondary', size = 'md', block = false, label, children }: ButtonLinkProps) {
  const classes = ['ui-button', `ui-button--${variant}`, `ui-button--${size}`, block ? 'ui-button--block' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <a class={classes} href={href} aria-label={label}>
      {children}
    </a>
  );
}
