// What happens to a typed command (docs/v2/PLAN.md 6.6, U7). A typed command is
// already the person's intent, so read and write run at once (write with
// "Cofnij"); only a destructive one asks first, with its effect spelled out.
// A write or destructive command with missing required slots gets a form card
// (6.6, row 2); a read one has them named back with the syntax.
import type { CommandId, Risk } from './commands';

export type Decision = 'run' | 'confirm' | 'ask-missing' | 'form';

export function whatToDo(risk: Risk, missing: readonly string[]): Decision {
  if (missing.length > 0) return risk === 'read' ? 'ask-missing' : 'form';
  return risk === 'destructive' ? 'confirm' : 'run';
}

/**
 * Commands whose services are server transactions (the screens await them and fail offline):
 * offline they answer "needs the internet". The others are single writes that Firestore queues
 * while offline, exactly as the screens' do. Activities and transactions are drafts on the
 * Today and Money screens (stage 3f); Ex-us keeps no drafts, so it asks for a connection instead.
 */
export const NEEDS_SERVER: ReadonlySet<CommandId> = new Set<CommandId>([
  'create-goal',
  'deposit-goal',
  'edit-goal',
  'delete-goal',
  'complete-task',
  'add-money',
  'remove-money',
  'delete-transaction',
  'lend',
  'borrow',
  'repay',
  'settle-chores',
  'log-activity',
  'delete-activity',
]);

export const needsInternet = (id: CommandId): boolean => NEEDS_SERVER.has(id);
