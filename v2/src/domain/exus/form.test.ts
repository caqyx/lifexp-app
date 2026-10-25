import { describe, expect, it } from 'vitest';
import { COMMANDS, parseInput } from './commands';
import { fieldsFor, initialValues, readForm, type FieldKind } from './form';

const TODAY = '2026-10-09';
const slotsOf = (id: string) => COMMANDS.find((c) => c.id === id)!.slots(TODAY);
const kinds = (id: string) => fieldsFor(slotsOf(id))?.map((f) => f.kind);

describe('the control of each slot', () => {
  it.each<[string, FieldKind[] | undefined]>([
    ['create-task', ['text', 'date', 'choice']],
    ['add-money', ['money', 'date', 'text', 'text']],
    ['lend', ['money', 'text', 'text']],
    ['create-goal', ['text', 'amount']],
    ['deposit-goal', ['text', 'amount']],
    ['log-activity', ['text', 'number']],
    ['create-chore', ['text', 'number', 'flag']],
    ['complete-chore', ['text', 'choice']],
    ['report-bug', ['textarea']],
    ['daily-limit', ['number']],
    // an enum without listed choices (languages, modules) has no control: the reply names what is missing
    ['lang', undefined],
    ['module', undefined],
  ])('%s', (id, expected) => {
    expect(kinds(id)).toEqual(expected);
  });

  it('every write or destructive command has a card or says so (null)', () => {
    for (const spec of COMMANDS.filter((c) => c.risk !== 'read')) {
      const fields = fieldsFor(spec.slots(TODAY));
      if (fields) expect(fields.length, spec.id).toBe(spec.slots(TODAY).length);
    }
  });
});

describe('what the card starts with', () => {
  const start = (input: string) => {
    const parsed = parseInput(input, TODAY, COMMANDS);
    if (parsed.kind !== 'command') throw new Error(input);
    const fields = fieldsFor(parsed.spec.slots(TODAY))!;
    return { fields, raw: initialValues(fields, parsed.args), missing: parsed.missing };
  };

  it('is what was parsed, the missing ones empty', () => {
    const { raw, missing } = start('/zadanie Kupić mleko L');
    expect(raw).toEqual({ text: 'Kupić mleko', due: '', size: 'L' });
    expect(missing).toEqual(['due']);
  });

  it('shows an amount as it is typed, and a flag as a flag', () => {
    expect(start('/cel Rower 1500 zł').raw).toEqual({ name: 'Rower', target: '1500,00 zł' });
    expect(start('/cel Rower 5000 pkt').raw.target).toBe('5000 pkt');
    expect(start('/wydatek 12,5 gry').raw).toMatchObject({ amount: 1250 });
    expect(start('/nowy-obowiazek Okna --jednorazowy').raw).toEqual({ name: 'Okna', points: null, once: true });
  });
});

describe('reading the card', () => {
  const read = (id: string, raw: Parameters<typeof readForm>[1]) => readForm(fieldsFor(slotsOf(id))!, raw);

  it('a complete card gives the arguments the typed command would have', () => {
    const typed = parseInput('/zadanie Kupić mleko jutro L', TODAY, COMMANDS);
    const card = read('create-task', { text: ' Kupić mleko ', due: '2026-10-10', size: 'L' });
    expect(card.errors).toEqual({});
    expect(typed.kind === 'command' && typed.args).toEqual(card.args);
  });

  it('names the required fields that are empty, and leaves the optional ones out', () => {
    expect(read('create-task', { text: '', due: '', size: '' })).toEqual({ args: {}, errors: { text: 'required', due: 'required' } });
    expect(read('create-task', { text: 'a', due: '2026-10-10', size: '' })).toEqual({ args: { text: 'a', due: '2026-10-10' }, errors: {} });
  });

  it('refuses what the slot’s own recognizer refuses', () => {
    expect(read('create-task', { text: 'a', due: '2026-02-31', size: '' }).errors).toEqual({ due: 'invalid' });
    expect(read('create-task', { text: 'a', due: '2026-10-10', size: 'XL' }).errors).toEqual({ size: 'invalid' });
    expect(read('create-goal', { name: 'Rower', target: 'dużo' }).errors).toEqual({ target: 'invalid' });
    expect(read('log-activity', { type: 'Nauka', duration: 0 }).errors).toEqual({ duration: 'invalid' });
  });

  it('reads an amount with its unit, a money field in grosze, a number and a flag', () => {
    expect(read('create-goal', { name: 'Rower', target: '1 500 zł' }).args).toEqual({ name: 'Rower', target: { kind: 'money', grosze: 150000 } });
    expect(read('create-goal', { name: 'Rower', target: '5000 pkt' }).args.target).toEqual({ kind: 'points', points: 5000 });
    expect(read('lend', { amount: 2000, person: 'Ola', note: '' })).toEqual({ args: { amount: 2000, person: 'Ola' }, errors: {} });
    expect(read('lend', { amount: null, person: 'Ola', note: '' }).errors).toEqual({ amount: 'required' });
    expect(read('create-chore', { name: 'Okna', points: 30, once: true }).args).toEqual({ name: 'Okna', points: 30, once: true });
    expect(read('create-chore', { name: 'Okna', points: 30, once: false }).args).toEqual({ name: 'Okna', points: 30 });
    expect(read('report-bug', { report: ' A | B | C ' }).args).toEqual({ report: 'A | B | C' });
  });
});
