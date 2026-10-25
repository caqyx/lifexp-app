// Activity commands, the pure part (docs/v2/PLAN.md 6.5, "XP / aktywności"): which
// words of "/aktywnosc nauka 60 rozdział 3" name the type and which are the note,
// and what "Co teraz?" would give. The caller gives the definitions; nothing here
// reads a store.
import {
  ACTIVITY_MIN_MINUTES,
  activityName,
  creditActivity,
  pickActivity,
  type ActivityCredit,
  type Activity,
  type ActivityDef,
  type GeneratorPick,
} from '../activity';
import { matchEntity } from './entities';
import { fold } from './recognizers';

export type TypeWords =
  /** The definition, and whatever is left as the note. */
  | { kind: 'found'; def: ActivityDef; desc: string }
  /** The first word fits several types: the caller lists them. */
  | { kind: 'ambiguous'; names: string[] }
  | { kind: 'none' };

const squeeze = (words: readonly string[]) => fold(words.join(' ')).trim();

/**
 * The words after the duration was taken out, e.g. "nauka rozdział 3". Rules, the
 * first with a hit decides:
 * 1. the longest run of leading words that is exactly a type's name ("praca nad
 *    projektem szkic" → that type, note "szkic");
 * 2. the first word, by the same matching as goals (name starts with it, contains
 *    it, or is a typo away): "nauka" → "Nauka (JS, Unity, C#)", the rest is the note.
 */
export function splitTypeDesc(words: readonly string[], defs: readonly ActivityDef[]): TypeWords {
  const names = new Map(defs.map((d) => [fold(d.name).trim().replace(/\s+/g, ' '), d]));
  for (let length = words.length; length >= 1; length--) {
    const def = names.get(squeeze(words.slice(0, length)).replace(/\s+/g, ' '));
    if (def) return { kind: 'found', def, desc: words.slice(length).join(' ') };
  }
  const first = words[0];
  if (first === undefined) return { kind: 'none' };
  const match = matchEntity(first, defs);
  if (match.kind === 'found') return { kind: 'found', def: match.item, desc: words.slice(1).join(' ') };
  if (match.kind === 'ambiguous') return { kind: 'ambiguous', names: match.items.map((d) => d.name) };
  return { kind: 'none' };
}

export interface WhatNow {
  pick: GeneratorPick;
  credit: ActivityCredit;
}

/** "Co teraz?" for a length of time: one pick from the generator's pool and what it would credit today. */
export function whatNow(
  pool: readonly GeneratorPick[],
  minutes: number,
  earnedToday: number,
  dailyLimit: number | null,
  random: () => number = Math.random,
): WhatNow | null {
  if (minutes < ACTIVITY_MIN_MINUTES) return null;
  const pick = pickActivity(pool, random);
  return pick ? { pick, credit: creditActivity(minutes, pick.points, earnedToday, dailyLimit) } : null;
}

export type ActivityMatch =
  | { kind: 'found'; activity: Activity }
  /** Several fit: the caller lists them, newest first. */
  | { kind: 'ambiguous'; activities: Activity[] }
  | { kind: 'none' };

/** Words that mean "the newest one". */
const LAST = new Set(['ostatnia', 'ostatni', 'ostatnie', 'last', 'latest']);

/** The type's name, then the note: what a text is matched with ("nauka rozdział 3"). */
export const activityLabel = (activity: Activity, names: ReadonlyMap<string, string>): string =>
  `${activityName(activity, names)} ${activity.desc}`.trim();

/**
 * The activity "/usun-aktywnosc" means among the newest ones: nothing or "ostatnia" is the
 * newest; any other text is matched with "type note" like a goal name (several fits are
 * listed, not guessed).
 */
export function findActivity(ref: string | undefined, activities: readonly Activity[], names: ReadonlyMap<string, string>): ActivityMatch {
  const sorted = [...activities].sort((a, b) => b.at.getTime() - a.at.getTime());
  const text = ref?.trim() ?? '';
  if (!text || LAST.has(fold(text))) return sorted[0] ? { kind: 'found', activity: sorted[0] } : { kind: 'none' };
  const match = matchEntity(
    text,
    sorted.map((activity) => ({ id: activity.id, name: activityLabel(activity, names), activity })),
  );
  if (match.kind === 'found') return { kind: 'found', activity: match.item.activity };
  if (match.kind === 'ambiguous') return { kind: 'ambiguous', activities: match.items.map((i) => i.activity) };
  return { kind: 'none' };
}
