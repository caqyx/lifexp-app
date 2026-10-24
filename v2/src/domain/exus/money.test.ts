import { describe, expect, it } from 'vitest';
import type { MoneyCategory, MoneyTx } from '../money';
import { findTransaction, lastTransaction, splitCategoryNote } from './money';

const cat = (name: string): MoneyCategory => ({ id: name, name, color: '#000' });
const CATEGORIES = ['kieszonkowe', 'gry', 'jedzenie', 'szkoła', 'kieszonkowe dodatkowe', 'Inne'].map(cat);

describe('splitCategoryNote', () => {
  const split = (text: string) => splitCategoryNote(text.split(/\s+/).filter(Boolean), CATEGORIES);

  it.each([
    ['jedzenie obiad', 'jedzenie', 'obiad'],
    ['JEDZENIE', 'jedzenie', ''],
    ['obiad jedzenie', 'jedzenie', 'obiad'],
    ['szkola zeszyt', 'szkoła', 'zeszyt'],
    ['kieszonkowe dodatkowe od babci', 'kieszonkowe dodatkowe', 'od babci'],
    ['od babci kieszonkowe', 'kieszonkowe', 'od babci'],
    ['inne', 'Inne', ''],
    ['jedz obiad', 'jedzenie', 'obiad'],
    ['gre w piłkę', 'gry', 'w piłkę'],
  ])('%s → %s / "%s"', (text, category, note) => {
    expect(split(text)).toEqual({ kind: 'found', category, note });
  });

  it.each([['obiad w szkole'], ['w'], ['xx obiad'], ['']])('"%s" names no category', (text) => {
    expect(split(text)).toEqual({ kind: 'none', note: text });
  });

  it('lists the categories a first word fits when several do', () => {
    expect(split('kie')).toEqual({ kind: 'ambiguous', names: ['kieszonkowe', 'kieszonkowe dodatkowe'] });
  });

  it('has nothing to find in an account without categories', () => {
    expect(splitCategoryNote(['obiad'], [])).toEqual({ kind: 'none', note: 'obiad' });
  });
});

const tx = (id: string, category: string, note: string, date: string, created: number | null): MoneyTx => ({
  id,
  type: 'expense',
  grosze: 500,
  category,
  note,
  date,
  source: 'manual',
  pointsCost: 0,
  createdAt: created === null ? null : new Date(created),
});

describe('lastTransaction / findTransaction', () => {
  const txs = [
    tx('a', 'jedzenie', 'obiad', '2026-10-24', 1000),
    tx('b', 'gry', 'skin', '2026-10-01', 3000),
    tx('c', 'jedzenie', 'kolacja', '2026-10-20', 2000),
  ];

  it('the newest is the last entered, not the latest day', () => {
    expect(lastTransaction(txs)?.id).toBe('b');
    expect(lastTransaction([])).toBeNull();
  });

  it('a write the server has not confirmed yet counts as newest', () => {
    expect(lastTransaction([...txs, tx('d', 'gry', '', '2026-10-02', null)])?.id).toBe('d');
  });

  it('no text or "ostatnia" means the newest', () => {
    expect(findTransaction(undefined, txs)).toMatchObject({ kind: 'found', tx: { id: 'b' } });
    expect(findTransaction('Ostatnia', txs)).toMatchObject({ kind: 'found', tx: { id: 'b' } });
    expect(findTransaction(undefined, [])).toEqual({ kind: 'none' });
  });

  it('other text names a transaction by its category and note', () => {
    expect(findTransaction('kolacja', txs)).toMatchObject({ kind: 'found', tx: { id: 'c' } });
    expect(findTransaction('skin', txs)).toMatchObject({ kind: 'found', tx: { id: 'b' } });
    expect(findTransaction('jedzenie', txs)).toMatchObject({ kind: 'ambiguous' });
    expect(findTransaction('podróż', txs)).toEqual({ kind: 'none' });
  });
});
