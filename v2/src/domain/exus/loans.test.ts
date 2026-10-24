import { describe, expect, it } from 'vitest';
import type { Loan } from '../loans';
import { findLoan, loanLabel, loansByPerson, openLoans } from './loans';

let n = 0;
const loan = (person: string, grosze: number, direction: Loan['direction'] = 'lent', note = '', repaid = 0): Loan => ({
  id: `l${(n += 1)}`,
  person,
  direction,
  grosze,
  repaid,
  note,
  date: '2026-10-01',
  createdAt: null,
  completedAt: null,
});

const OLA = loan('Ola', 2000, 'lent', 'na kino');
const TATA = loan('Tata', 4000, 'borrowed');
const ANIA_1 = loan('Ciocia Ania', 1000, 'lent', 'prezent');
const ANIA_2 = loan('Ciocia Ania', 500, 'lent', 'bilet');
const DONE = loan('Wojtek', 1000, 'lent', '', 1000);
const LOANS = [OLA, TATA, ANIA_1, ANIA_2, DONE];

describe('findLoan', () => {
  it('finds the open loan of a person by name, in any case and without Polish letters', () => {
    expect(findLoan('ola', LOANS)).toEqual({ kind: 'found', loan: OLA });
    expect(findLoan('TATA', LOANS)).toEqual({ kind: 'found', loan: TATA });
    expect(findLoan('olla', LOANS)).toEqual({ kind: 'found', loan: OLA });
  });

  it('a person with several open loans is ambiguous, and the note names one', () => {
    expect(findLoan('ania', LOANS)).toEqual({ kind: 'ambiguous', loans: [ANIA_1, ANIA_2] });
    expect(findLoan('ania prezent', LOANS)).toEqual({ kind: 'found', loan: ANIA_1 });
    expect(findLoan('ciocia ania, bilet', LOANS)).toEqual({ kind: 'found', loan: ANIA_2 });
  });

  it('lists the loans that fit in the order they were made, whatever order the store gives', () => {
    const early = { ...loan('Zosia', 1000, 'lent', 'kino'), createdAt: new Date(1000) };
    const late = { ...loan('Zosia', 500, 'lent', 'buty'), createdAt: new Date(2000) };
    expect(findLoan('zosia', [late, early])).toEqual({ kind: 'ambiguous', loans: [early, late] });
  });

  it('never offers a settled loan', () => {
    expect(findLoan('wojtek', LOANS)).toEqual({ kind: 'none' });
    expect(openLoans(LOANS)).toEqual([OLA, TATA, ANIA_1, ANIA_2]);
  });

  it('says when nothing fits', () => {
    expect(findLoan('latanie', LOANS)).toEqual({ kind: 'none' });
    expect(findLoan('', LOANS)).toEqual({ kind: 'none' });
    expect(findLoan('ola', [])).toEqual({ kind: 'none' });
  });
});

describe('loanLabel and loansByPerson', () => {
  it('labels a loan by person and note', () => {
    expect(loanLabel(OLA)).toBe('Ola, na kino');
    expect(loanLabel(TATA)).toBe('Tata');
  });

  it('sums what is outstanding per person and direction, the biggest first, leaving settled loans out', () => {
    const partly = loan('Ola', 3000, 'lent', 'książka', 1000);
    expect(loansByPerson([...LOANS, partly])).toEqual({
      lent: [
        { person: 'Ola', grosze: 4000 },
        { person: 'Ciocia Ania', grosze: 1500 },
      ],
      borrowed: [{ person: 'Tata', grosze: 4000 }],
    });
    expect(loansByPerson([])).toEqual({ lent: [], borrowed: [] });
  });
});
