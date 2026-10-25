// The Ex-us command registry (docs/v2/PLAN.md 6.4, 6.5): what each slash command is
// called, its Polish aliases, its slots and how risky it is. Pure: what a command
// does lives in the feature that runs it; here is only what it is and how its
// text is read. Grows a few commands per PR (stage 5a).
import { isModuleOn, type ModuleChoice, type OptionalModule } from '../modules';
import { TASK_SIZES, type TaskSize } from '../tasks';
import { fillSlots, missingSlots, tokenize, unreadNamed, type SlotDef } from './parse';
import { CHORE_DAY } from './chores';
import { amount, dateFrom, duration, fold, money, oneOf } from './recognizers';
import { LANG_WORD, limitValue, MODULE_WORD, SWITCH_WORD, THEME_FAMILY_WORD, THEME_MODE_WORD } from './settings';
import { STATS_PERIOD } from './stats';
import { TASKS_SCOPE } from './tasks';

/** read: runs at once; write: runs, with undo; destructive: asks first (6.6). */
export type Risk = 'read' | 'write' | 'destructive';

export type CommandId =
  | 'help'
  | 'today'
  | 'undo'
  | 'create-task'
  | 'complete-task'
  | 'tasks'
  | 'edit-task'
  | 'delete-task'
  | 'create-goal'
  | 'deposit-goal'
  | 'goals'
  | 'edit-goal'
  | 'delete-goal'
  | 'add-money'
  | 'remove-money'
  | 'balance'
  | 'create-category'
  | 'delete-transaction'
  | 'complete-chore'
  | 'chores'
  | 'settle-chores'
  | 'log-activity'
  | 'streak'
  | 'stats'
  | 'what-now'
  | 'create-note'
  | 'archive-note'
  | 'find-note'
  | 'daily-limit'
  | 'lang'
  | 'theme'
  | 'module'
  | 'go'
  | 'lend'
  | 'borrow'
  | 'repay'
  | 'loans'
  | 'money-limit'
  | 'create-chore'
  | 'delete-chore'
  | 'delete-chore-entry'
  | 'delete-activity'
  | 'report-bug'
  | 'new-chat';

export interface CommandSpec {
  id: CommandId;
  /** Polish shortcuts, typed without Polish letters too. */
  aliases: readonly string[];
  /** Gone while this module is off; null = always there. */
  module: OptionalModule | null;
  risk: Risk;
  /** May the AI propose this command (PLAN.md 6.4, 6.5 column "AI")? Nothing reads it before stage 5b. */
  aiExposed: boolean;
  /** Slots read from the text; dates count from `today` (local day key). */
  slots: (today: string) => SlotDef[];
}

const SIZE = oneOf<TaskSize>(Object.fromEntries(TASK_SIZES.map((s) => [s, s])) as Record<string, TaskSize>);

/** "5", "12,50", "20 zł" in grosze; a "pkt" amount is not money. */
const grosze = (token: string) => money(token)?.grosze;

/**
 * A command with a money slot reads a bare "5.10" as the amount, never as 5 October
 * (the date slot is filled first). Its dates are "dziś", a weekday, "12.10.2026",
 * "2026-10-12", "+3d". Every command with a money slot and a date slot uses this.
 */
const dateWithMoney = (today: string) => dateFrom(today, { dayMonth: false });

/** /wplyw and /wydatek read the same text: amount, day, then "category note" (domain/exus/money). */
const txSlots = (today: string): SlotDef[] => [
  { name: 'amount', type: 'money', required: true, recognize: grosze },
  { name: 'date', type: 'date', required: false, recognize: dateWithMoney(today) },
  // A category that may not exist yet: `kategoria=nazwa` creates it, as the Money sheet's "Nowa kategoria…".
  { name: 'category', type: 'text', required: false, keys: ['kategoria', 'category'], namedOnly: true },
  { name: 'rest', type: 'text', required: false },
];

