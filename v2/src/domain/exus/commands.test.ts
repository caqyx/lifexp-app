import { describe, expect, it } from 'vitest';
import { availableCommands, COMMANDS, findCommand, palette, parseInput, type CommandSpec } from './commands';

const TODAY = '2026-10-09';

describe('the registry', () => {
  it('has unique ids and aliases', () => {
    const names = COMMANDS.flatMap((c) => [c.id, ...c.aliases]);
    expect(new Set(names).size).toBe(names.length);
  });

  it('finds a command by id or alias, in any case and without Polish letters', () => {
    expect(findCommand('ZADANIE', COMMANDS)?.id).toBe('create-task');
    expect(findCommand('create-task', COMMANDS)?.id).toBe('create-task');
    expect(findCommand('dziś', COMMANDS)?.id).toBe('today');
    expect(findCommand('nic', COMMANDS)).toBeNull();
  });

  it("leaves out a module's commands while it is off", () => {
    const money: CommandSpec = { id: 'today', aliases: ['saldo'], module: 'money', risk: 'read', slots: () => [] };
    expect(availableCommands({ enabledModules: ['chores'], disabledModules: ['money'] }, [money])).toEqual([]);
    expect(availableCommands({ enabledModules: null, disabledModules: null }, [money])).toEqual([money]);
  });
});

describe('parseInput', () => {
  it('passes plain text on (for the AI)', () => {
    expect(parseInput('  odłóż 50 zł  ', TODAY, COMMANDS)).toEqual({ kind: 'text', text: 'odłóż 50 zł' });
  });

  it('names a command it does not know', () => {
    expect(parseInput('/latanie', TODAY, COMMANDS)).toEqual({ kind: 'unknown', name: 'latanie' });
  });

  it.each([
    ['/zadanie Kupić mleko jutro M', { text: 'Kupić mleko', due: '2026-10-10', size: 'M' }, []],
    ['/zadanie l pt Wypracowanie', { text: 'Wypracowanie', due: '2026-10-09', size: 'L' }, []],
    ['/zadanie Kupić mleko', { text: 'Kupić mleko' }, ['due']],
    ['/zadanie', {}, ['text', 'due']],
  ])('%s', (input, args, missing) => {
    const parsed = parseInput(input, TODAY, COMMANDS);
    expect(parsed).toMatchObject({ kind: 'command', args, missing });
    if (parsed.kind === 'command') expect(parsed.spec.id).toBe('create-task');
  });

  it('reads /cofnij, in any case and as /undo', () => {
    for (const input of ['/cofnij', '/COFNIJ', '/undo']) {
      const parsed = parseInput(input, TODAY, COMMANDS);
      expect(parsed).toMatchObject({ kind: 'command', args: {}, missing: [] });
      if (parsed.kind === 'command') expect(parsed.spec).toMatchObject({ id: 'undo', risk: 'write', module: null });
    }
  });

  it('reads /pomoc with the command asked about', () => {
    expect(parseInput('/pomoc zadanie', TODAY, COMMANDS)).toMatchObject({ kind: 'command', args: { command: 'zadanie' }, missing: [] });
  });
});

