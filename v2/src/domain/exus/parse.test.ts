import { describe, expect, it } from 'vitest';
import { fillSlots, missingSlots, tokenize, unreadNamed, type SlotDef } from './parse';
import { amount, dateFrom, duration, fold, integer, money, oneOf, points } from './recognizers';

describe('tokenize', () => {
  it.each([
    ['/zadanie Kupić mleko jutro M', { command: 'zadanie', tokens: ['Kupić', 'mleko', 'jutro', 'M'], named: {}, flags: [] }],
    ['/cel "Nowy rower" 1 500 zł', { command: 'cel', tokens: ['Nowy rower', '1500zł'], named: {}, flags: [] }],
    ['/cel „Nowy rower” 5000 pkt', { command: 'cel', tokens: ['Nowy rower', '5000pkt'], named: {}, flags: [] }],
    ['/wydatek 12,50 zł jedzenie', { command: 'wydatek', tokens: ['12,50zł', 'jedzenie'], named: {}, flags: [] }],
    ['/edytuj-zadanie t3 termin=pt treść="Kupić chleb"', { command: 'edytuj-zadanie', tokens: ['t3'], named: { termin: 'pt', treść: 'Kupić chleb' }, flags: [] }],
    ['/nowy-obowiazek Okna 30 --jednorazowy', { command: 'nowy-obowiazek', tokens: ['Okna', '30'], named: {}, flags: ['jednorazowy'] }],
    ['odłóż 50 zł na rower', { command: null, tokens: ['odłóż', '50zł', 'na', 'rower'], named: {}, flags: [] }],
    ['  /POMOC  ', { command: 'pomoc', tokens: [], named: {}, flags: [] }],
  ])('%s', (input, expected) => {
    expect(tokenize(input)).toEqual(expected);
  });

  it('keeps a thousands group apart when no unit follows (it may be two numbers)', () => {
    expect(tokenize('/x 2 500').tokens).toEqual(['2', '500']);
  });
});

describe('recognizers', () => {
  it('fold drops case and Polish letters', () => {
    expect(fold('Środa ŁÓDŹ')).toBe('sroda lodz');
  });

  it.each([
    ['12', { grosze: 1200, unit: false }],
    ['12,5', { grosze: 1250, unit: false }],
    ['12.50zł', { grosze: 1250, unit: true }],
    ['1500PLN', { grosze: 150000, unit: true }],
    ['12,555', undefined],
    ['500pkt', undefined],
    ['mleko', undefined],
  ])('money %s', (token, expected) => expect(money(token)).toEqual(expected));

  it.each([
    ['500pkt', 500],
    ['500', undefined],
  ])('points %s', (token, expected) => expect(points(token)).toEqual(expected));

  it.each([
    ['1500zł', { kind: 'money', grosze: 150000 }],
    ['5000pkt', { kind: 'points', points: 5000 }],
    ['300', { kind: 'unknown', value: 300 }],
  ])('a goal amount %s', (token, expected) => expect(amount(token)).toEqual(expected));

  it.each([
    ['90', 90],
    ['90m', 90],
    ['45min', 45],
    ['1h', 60],
    ['1,5h', 90],
    ['1.25h', 75],
    ['1h30', 90],
    ['2h15m', 135],
    ['1h75', undefined],
    ['0', undefined],
    ['jutro', undefined],
  ])('duration %s', (token, expected) => expect(duration(token)).toBe(expected));

  it('integer takes whole numbers only', () => {
    expect(integer('15')).toBe(15);
    expect(integer('1,5')).toBeUndefined();
  });

  // 2026-10-09 is a Friday.
  const date = dateFrom('2026-10-09');
  it.each([
    ['dziś', '2026-10-09'],
    ['Jutro', '2026-10-10'],
    ['pojutrze', '2026-10-11'],
    ['wczoraj', '2026-10-08'],
    ['pt', '2026-10-09'],
    ['pn', '2026-10-12'],
    ['środa', '2026-10-14'],
    ['nd', '2026-10-11'],
    ['12.10', '2026-10-12'],
    ['1.1.2027', '2027-01-01'],
    ['2026-10-31', '2026-10-31'],
    ['+3d', '2026-10-12'],
    ['+2t', '2026-10-23'],
    ['31.02', undefined],
    ['2026-13-01', undefined],
    ['M', undefined],
  ])('date %s', (token, expected) => expect(date(token)).toBe(expected));

  it('leaves out the short day-month when asked, and keeps every other form', () => {
    const noShort = dateFrom('2026-10-09', { dayMonth: false });
    for (const token of ['12.10', '5.1', '31.12']) expect(noShort(token), token).toBeUndefined();
    for (const [token, expected] of [['12.10.2026', '2026-10-12'], ['2026-10-12', '2026-10-12'], ['+3d', '2026-10-12'], ['wczoraj', '2026-10-08'], ['pt', '2026-10-09']]) {
      expect(noShort(token!), token).toBe(expected);
    }
  });

  it('oneOf matches in any case, with or without Polish letters', () => {
    const when = oneOf({ dziś: 'today', wczoraj: 'yesterday' });
    expect(when('DZIS')).toBe('today');
    expect(when('Wczoraj')).toBe('yesterday');
    expect(when('jutro')).toBeUndefined();
  });
});

