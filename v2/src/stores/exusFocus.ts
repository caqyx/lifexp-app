// "Take me to the Ex-us input" (Ctrl/Cmd+K, docs/v2/PLAN.md 6.10): the shell bumps the
// counter, the Ex-us screen focuses its field when it sees a new value. A signal, not a global.
import { signal } from '@preact/signals';

export const exusFocusRequests = signal(0);

export function requestExusFocus(): void {
  exusFocusRequests.value += 1;
}

/**
 * A message typed outside Ex-us (the field on Today, PLAN.md 6.10), waiting for the
 * Ex-us screen to send it through the same engine. A signal, so the text never goes
 * into the URL or the browser history.
 */
export const exusHandoff = signal<string | null>(null);

export function handOverToExus(text: string): void {
  exusHandoff.value = text;
}
