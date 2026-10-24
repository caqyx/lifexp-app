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
    ['/wplyw 1 500 PLN kieszonkowe 12.10', { amount: 150000, date: '2026-10-12', rest: 'kieszonkowe' }, []],
    ['/wydatek 5 kategoria="Nowa rzecz" kupno', { amount: 500, category: 'Nowa rzecz', rest: 'kupno' }, []],
    ['/wydatek 5 pkt gry', { rest: '5pkt gry' }, ['amount']],
    ['/wydatek jedzenie', { rest: 'jedzenie' }, ['amount']],
    ['/wplyw', {}, ['amount']],
  ])('%s', (input, args, missing) => {
    expect(parse(input)).toMatchObject({ args, missing });
  });

  it('/usun-transakcje takes nothing, "ostatnia" or a text; /kategoria needs a name', () => {
    expect(parse('/usun-transakcje')).toMatchObject({ args: {}, missing: [] });
    expect(parse('/usun-transakcje ostatnia')).toMatchObject({ args: { ref: 'ostatnia' }, missing: [] });
    expect(parse('/kategoria Sport')).toMatchObject({ args: { name: 'Sport' }, missing: [] });
    expect(parse('/kategoria')).toMatchObject({ missing: ['name'] });
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