describe('the goal commands', () => {
  const parse = (input: string) => {
    const parsed = parseInput(input, TODAY, COMMANDS);
    if (parsed.kind !== 'command') throw new Error(input);
    return parsed;
  };

  it('are found by id and alias, with and without Polish letters', () => {
    for (const [name, id] of [['cel', 'create-goal'], ['CELE', 'goals'], ['wpłać', 'deposit-goal'], ['edytuj-cel', 'edit-goal'], ['usuń-cel', 'delete-goal'], ['delete-goal', 'delete-goal']]) {
      expect(findCommand(name!, COMMANDS)?.id).toBe(id);
    }
  });

  it.each([
    ['/cel Rower 1500 zł', { name: 'Rower', target: { kind: 'money', grosze: 150000 } }, []],
    ['/cel "Nowy rower" 5000 pkt', { name: 'Nowy rower', target: { kind: 'points', points: 5000 } }, []],
    ['/cel Rower 1500', { name: 'Rower', target: { kind: 'unknown', value: 1500 } }, []],
    ['/cel Rower', { name: 'Rower' }, ['target']],
    ['/cel', {}, ['name', 'target']],
  ])('%s', (input, args, missing) => {
    expect(parse(input)).toMatchObject({ spec: { id: 'create-goal', risk: 'write' }, args, missing });
  });

  it('/wplac and /usun-cel need the goal; /cele takes nothing', () => {
    expect(parse('/wplac Rower 50')).toMatchObject({ spec: { id: 'deposit-goal' }, args: { goal: 'Rower' }, missing: [] });
    expect(parse('/wplac 50')).toMatchObject({ missing: ['goal'] });
    expect(parse('/usun-cel Rower')).toMatchObject({ spec: { id: 'delete-goal', risk: 'destructive' }, args: { goal: 'Rower' }, missing: [] });
    expect(parse('/usun-cel')).toMatchObject({ missing: ['goal'] });
    expect(parse('/cele')).toMatchObject({ spec: { id: 'goals', risk: 'read' }, missing: [] });
  });

  it('/edytuj-cel reads the named arguments', () => {
    expect(parse('/edytuj-cel rowr nazwa="Nowy rower" kwota=2000zł')).toMatchObject({
      spec: { id: 'edit-goal' },
      args: { goal: 'rowr', name: 'Nowy rower', target: { kind: 'money', grosze: 200000 } },
      missing: [],
      unread: [],
    });
    expect(parse('/edytuj-cel Rower kwota=dużo')).toMatchObject({ args: { goal: 'Rower' }, unread: ['target'] });
  });
});