export const COMMANDS: readonly CommandSpec[] = [
  {
    id: 'help',
    aliases: ['pomoc'],
    module: null,
    risk: 'read',
    aiExposed: false,
    slots: () => [{ name: 'command', type: 'text', required: false }],
  },
  {
    id: 'today',
    aliases: ['dzis'],
    module: null,
    risk: 'read',
    aiExposed: true,
    slots: () => [],
  },
  {
    // Takes back the last write of this Ex-us session (PLAN.md 6.6).
    id: 'undo',
    aliases: ['cofnij'],
    module: null,
    risk: 'write',
    aiExposed: false,
    slots: () => [],
  },
  {
    id: 'create-task',
    aliases: ['zadanie'],
    module: null,
    risk: 'write',
    aiExposed: true,
    slots: (today) => [
      { name: 'text', type: 'text', required: true },
      { name: 'due', type: 'date', required: true, recognize: dateFrom(today) },
      { name: 'size', type: 'enum', required: false, recognize: SIZE, choices: TASK_SIZES },
    ],
  },
  {
    // The task is found among the open ones by its text.
    id: 'complete-task',
    aliases: ['zrobione'],
    module: null,
    risk: 'write',
    aiExposed: true,
    slots: () => [{ name: 'task', type: 'entity', required: true }],
  },
  {
    id: 'tasks',
    aliases: ['zadania'],
    module: null,
    risk: 'read',
    aiExposed: true,
    slots: () => [{ name: 'scope', type: 'enum', required: false, recognize: TASKS_SCOPE }],
  },
  {
    // What changes is named (`termin=jutro`), so a date in the task's own words stays in its name.
    id: 'edit-task',
    aliases: ['edytuj-zadanie'],
    module: null,
    risk: 'write',
    aiExposed: true,
    slots: (today) => [
      { name: 'task', type: 'entity', required: true },
      { name: 'text', type: 'text', required: false, keys: ['tresc', 'text'], namedOnly: true },
      { name: 'due', type: 'date', required: false, recognize: dateFrom(today), keys: ['termin', 'due'], namedOnly: true },
      { name: 'size', type: 'enum', required: false, recognize: SIZE, choices: TASK_SIZES, keys: ['rozmiar', 'size'], namedOnly: true },
    ],
  },
  {
    id: 'delete-task',
    aliases: ['usun-zadanie'],
    module: null,
    risk: 'destructive',
    aiExposed: true,
    slots: () => [{ name: 'task', type: 'entity', required: true }],
  },
  {
    // The unit decides the kind: "1500 zł" a money goal, "5000 pkt" a points goal.
    id: 'create-goal',
    aliases: ['cel'],
    module: null,
    risk: 'write',
    aiExposed: true,
    slots: () => [
      { name: 'name', type: 'text', required: true },
      { name: 'target', type: 'money', required: true, recognize: amount, fromEnd: true },
    ],
  },
  {
    id: 'deposit-goal',
    aliases: ['wplac'],
    module: null,
    risk: 'write',
    aiExposed: true,
    slots: () => [
      { name: 'goal', type: 'entity', required: true },
      { name: 'amount', type: 'money', required: true, recognize: amount, fromEnd: true },
    ],
  },
  {
    id: 'goals',
    aliases: ['cele'],
    module: null,
    risk: 'read',
    aiExposed: true,
    slots: () => [],
  },
  {
    id: 'edit-goal',
    aliases: ['edytuj-cel'],
    module: null,
    risk: 'write',
    aiExposed: true,
    slots: () => [
      { name: 'goal', type: 'entity', required: true },
      { name: 'name', type: 'text', required: false, keys: ['nazwa', 'name'], namedOnly: true },
      { name: 'target', type: 'money', required: false, recognize: amount, keys: ['kwota', 'amount'], namedOnly: true },
    ],
  },
  {
    // Gives the money put aside back to the balance, so it asks first.
    id: 'delete-goal',
    aliases: ['usun-cel'],
    module: null,
    risk: 'destructive',
    aiExposed: true,
    slots: () => [{ name: 'goal', type: 'entity', required: true }],
  },
  {
    id: 'add-money',
    aliases: ['wplyw'],
    module: 'money',
    risk: 'write',
    aiExposed: true,
    slots: txSlots,
  },
  {
    id: 'remove-money',
    aliases: ['wydatek'],
    module: 'money',
    risk: 'write',
    aiExposed: true,
    slots: txSlots,
  },
  {
    id: 'balance',
    aliases: ['saldo'],
    module: 'money',
    risk: 'read',
    aiExposed: true,
    slots: () => [],
  },
  {
    id: 'create-category',
    aliases: ['kategoria'],
    module: 'money',
    risk: 'write',
    aiExposed: true,
    slots: () => [{ name: 'name', type: 'text', required: true }],
  },
  {
    // Gives the balance and the points of the transaction back, so it asks first.
    id: 'delete-transaction',
    aliases: ['usun-transakcje'],
    module: 'money',
    risk: 'destructive',
    aiExposed: true,
    slots: () => [{ name: 'ref', type: 'entity', required: false }],
  },
  {
    // The chore is found by its name; the day is "dzis" (default) or "wczoraj".
    id: 'complete-chore',
    aliases: ['obowiazek'],
    module: 'chores',
    risk: 'write',
    aiExposed: true,
    slots: () => [
      { name: 'chore', type: 'entity', required: true },
      { name: 'when', type: 'enum', required: false, recognize: CHORE_DAY, choices: ['today', 'yesterday'] },
    ],
  },
  {
    id: 'chores',
    aliases: ['obowiazki'],
    module: 'chores',
    risk: 'read',
    aiExposed: true,
    slots: () => [],
  },
  {
    // Turns the points into złoty in Money and cannot be taken back, so it asks first.
    id: 'settle-chores',
    aliases: ['rozlicz'],
    module: 'chores',
    risk: 'destructive',
    aiExposed: true,
    slots: () => [],
  },
  {
    // "type note": the type is the leading words (domain/exus/activities); the duration is read from anywhere.
    id: 'log-activity',
    aliases: ['aktywnosc'],
    module: 'stats',
    risk: 'write',
    aiExposed: true,
    slots: () => [
      { name: 'type', type: 'text', required: true },
      { name: 'duration', type: 'duration', required: true, recognize: duration },
    ],
  },
  {
    id: 'streak',
    aliases: ['seria'],
    module: 'stats',
    risk: 'read',
    aiExposed: true,
    slots: () => [],
  },
  {
    id: 'stats',
    aliases: ['statystyki'],
    module: 'stats',
    risk: 'read',
    aiExposed: true,
    slots: () => [{ name: 'period', type: 'enum', required: false, recognize: STATS_PERIOD }],
  },
  {
    // Picks, writes nothing.
    id: 'what-now',
    aliases: ['co-teraz'],
    module: 'stats',
    risk: 'read',
    aiExposed: true,
    slots: () => [{ name: 'duration', type: 'duration', required: true, recognize: duration }],
  },
  {
    // The title is the first word, or the quoted words; the rest is the content.
    id: 'create-note',
    aliases: ['notatka'],
    module: 'notes',
    risk: 'write',
    aiExposed: true,
    slots: () => [
      { name: 'title', type: 'text', required: true, leading: true, keys: ['tytul', 'title'] },
      { name: 'content', type: 'text', required: false, keys: ['tresc', 'content'] },
    ],
  },
  {
    id: 'archive-note',
    aliases: ['archiwizuj'],
    module: 'notes',
    risk: 'write',
    aiExposed: true,
    slots: () => [{ name: 'note', type: 'entity', required: true }],
  },
  {
    id: 'find-note',
    aliases: ['szukaj'],
    module: 'notes',
    risk: 'read',
    aiExposed: true,
    slots: () => [{ name: 'query', type: 'text', required: true }],
  },
  {
    id: 'daily-limit',
    aliases: ['limit'],
    module: null,
    risk: 'write',
    aiExposed: true,
    slots: () => [{ name: 'limit', type: 'number', required: true, recognize: limitValue }],
  },
  {
    id: 'lang',
    aliases: ['jezyk'],
    module: null,
    risk: 'write',
    aiExposed: false,
    slots: () => [{ name: 'lang', type: 'enum', required: true, recognize: LANG_WORD }],
  },
  {
    // A family, a mode, or both ("ios jasny"); the choice is kept on this device.
    id: 'theme',
    aliases: ['motyw'],
    module: null,
    risk: 'write',
    aiExposed: false,
    slots: () => [
      { name: 'family', type: 'enum', required: false, recognize: THEME_FAMILY_WORD },
      { name: 'mode', type: 'enum', required: false, recognize: THEME_MODE_WORD },
    ],
  },
  {
    id: 'module',
    aliases: ['modul'],
    module: null,
    risk: 'write',
    aiExposed: false,
    slots: () => [
      { name: 'module', type: 'enum', required: true, recognize: MODULE_WORD },
      { name: 'state', type: 'enum', required: true, recognize: SWITCH_WORD },
    ],
  },
  {
    // Takes the person to a screen of a module that is on.
    id: 'go',
    aliases: ['idz'],
    module: null,
    risk: 'read',
    aiExposed: true,
    slots: () => [{ name: 'screen', type: 'text', required: true }],
  },
  {
    // "person amount note": the person is the first word (quote it for several), the amount is read from anywhere.
    id: 'lend',
    aliases: ['pozyczam'],
    module: 'money',
    risk: 'write',
    aiExposed: true,
    slots: () => loanSlots(),
  },
  {
    id: 'borrow',
    aliases: ['pozyczam-od'],
    module: 'money',
    risk: 'write',
    aiExposed: true,
    slots: () => loanSlots(),
  },
  {
    // The loan is found by the person (or "person note" when there are several).
    id: 'repay',
    aliases: ['splata'],
    module: 'money',
    risk: 'write',
    aiExposed: true,
    slots: () => [
      { name: 'loan', type: 'entity', required: true },
      { name: 'amount', type: 'money', required: true, recognize: grosze, fromEnd: true },
    ],
  },
  {
    id: 'loans',
    aliases: ['pozyczki'],
    module: 'money',
    risk: 'read',
    aiExposed: true,
    slots: () => [],
  },
  {
    // 0 turns the limit off, as on the Money settings screen.
    id: 'money-limit',
    aliases: ['limit-wydatkow'],
    module: 'money',
    risk: 'write',
    aiExposed: true,
    slots: () => [{ name: 'amount', type: 'money', required: true, recognize: grosze }],
  },
  {
    // The points are the last number ("Mycie okien 2 30"), the flag makes it a one-time chore.
    id: 'create-chore',
    aliases: ['nowy-obowiazek'],
    module: 'chores',
    risk: 'write',
    aiExposed: true,
    slots: () => [
      { name: 'name', type: 'text', required: true },
      { name: 'points', type: 'number', required: true, recognize: limitValue, fromEnd: true },
      { name: 'once', type: 'enum', required: false, flags: ['jednorazowy', 'once'] },
    ],
  },
  {
    id: 'delete-chore',
    aliases: ['usun-obowiazek'],
    module: 'chores',
    risk: 'destructive',
    aiExposed: true,
    slots: () => [{ name: 'chore', type: 'entity', required: true }],
  },
  {
    // Nothing or "ostatni" = the newest unpaid entry; a name = the newest entry of that chore.
    id: 'delete-chore-entry',
    aliases: ['usun-wpis'],
    module: 'chores',
    risk: 'destructive',
    aiExposed: true,
    slots: () => [{ name: 'ref', type: 'entity', required: false }],
  },
  {
    // Nothing or "ostatnia" = the newest; a text is matched with the type and the note.
    id: 'delete-activity',
    aliases: ['usun-aktywnosc'],
    module: 'stats',
    risk: 'destructive',
    aiExposed: true,
    slots: () => [{ name: 'ref', type: 'entity', required: false }],
  },
  {
    // "title | area | description": the text as typed, split on "|" by the handler (domain/exus/reports).
    id: 'report-bug',
    aliases: ['blad'],
    module: null,
    risk: 'write',
    aiExposed: true,
    slots: () => [{ name: 'report', type: 'text', required: true, raw: true }],
  },
  {
    // Starts a new conversation: the chat and its undo stack are emptied.
    id: 'new-chat',
    aliases: ['nowy'],
    module: null,
    risk: 'read',
    aiExposed: false,
    slots: () => [],
  },
];

