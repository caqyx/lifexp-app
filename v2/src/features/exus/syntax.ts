// How a command is written in the chat: its name and its arguments.
import type { CommandSpec } from '@/domain/exus/commands';
import { language, t } from '@/i18n';

/** The command's name; the Polish alias, or the id in English. */
export function commandName(spec: CommandSpec): string {
  return language.value === 'en' ? spec.id : (spec.aliases[0] ?? spec.id);
}

export function syntax(spec: CommandSpec): string {
  const name = commandName(spec);
  if (spec.id === 'today' || spec.id === 'undo') return `/${name}`;
  return `/${name} ${t(`exus.args.${spec.id}`)}`;
}
