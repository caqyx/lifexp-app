import { describe, expect, it } from 'vitest';
import { availableCommands, COMMANDS, findCommand, palette, parseInput, type CommandSpec } from './commands';

const TODAY = '2026-10-09';

describe('the registry', () => {
  it('has unique ids and aliases', () => {
    const names = COMMANDS.flatMap((c) => [c.id, ...c.aliases]);
    expect(new Set(names).size).toBe(names.length);
  });

  it('says which commands the AI may propose: all but /pomoc, /cofnij, /nowy, /motyw, /jezyk and /modul (PLAN.md 6.5)', () => {
    expect(COMMANDS.filter((c) => !c.aiExposed).map((c) => c.id).sort()).toEqual(['help', 'lang', 'module', 'new-chat', 'theme', 'undo']);
    expect(COMMANDS.filter((c) => c.aiExposed)).toHaveLength(COMMANDS.length - 6);
  });

  it('has every command of PLAN.md 6.5 but edit-pending (AI only, 5b) and log-gaming (no gaming sessions in v2)', () => {
    expect(COMMANDS.map((c) => c.id).sort()).toEqual(
      [
        'add-money', 'archive-note', 'balance', 'borrow', 'chores', 'complete-chore', 'complete-task', 'create-category', 'create-chore',
        'create-goal', 'create-note', 'create-task', 'daily-limit', 'delete-activity', 'delete-chore', 'delete-chore-entry', 'delete-goal',
        'delete-task', 'delete-transaction', 'deposit-goal', 'edit-goal', 'edit-task', 'find-note', 'go', 'goals', 'help', 'lang', 'lend',
        'loans', 'module', 'money-limit', 'new-chat', 'remove-money', 'repay', 'report-bug', 'settle-chores', 'stats', 'streak', 'tasks',
        'theme', 'today', 'undo', 'what-now', 'log-activity',
      ].sort(),
    );
  });

  it('finds a command by id or alias, in any case and without Polish letters', () => {
    expect(findCommand('ZADANIE', COMMANDS)?.id).toBe('create-task');
    expect(findCommand('create-task', COMMANDS)?.id).toBe('create-task');
    expect(findCommand('dziś', COMMANDS)?.id).toBe('today');
    expect(findCommand('nic', COMMANDS)).toBeNull();
  });

  it("leaves out a module's commands while it is off", () => {
    const money: CommandSpec = { id: 'today', aliases: ['saldo'], module: 'money', risk: 'read', aiExposed: true, slots: () => [] };
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

describe('the task commands', () => {
  const parse = (input: string) => {
    const parsed = parseInput(input, TODAY, COMMANDS);
    if (parsed.kind !== 'command') throw new Error(input);
    return parsed;
  };

  it('are in the registry with their risk', () => {
    for (const [name, id, risk] of [
      ['zrobione', 'complete-task', 'write'],
      ['zadania', 'tasks', 'read'],
      ['edytuj-zadanie', 'edit-task', 'write'],
      ['usun-zadanie', 'delete-task', 'destructive'],
      ['USUŃ-ZADANIE', 'delete-task', 'destructive'],
    ] as const) {
      expect(findCommand(name, COMMANDS), name).toMatchObject({ id, module: null, risk });
    }
  });

  it.each([
    ['/zrobione mleko', { task: 'mleko' }, []],
    ['/zrobione "Kupić mleko"', { task: 'Kupić mleko' }, []],
    ['/zrobione', {}, ['task']],
    ['/zadania', {}, []],
    ['/zadania dzis', { scope: 'today' }, []],
    ['/zadania Zaległe', { scope: 'overdue' }, []],
    ['/zadania wszystkie', { scope: 'all' }, []],
    ['/usun-zadanie mleko', { task: 'mleko' }, []],
    ['/usun-zadanie', {}, ['task']],
    ['/edytuj-zadanie mleko', { task: 'mleko' }, []],
    ['/edytuj-zadanie mleko termin=jutro', { task: 'mleko', due: '2026-10-10' }, []],
    ['/edytuj-zadanie mleko tresc="Kupić chleb" rozmiar=l', { task: 'mleko', text: 'Kupić chleb', size: 'L' }, []],
    // a date or a size among the words is part of the name, not a change
    ['/edytuj-zadanie spotkanie jutro L', { task: 'spotkanie jutro L' }, []],
    ['/edytuj-zadanie', {}, ['task']],
  ])('%s', (input, args, missing) => {
    const parsed = parse(input);
    expect(parsed.args).toEqual(args);
    expect(parsed.missing).toEqual(missing);
    expect(parsed.unread).toEqual([]);
  });

  it('names a due date or a size it cannot read', () => {
    expect(parse('/edytuj-zadanie mleko termin=kiedyś').unread).toEqual(['due']);
    expect(parse('/edytuj-zadanie mleko rozmiar=XL').unread).toEqual(['size']);
  });
});

describe('the note commands', () => {
  const parse = (input: string) => {
    const parsed = parseInput(input, TODAY, COMMANDS);
    if (parsed.kind !== 'command') throw new Error(input);
    return parsed;
  };

  it('belong to Notes and vanish with it', () => {
    for (const [name, id, risk] of [
      ['notatka', 'create-note', 'write'],
      ['archiwizuj', 'archive-note', 'write'],
      ['szukaj', 'find-note', 'read'],
    ] as const) {
      expect(findCommand(name, COMMANDS), name).toMatchObject({ id, module: 'notes', risk });
    }
    const off = availableCommands({ enabledModules: ['chores', 'money', 'games', 'stats', 'aichat'], disabledModules: ['notes'] }).map((c) => c.id);
    for (const gone of ['create-note', 'archive-note', 'find-note']) expect(off).not.toContain(gone);
    expect(off).toContain('daily-limit');
  });

  it.each([
    ['/notatka Zakupy', { title: 'Zakupy' }, []],
    ['/notatka Zakupy mleko i chleb', { title: 'Zakupy', content: 'mleko i chleb' }, []],
    ['/notatka "Lista zakupów" mleko i chleb', { title: 'Lista zakupów', content: 'mleko i chleb' }, []],
    ['/notatka tytul="Lista zakupów" tresc="mleko, chleb"', { title: 'Lista zakupów', content: 'mleko, chleb' }, []],
    // a date or a size in the content stays there
    ['/notatka Spotkanie jutro M', { title: 'Spotkanie', content: 'jutro M' }, []],
    ['/notatka', {}, ['title']],
    ['/archiwizuj zakupy', { note: 'zakupy' }, []],
    ['/archiwizuj', {}, ['note']],
    ['/szukaj mleko chleb', { query: 'mleko chleb' }, []],
    ['/szukaj', {}, ['query']],
  ])('%s', (input, args, missing) => {
    const parsed = parse(input);
    expect(parsed.args).toEqual(args);
    expect(parsed.missing).toEqual(missing);
  });
});

describe('the settings and navigation commands', () => {
  const parse = (input: string) => {
    const parsed = parseInput(input, TODAY, COMMANDS);
    if (parsed.kind !== 'command') throw new Error(input);
    return parsed;
  };

  it('are always there, whatever modules are off', () => {
    for (const [name, id, risk] of [
      ['limit', 'daily-limit', 'write'],
      ['jezyk', 'lang', 'write'],
      ['język', 'lang', 'write'],
      ['motyw', 'theme', 'write'],
      ['modul', 'module', 'write'],
      ['idz', 'go', 'read'],
      ['IDŹ', 'go', 'read'],
    ] as const) {
      expect(findCommand(name, COMMANDS), name).toMatchObject({ id, module: null, risk });
    }
  });

  it.each([
    ['/limit 120', { limit: 120 }, []],
    ['/limit 120 pkt', { limit: 120 }, []],
    ['/limit 20', { limit: 20 }, []],
    ['/limit', {}, ['limit']],
    ['/limit dużo', {}, ['limit']],
    ['/jezyk en', { lang: 'en' }, []],
    ['/jezyk Polski', { lang: 'pl' }, []],
    ['/jezyk', {}, ['lang']],
    ['/motyw', {}, []],
    ['/motyw gold', { family: 'gold' }, []],
    ['/motyw jasny', { mode: 'light' }, []],
    ['/motyw ios ciemny', { family: 'ios', mode: 'dark' }, []],
    ['/motyw ciemny lifexp', { family: 'lifexp', mode: 'dark' }, []],
    ['/modul pieniadze off', { module: 'money', state: false }, []],
    ['/modul wlacz Notatki', { module: 'notes', state: true }, []],
    ['/modul ex-us on', { module: 'aichat', state: true }, []],
    ['/modul pieniadze', { module: 'money' }, ['state']],
    ['/modul', {}, ['module', 'state']],
    ['/idz zadania', { screen: 'zadania' }, []],
    ['/idz "ustawienia"', { screen: 'ustawienia' }, []],
    ['/idz', {}, ['screen']],
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
    expect(ids('/za')).toEqual(['create-task', 'tasks', 'edit-task', 'delete-task', 'lend', 'borrow']);
    expect(ids('/DZ')).toEqual(['today', 'go']);
    expect(ids('/task')).toEqual(['tasks', 'create-task', 'complete-task', 'edit-task', 'delete-task']);
    expect(ids('/szu')).toEqual(['find-note']);
    expect(ids('/mod')).toEqual(['module']);
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

describe('the loan, limit, chore, activity, report and chat commands (5a-9)', () => {
  const parse = (input: string) => {
    const parsed = parseInput(input, TODAY, COMMANDS);
    if (parsed.kind !== 'command') throw new Error(input);
    return parsed;
  };

  it('are found by id and alias, with their module and risk', () => {
    for (const [name, id, module, risk] of [
      ['pozyczam', 'lend', 'money', 'write'],
      ['POŻYCZAM', 'lend', 'money', 'write'],
      ['pozyczam-od', 'borrow', 'money', 'write'],
      ['splata', 'repay', 'money', 'write'],
      ['spłata', 'repay', 'money', 'write'],
      ['pozyczki', 'loans', 'money', 'read'],
      ['limit-wydatkow', 'money-limit', 'money', 'write'],
      ['nowy-obowiazek', 'create-chore', 'chores', 'write'],
      ['usun-obowiazek', 'delete-chore', 'chores', 'destructive'],
      ['usun-wpis', 'delete-chore-entry', 'chores', 'destructive'],
      ['usun-aktywnosc', 'delete-activity', 'stats', 'destructive'],
      ['blad', 'report-bug', null, 'write'],
      ['błąd', 'report-bug', null, 'write'],
      ['nowy', 'new-chat', null, 'read'],
      ['new-chat', 'new-chat', null, 'read'],
    ] as const) {
      expect(findCommand(name, COMMANDS), name).toMatchObject({ id, module, risk });
    }
  });

  it('vanish with their module; /blad and /nowy never do', () => {
    const ALL = ['chores', 'money', 'games', 'stats', 'notes', 'aichat'];
    const ids = (off: string) => availableCommands({ enabledModules: ALL.filter((m) => m !== off), disabledModules: [off] }).map((c) => c.id);
    for (const gone of ['lend', 'borrow', 'repay', 'loans', 'money-limit']) expect(ids('money')).not.toContain(gone);
    for (const gone of ['create-chore', 'delete-chore', 'delete-chore-entry']) expect(ids('chores')).not.toContain(gone);
    expect(ids('stats')).not.toContain('delete-activity');
    for (const off of ALL) for (const kept of ['report-bug', 'new-chat']) expect(ids(off)).toContain(kept);
  });

  it.each([
    ['/pozyczam Ola 20', { person: 'Ola', amount: 2000 }, []],
    ['/pozyczam Ola 20 zł na kino', { person: 'Ola', amount: 2000, note: 'na kino' }, []],
    ['/pozyczam 12,50 Tata', { person: 'Tata', amount: 1250 }, []],
    ['/pozyczam "Ciocia Ania" 100', { person: 'Ciocia Ania', amount: 10000 }, []],
    ['/pozyczam Ola', { person: 'Ola' }, ['amount']],
    ['/pozyczam', {}, ['amount', 'person']],
    ['/pozyczam-od Tata 40 na buty', { person: 'Tata', amount: 4000, note: 'na buty' }, []],
    ['/splata Ola 10', { loan: 'Ola', amount: 1000 }, []],
    ['/splata Ola 2 20 zł', { loan: 'Ola 2', amount: 2000 }, []],
    ['/splata Ola', { loan: 'Ola' }, ['amount']],
    ['/pozyczki', {}, []],
    ['/limit-wydatkow 300', { amount: 30000 }, []],
    ['/limit-wydatkow 0', { amount: 0 }, []],
    ['/limit-wydatkow', {}, ['amount']],
    ['/nowy-obowiazek Mycie okien 30', { name: 'Mycie okien', points: 30 }, []],
    ['/nowy-obowiazek Mycie okien 2 30 pkt --jednorazowy', { name: 'Mycie okien 2', points: 30, once: true }, []],
    ['/nowy-obowiazek --once Okna 30', { name: 'Okna', points: 30, once: true }, []],
    ['/nowy-obowiazek Okna', { name: 'Okna' }, ['points']],
    ['/nowy-obowiazek', {}, ['name', 'points']],
    ['/usun-obowiazek okna', { chore: 'okna' }, []],
    ['/usun-obowiazek', {}, ['chore']],
    ['/usun-wpis', {}, []],
    ['/usun-wpis ostatni', { ref: 'ostatni' }, []],
    ['/usun-wpis zmywarki', { ref: 'zmywarki' }, []],
    ['/usun-aktywnosc', {}, []],
    ['/usun-aktywnosc nauka rozdział 3', { ref: 'nauka rozdział 3' }, []],
    ['/nowy', {}, []],
  ])('%s', (input, args, missing) => {
    const parsed = parse(input);
    expect(parsed.args).toEqual(args);
    expect(parsed.missing).toEqual(missing);
  });

  it('/blad takes the text as typed, with its bars, quotes, units and key=value', () => {
    expect(parse('/blad Saldo | Pieniądze | Cena 12 zł, a=b, "tak"').args).toEqual({ report: 'Saldo | Pieniądze | Cena 12 zł, a=b, "tak"' });
    expect(parse('/blad').missing).toEqual(['report']);
    expect(parse('/blad    ').missing).toEqual(['report']);
  });
});