/** /pozyczam and /pozyczam-od read the same text: the person, the amount, then the note. */
function loanSlots(): SlotDef[] {
  return [
    { name: 'amount', type: 'money', required: true, recognize: grosze },
    { name: 'person', type: 'text', required: true, leading: true },
    { name: 'note', type: 'text', required: false },
  ];
}

/** The commands of the modules that are on. */
export function availableCommands(choice: ModuleChoice, all: readonly CommandSpec[] = COMMANDS): CommandSpec[] {
  return all.filter((c) => c.module === null || isModuleOn(c.module, choice));
}

/** By id or alias, in any case, with or without Polish letters. */
export function findCommand(name: string, commands: readonly CommandSpec[]): CommandSpec | null {
  const key = fold(name);
  return commands.find((c) => fold(c.id) === key || c.aliases.some((a) => fold(a) === key)) ?? null;
}

export type Parsed =
  | { kind: 'text'; text: string }
  | { kind: 'unknown'; name: string }
  | {
      kind: 'command';
      spec: CommandSpec;
      args: Record<string, unknown>;
      missing: string[];
      /** Slots whose `key=value` was written but could not be read. */
      unread: string[];
    };

/** What the person typed: plain text (for the AI, stage 5b), an unknown command, or a command with its slots. */
export function parseInput(input: string, today: string, commands: readonly CommandSpec[]): Parsed {
  const tokenized = tokenize(input);
  if (tokenized.command === null) return { kind: 'text', text: input.trim() };
  const spec = findCommand(tokenized.command, commands);
  if (!spec) return { kind: 'unknown', name: tokenized.command };
  const slots = spec.slots(today);
  const rest = input.trim().replace(/^\/\S*\s*/, '');
  const args = fillSlots(tokenized.tokens, slots, tokenized.named, { flags: tokenized.flags, rest });
  return { kind: 'command', spec, args, missing: missingSlots(slots, args), unread: unreadNamed(slots, tokenized.named, args) };
}

export interface Palette {
  /** Commands for the name being typed: names starting with it first, then names containing it. */
  suggestions: CommandSpec[];
  /** The command whose name is complete (a space follows it): its syntax shows under the field. */
  current: CommandSpec | null;
}

/** The command palette for what is in the field (PLAN.md 6.3): only while it starts with "/". */
export function palette(draft: string, commands: readonly CommandSpec[]): Palette {
  const m = /^\s*\/(\S*)(\s?)/.exec(draft);
  if (!m) return { suggestions: [], current: null };
  if (m[2]) return { suggestions: [], current: findCommand(m[1]!, commands) };
  const typed = fold(m[1]!);
  const names = (c: CommandSpec) => [c.id, ...c.aliases].map(fold);
  const starts = commands.filter((c) => names(c).some((n) => n.startsWith(typed)));
  const contains = commands.filter((c) => !starts.includes(c) && names(c).some((n) => n.includes(typed)));
  return { suggestions: [...starts, ...contains], current: null };
}
