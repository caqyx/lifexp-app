// How a command is written in the chat: its name and its arguments.
import type { CommandId, CommandSpec } from '@/domain/exus/commands';
import { language, t } from '@/i18n';

/** The command's name; the Polish alias, or the id in English. */
export function commandName(spec: CommandSpec): string {
  return language.value === 'en' ? spec.id : (spec.aliases[0] ?? spec.id);
}

/** The commands that take arguments have `exus.args.<id>`. */
type WithArgs = Exclude<CommandId, 'today' | 'undo' | 'goals'>;

export function syntax(spec: CommandSpec): string {
  const name = commandName(spec);
  if (spec.slots('').length === 0) return `/${name}`;
  return `/${name} ${t(`exus.args.${spec.id as WithArgs}`)}`;
}