describe('the money commands', () => {
  const parse = (input: string) => {
    const parsed = parseInput(input, TODAY, COMMANDS);
    if (parsed.kind !== 'command') throw new Error(input);
    return parsed;
  };

  it('are found by id and alias, and belong to the Money module', () => {
    for (const [name, id] of [['wplyw', 'add-money'], ['WPŁYW', 'add-money'], ['wydatek', 'remove-money'], ['saldo', 'balance'], ['kategoria', 'create-category'], ['usuń-transakcje', 'delete-transaction'], ['delete-transaction', 'delete-transaction']]) {
      const spec = findCommand(name!, COMMANDS);
      expect(spec?.id).toBe(id);
      expect(spec?.module).toBe('money');
    }
    expect(findCommand('wydatek', availableCommands({ enabledModules: ['chores'], disabledModules: ['money'] }))).toBeNull();
    expect(findCommand('wydatek', availableCommands({ enabledModules: null, disabledModules: null }))?.id).toBe('remove-money');
  });

  it('have the risks of PLAN.md 6.5', () => {
    expect(parse('/wplyw 5').spec.risk).toBe('write');
    expect(parse('/wydatek 5').spec.risk).toBe('write');
    expect(parse('/saldo').spec.risk).toBe('read');
    expect(parse('/kategoria x').spec.risk).toBe('write');
    expect(parse('/usun-transakcje').spec.risk).toBe('destructive');
  });

  it.each([
    ['/wydatek 5 jedzenie obiad', { amount: 500, rest: 'jedzenie obiad' }, []],
    ['/wydatek obiad jedzenie 12,50', { amount: 1250, rest: 'obiad jedzenie' }, []],
    ['/wydatek 20 zł gry wczoraj', { amount: 2000, date: '2026-10-08', rest: 'gry' }, []],
    ['/wplyw 1 500 PLN kieszonkowe 12.10.2026', { amount: 150000, date: '2026-10-12', rest: 'kieszonkowe' }, []],
    ['/wydatek 5 kategoria="Nowa rzecz" kupno', { amount: 500, category: 'Nowa rzecz', rest: 'kupno' }, []],
    ['/wydatek 5 pkt gry', { rest: '5pkt gry' }, ['amount']],
    ['/wydatek jedzenie', { rest: 'jedzenie' }, ['amount']],
    ['/wplyw', {}, ['amount']],
  ])('%s', (input, args, missing) => {
    expect(parse(input)).toMatchObject({ args, missing });
  });

  // 2026-10-09 is a Friday. A bare N.NN is an amount in a command with a money slot, never 5 October.
  it.each([
    ['/wydatek 5.10 jedzenie', { amount: 510, rest: 'jedzenie' }],
    ['/wydatek jedzenie 5.1', { amount: 510, rest: 'jedzenie' }],
    ['/wydatek 12.10 gry', { amount: 1210, rest: 'gry' }],
    ['/wplyw 31.12', { amount: 3112 }],
    ['/wplyw 5.10zł', { amount: 510 }],
    ['/wydatek 5 gry dziś', { amount: 500, date: '2026-10-09', rest: 'gry' }],
    ['/wydatek 5 gry wczoraj', { amount: 500, date: '2026-10-08', rest: 'gry' }],
    ['/wydatek 5 gry pojutrze', { amount: 500, date: '2026-10-11', rest: 'gry' }],
    ['/wydatek 5 gry pn', { amount: 500, date: '2026-10-12', rest: 'gry' }],
    ['/wydatek 5 gry 12.10.2026', { amount: 500, date: '2026-10-12', rest: 'gry' }],
    ['/wydatek 5 gry 2026-10-12', { amount: 500, date: '2026-10-12', rest: 'gry' }],
    ['/wydatek 5 gry +3d', { amount: 500, date: '2026-10-12', rest: 'gry' }],
    ['/wydatek 5.10 gry 12.10.2026', { amount: 510, date: '2026-10-12', rest: 'gry' }],
  ])('%s', (input, args) => {
    const parsed = parse(input);
    expect(parsed.args).toEqual(args);
    expect(parsed.missing).toEqual([]);
  });

  it('keeps "12.10" a date in a command without a money slot', () => {
    expect(parse('/zadanie Kupić mleko 12.10')).toMatchObject({ args: { text: 'Kupić mleko', due: '2026-10-12' }, missing: [] });
  });

  it('never reads the short day-month in any command that has both a money and a date slot', () => {
    const withBoth = COMMANDS.filter((c) => {
      const slots = c.slots(TODAY);
      return slots.some((s) => s.type === 'money') && slots.some((s) => s.type === 'date');
    });
    expect(withBoth.map((c) => c.id)).toEqual(expect.arrayContaining(['add-money', 'remove-money']));
    for (const spec of withBoth) {
      for (const slot of spec.slots(TODAY).filter((s) => s.type === 'date')) {
        for (const token of ['5.10', '5.1', '12.10', '1.1']) expect(slot.recognize?.(token), `${spec.id} ${token}`).toBeUndefined();
        expect(slot.recognize?.('12.10.2026')).toBe('2026-10-12');
      }
    }
  });

  it('/usun-transakcje takes nothing, "ostatnia" or a text; /kategoria needs a name', () => {
    expect(parse('/usun-transakcje')).toMatchObject({ args: {}, missing: [] });
    expect(parse('/usun-transakcje ostatnia')).toMatchObject({ args: { ref: 'ostatnia' }, missing: [] });
    expect(parse('/kategoria Sport')).toMatchObject({ args: { name: 'Sport' }, missing: [] });
    expect(parse('/kategoria')).toMatchObject({ missing: ['name'] });
  });
});

