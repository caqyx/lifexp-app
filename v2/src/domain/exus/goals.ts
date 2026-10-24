// Goal commands, the pure part (docs/v2/PLAN.md 6.5): which kind of goal an
// amount names, and what an amount means for a goal that already has a kind.
// A unit is what decides; a bare number is only taken where the kind is known.
import type { GoalType } from '../goals';
import type { Amount } from './recognizers';

export type AmountProblem =
  /** A new goal and a bare number: "zł" or "pkt" is needed. */
  | 'unit'
  /** "zł" for a points goal, or "pkt" for a money goal / a deposit. */
  | 'wrongUnit'
  /** A points goal takes whole points. */
  | 'notWhole';

export type Resolved<T> = ({ ok: true } & T) | { ok: false; problem: AmountProblem };

const grosze = (zloty: number) => Math.round(zloty * 100);

/** /cel: "1500 zł" → money, "5000 pkt" → points, "1500" → ask for the unit. Money in grosze. */
export function newGoalTarget(amount: Amount): Resolved<{ type: GoalType; target: number }> {
  if (amount.kind === 'money') return { ok: true, type: 'money', target: amount.grosze };
  if (amount.kind === 'points') return { ok: true, type: 'points', target: amount.points };
  return { ok: false, problem: 'unit' };
}

/** /edytuj-cel kwota=…: the goal keeps its kind, so a bare number is read in its unit. */
export function targetFor(type: GoalType, amount: Amount): Resolved<{ target: number }> {
  if (type === 'money') {
    if (amount.kind === 'points') return { ok: false, problem: 'wrongUnit' };
    return { ok: true, target: amount.kind === 'money' ? amount.grosze : grosze(amount.value) };
  }
  if (amount.kind === 'money') return { ok: false, problem: 'wrongUnit' };
  if (amount.kind === 'points') return { ok: true, target: amount.points };
  return Number.isInteger(amount.value) ? { ok: true, target: amount.value } : { ok: false, problem: 'notWhole' };
}

/** /wplac: only złoty, in grosze; "50" is 50 zł, "50 pkt" is refused. */
export function depositAmount(amount: Amount): Resolved<{ grosze: number }> {
  if (amount.kind === 'points') return { ok: false, problem: 'wrongUnit' };
  return { ok: true, grosze: amount.kind === 'money' ? amount.grosze : grosze(amount.value) };
}