describe('fillSlots', () => {
  const size = oneOf({ s: 'S', m: 'M', l: 'L' });
  const task: SlotDef[] = [
    { name: 'text', type: 'text', required: true },
    { name: 'due', type: 'date', required: true, recognize: dateFrom('2026-10-09') },
    { name: 'size', type: 'enum', required: false, recognize: size },
  ];

  it.each([
    ['Kupić mleko jutro M', { text: 'Kupić mleko', due: '2026-10-10', size: 'M' }],
    ['M jutro Kupić mleko', { text: 'Kupić mleko', due: '2026-10-10', size: 'M' }],
    ['jutro Wypracowanie z polskiego', { text: 'Wypracowanie z polskiego', due: '2026-10-10' }],
    ['Kupić mleko', { text: 'Kupić mleko' }],
  ])('a task: %s', (input, expected) => {
    expect(fillSlots(tokenize(input).tokens, task)).toEqual(expected);
  });

  it('the first matching token wins; a second one stays in the text', () => {
    expect(fillSlots(['jutro', 'albo', 'pt'], task)).toEqual({ due: '2026-10-10', text: 'albo pt' });
  });

  it('a duration takes the number before an amount could', () => {
    const activity: SlotDef[] = [
      { name: 'type', type: 'text', required: true },
      { name: 'minutes', type: 'duration', required: true, recognize: duration },
    ];
    expect(fillSlots(['Nauka', '90'], activity)).toEqual({ type: 'Nauka', minutes: 90 });
  });

  it('names the required slots that are missing', () => {
    expect(missingSlots(task, { text: 'Kupić mleko' })).toEqual(['due']);
    expect(missingSlots(task, { text: 'x', due: '2026-10-10' })).toEqual([]);
  });

  describe('an entity and an amount', () => {
    const deposit: SlotDef[] = [
      { name: 'goal', type: 'entity', required: true },
      { name: 'amount', type: 'money', required: true, recognize: amount, fromEnd: true },
    ];

    it.each([
      ['Rower 50', { goal: 'Rower', amount: { kind: 'unknown', value: 50 } }],
      ['50 zł Rower', { goal: 'Rower', amount: { kind: 'money', grosze: 5000 } }],
      ['"Nowy rower" 20,5zł', { goal: 'Nowy rower', amount: { kind: 'money', grosze: 2050 } }],
      ['Nowy rower 1 000 zł', { goal: 'Nowy rower', amount: { kind: 'money', grosze: 100000 } }],
      // a number inside the name stays there: the amount is read from the end
      ['Rower 2 50 zł', { goal: 'Rower 2', amount: { kind: 'money', grosze: 5000 } }],
      ['Rower 50 pkt', { goal: 'Rower', amount: { kind: 'points', points: 50 } }],
      ['Rower', { goal: 'Rower' }],
    ])('%s', (input, expected) => {
      expect(fillSlots(tokenize(input).tokens, deposit)).toEqual(expected);
    });
  });

  describe('key=value', () => {
    const edit: SlotDef[] = [
      { name: 'goal', type: 'entity', required: true },
      { name: 'name', type: 'text', required: false, keys: ['nazwa', 'name'], namedOnly: true },
      { name: 'target', type: 'money', required: false, recognize: amount, keys: ['kwota'], namedOnly: true },
    ];
    const fill = (input: string) => {
      const { tokens, named } = tokenize(input);
      const args = fillSlots(tokens, edit, named);
      return { args, unread: unreadNamed(edit, named, args) };
    };

    it('fills named slots and leaves the loose words to the entity', () => {
      expect(fill('/x Rower nazwa="Nowy rower" kwota=2000zł').args).toEqual({
        goal: 'Rower',
        name: 'Nowy rower',
        target: { kind: 'money', grosze: 200000 },
      });
      expect(fill('/x Rower Kwota=300').args).toEqual({ goal: 'Rower', target: { kind: 'unknown', value: 300 } });
      expect(fill('/x nazwa=Auto stary rower').args).toEqual({ goal: 'stary rower', name: 'Auto' });
    });

    it('a loose amount never fills a named-only slot', () => {
      expect(fill('/x Rower 300').args).toEqual({ goal: 'Rower 300' });
    });

    it('reports a value it cannot read', () => {
      expect(fill('/x Rower kwota=abc')).toEqual({ args: { goal: 'Rower' }, unread: ['target'] });
      expect(fill('/x Rower nazwa=')).toEqual({ args: { goal: 'Rower' }, unread: ['name'] });
      expect(fill('/x Rower').unread).toEqual([]);
    });
  });
});
