// The bug-report command, the pure part (docs/v2/PLAN.md 6.5, "Zgłoszenia"): "/blad Saldo | Pieniądze
// | Saldo nie działa po wypłacie" is cut on "|" into a title, an area and a description, and the
// area is found by its name on the Reports screen. Nothing here reads a store.
import type { BugArea } from '../reports';
import { matchEntity } from './entities';
import { fold } from './recognizers';

export type BugParts =
  | { ok: true; title: string; area: string; description: string }
  /** Fewer than three parts, or one of them empty. */
  | { ok: false };

/** The first two "|" cut the title and the area; whatever follows (even more "|") is the description. */
export function splitBugReport(text: string): BugParts {
  const first = text.indexOf('|');
  const second = first < 0 ? -1 : text.indexOf('|', first + 1);
  if (second < 0) return { ok: false };
  const title = text.slice(0, first).trim();
  const area = text.slice(first + 1, second).trim();
  const description = text.slice(second + 1).trim();
  return title && area && description ? { ok: true, title, area, description } : { ok: false };
}

export interface AreaName {
  id: BugArea;
  /** As the Reports screen shows it ("Pieniądze"). */
  name: string;
}

export type AreaMatch = { kind: 'found'; id: BugArea } | { kind: 'ambiguous'; names: string[] } | { kind: 'none' };

/**
 * The area a text names: its label or its id ("money"), in any case and without Polish
 * letters; otherwise the start or a part of a label, like a goal name.
 */
export function findArea(text: string, areas: readonly AreaName[]): AreaMatch {
  const key = fold(text).trim();
  const exact = areas.find((a) => fold(a.name) === key || a.id === key);
  if (exact) return { kind: 'found', id: exact.id };
  const match = matchEntity(
    text,
    areas.map((a) => ({ id: a.id, name: a.name })),
  );
  if (match.kind === 'found') return { kind: 'found', id: match.item.id as BugArea };
  if (match.kind === 'ambiguous') return { kind: 'ambiguous', names: match.items.map((a) => a.name) };
  return { kind: 'none' };
}
