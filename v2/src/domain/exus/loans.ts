// Loan commands, the pure part (docs/v2/PLAN.md 6.5, "Money"): which loan "/splata Ola 10"
// means and what "/pozyczki" says. The caller gives the loans it has; nothing here
// reads a store.
import { isSettled, outstanding, sortLoans, type Loan, type LoanDirection } from '../loans';
import { matchEntity } from './entities';

export type LoanMatch =
  | { kind: 'found'; loan: Loan }
  /** Several open loans fit (one person with two loans, or two people): the caller lists them. */
  | { kind: 'ambiguous'; loans: Loan[] }
  | { kind: 'none' };

/** The loans still to be repaid, in the order they were made (a settled one has nothing left to repay). */
export const openLoans = (loans: readonly Loan[]): Loan[] => sortLoans(loans.filter((l) => !isSettled(l)));

/** What a loan is called when several fit: "Ola, na kino". */
export const loanLabel = (loan: Pick<Loan, 'person' | 'note'>): string => (loan.note ? `${loan.person}, ${loan.note}` : loan.person);

/**
 * The open loan a text names. Steps, the first with a hit decides:
 * 1. the person (matched like a goal name: exact, start, part, a typo away); a person with
 *    one open loan is that loan, a person with several is ambiguous;
 * 2. the text against "person note", so "ola kino" picks one of Ola's loans by its note.
 */
export function findLoan(text: string, loans: readonly Loan[]): LoanMatch {
  const open = openLoans(loans);
  const people = [...new Set(open.map((l) => l.person))].map((person) => ({ id: person, name: person }));
  const byPerson = matchEntity(text, people);
  if (byPerson.kind !== 'none') {
    const names = new Set(byPerson.kind === 'found' ? [byPerson.item.name] : byPerson.items.map((p) => p.name));
    const theirs = open.filter((l) => names.has(l.person));
    return theirs.length === 1 ? { kind: 'found', loan: theirs[0]! } : { kind: 'ambiguous', loans: theirs };
  }
  const byNote = matchEntity(
    text,
    open.map((loan) => ({ id: loan.id, name: loanLabel(loan), loan })),
  );
  if (byNote.kind === 'found') return { kind: 'found', loan: byNote.item.loan };
  if (byNote.kind === 'ambiguous') return { kind: 'ambiguous', loans: byNote.items.map((i) => i.loan) };
  return { kind: 'none' };
}

export interface PersonTotal {
  person: string;
  /** Grosze still outstanding on this person's open loans in this direction. */
  grosze: number;
}

/** What is owed to the person and by them, per person (the biggest first): "/pozyczki". */
export function loansByPerson(loans: readonly Loan[]): Record<LoanDirection, PersonTotal[]> {
  const sums: Record<LoanDirection, Map<string, number>> = { lent: new Map(), borrowed: new Map() };
  for (const loan of openLoans(loans)) {
    sums[loan.direction].set(loan.person, (sums[loan.direction].get(loan.person) ?? 0) + outstanding(loan));
  }
  const rows = (map: Map<string, number>) =>
    [...map].map(([person, grosze]) => ({ person, grosze })).sort((a, b) => b.grosze - a.grosze || a.person.localeCompare(b.person));
  return { lent: rows(sums.lent), borrowed: rows(sums.borrowed) };
}
