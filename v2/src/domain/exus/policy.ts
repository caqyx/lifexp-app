// What happens to a typed command (docs/v2/PLAN.md 6.6, U7). A typed command is
// already the person's intent, so read and write run at once (write with
// "Cofnij"); only a destructive one asks first, with its effect spelled out.
// Missing required slots are named back with the syntax (the form card comes
// with the full UI, 6.10).
import type { Risk } from './commands';

export type Decision = 'run' | 'confirm' | 'ask-missing';

export function whatToDo(risk: Risk, missing: readonly string[]): Decision {
  if (missing.length > 0) return 'ask-missing';
  return risk === 'destructive' ? 'confirm' : 'run';
}
