// What happens to a typed command (docs/v2/PLAN.md 6.6, U7). A typed command is
// already the person's intent, so read and write run at once (write with
// "Cofnij"); only a destructive one asks first, with its effect spelled out.
// A write or destructive command with missing required slots gets a form card
// (6.6, row 2); a read one has them named back with the syntax.
import type { Risk } from './commands';

export type Decision = 'run' | 'confirm' | 'ask-missing' | 'form';

export function whatToDo(risk: Risk, missing: readonly string[]): Decision {
  if (missing.length > 0) return risk === 'read' ? 'ask-missing' : 'form';
  return risk === 'destructive' ? 'confirm' : 'run';
}