describe('the chore and XP commands', () => {
  const parse = (input: string) => {
    const parsed = parseInput(input, TODAY, COMMANDS);
    if (parsed.kind !== 'command') throw new Error(input);
    return parsed;
  };
  const MODULES = { enabledModules: null, disabledModules: null };

  it('are found by id and alias, with and without Polish letters, in their modules and risks', () => {
    for (const [name, id, module, risk] of [
      ['obowiazek', 'complete-chore', 'chores', 'write'],
      ['OBOWIĄZEK', 'complete-chore', 'chores', 'write'],
      ['obowiazki', 'chores', 'chores', 'read'],
      ['rozlicz', 'settle-chores', 'chores', 'destructive'],
      ['settle-chores', 'settle-chores', 'chores', 'destructive'],
      ['aktywność', 'log-activity', 'stats', 'write'],
      ['seria', 'streak', 'stats', 'read'],
      ['statystyki', 'stats', 'stats', 'read'],
      ['co-teraz', 'what-now', 'stats', 'read'],
      ['what-now', 'what-now', 'stats', 'read'],
    ] as const) {
      expect(findCommand(name, COMMANDS), name).toMatchObject({ id, module, risk });
    }
  });

  it('vanish with their module', () => {
    const ALL = ['chores', 'money', 'games', 'stats', 'notes', 'aichat'];
    const ids = (off: string) => availableCommands({ enabledModules: ALL.filter((m) => m !== off), disabledModules: [off] }).map((c) => c.id);
    expect(ids('chores')).toEqual(expect.arrayContaining(['log-activity', 'streak', 'stats', 'what-now', 'add-money']));
    for (const gone of ['complete-chore', 'chores', 'settle-chores']) expect(ids('chores')).not.toContain(gone);
    for (const gone of ['log-activity', 'streak', 'stats', 'what-now']) expect(ids('stats')).not.toContain(gone);
    expect(availableCommands(MODULES).map((c) => c.id)).toEqual(COMMANDS.map((c) => c.id));
  });

  it.each([
    ['/obowiazek zmywarki', { chore: 'zmywarki' }, []],
    ['/obowiazek zmywarki wczoraj', { chore: 'zmywarki', when: 'yesterday' }, []],
    ['/obowiazek wczoraj Odkurzanie schodów', { chore: 'Odkurzanie schodów', when: 'yesterday' }, []],
    ['/obowiazek "Opróżnienie zmywarki" dzis', { chore: 'Opróżnienie zmywarki', when: 'today' }, []],
    ['/obowiazek', {}, ['chore']],
    ['/aktywnosc nauka 60', { type: 'nauka', duration: 60 }, []],
    ['/aktywnosc 1h30 cwiczenia trening nóg', { type: 'cwiczenia trening nóg', duration: 90 }, []],
    ['/aktywnosc nauka', { type: 'nauka' }, ['duration']],
    ['/aktywnosc 60', { duration: 60 }, ['type']],
    ['/aktywnosc', {}, ['type', 'duration']],
    ['/statystyki', {}, []],
    ['/statystyki 30d', { period: 30 }, []],
    ['/statystyki 7D', { period: 7 }, []],
    ['/co-teraz 30', { duration: 30 }, []],
    ['/co-teraz 1,5h', { duration: 90 }, []],
    ['/co-teraz', {}, ['duration']],
    ['/seria', {}, []],
    ['/rozlicz', {}, []],
    ['/obowiazki', {}, []],
  ])('%s', (input, args, missing) => {
    const parsed = parse(input);
    expect(parsed.args).toEqual(args);
    expect(parsed.missing).toEqual(missing);
  });
});

describe('palette', () => {
  const ids = (draft: string) => palette(draft, COMMANDS).suggestions.map((c) => c.id);

  it('shows every command for a bare "/", nothing for plain text', () => {
    expect(ids('/')).toEqual(COMMANDS.map((c) => c.id));
    expect(ids('zadanie')).toEqual([]);
  });

  it('puts names starting with what is typed first, then names containing it', () => {
    expect(ids('/za')).toEqual(['create-task']);
    expect(ids('/DZ')).toEqual(['today']);
    expect(ids('/task')).toEqual(['create-task']);
    expect(ids('/cof')).toEqual(['undo']);
    expect(ids('/xyz')).toEqual([]);
    expect(ids('/cel')).toEqual(['create-goal', 'goals', 'edit-goal', 'delete-goal']);
    expect(ids('/wpl')).toEqual(['deposit-goal', 'add-money']);
    expect(ids('/sal')).toEqual(['balance']);
  });

  it('once a space follows the name, offers its syntax instead of a list', () => {
    expect(palette('/zadanie ', COMMANDS)).toMatchObject({ suggestions: [], current: { id: 'create-task' } });
    expect(palette('/nic ', COMMANDS)).toEqual({ suggestions: [], current: null });
  });
});
