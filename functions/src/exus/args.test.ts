import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { checkArgs, pendingCards } from './args';
import { AI_COMMANDS, ARG_NAMES, buildResponseSchema, commandSpec, describeCommands, isAllowedCommand } from './commands';
import { MAX_ARG_VALUE_CHARS, MAX_RAW_ARG_CHARS } from './config';

const spec = (id: string) => {
  const s = commandSpec(id);
  assert.ok(s, id);
  return s;
};
const pairs = (o: Record<string, string>) => Object.entries(o).map(([name, value]) => ({ name, value }));
const NONE = new Map<string, string>();

describe('generated command schema (schema.gen.json)', () => {
  it('has the aiExposed commands and edit-pending, none of the hidden ones', () => {
    const ids = AI_COMMANDS.map((c) => c.id);
    for (const id of ['today', 'create-task', 'add-money', 'report-bug', 'edit-pending']) assert.ok(ids.includes(id), id);
    for (const id of ['help', 'undo', 'lang', 'theme', 'module', 'new-chat']) assert.equal(isAllowedCommand(id), false, id);
  });

  it('describes create-task by its registry slots', () => {
    assert.deepEqual(spec('create-task').slots, [
      { name: 'text', type: 'text', required: true },
      { name: 'due', type: 'date', required: true },
      { name: 'size', type: 'enum', required: false, choices: ['S', 'M', 'L'] },
    ]);
  });

  it('feeds the response schema and the prompt', () => {
    const schema = buildResponseSchema();
    const item = schema.properties?.actions?.items;
    assert.deepEqual(item?.properties?.command?.enum, AI_COMMANDS.map((c) => c.id));
    assert.deepEqual(item?.properties?.args?.items?.properties?.name?.enum, [...ARG_NAMES]);
    assert.ok(ARG_NAMES.includes('ref') && ARG_NAMES.includes('due'));
    const lines = describeCommands().split('\n');
    assert.equal(lines.length, AI_COMMANDS.length);
    assert.match(lines.find((l) => l.startsWith('- create-task '))!, /text \(text, required\), due \(date, required\), size \(S\|M\|L\)/);
  });
});

describe('checkArgs', () => {
  it('keeps slots of the command, drops unknown names', () => {
    const r = checkArgs(spec('create-task'), pairs({ text: 'Mleko', due: 'jutro', amount: '5', colour: 'red' }), NONE);
    assert.deepEqual(r, { args: { text: 'Mleko', due: 'jutro' }, dropped: 2 });
  });

  it('allows missing required slots: the form card asks for them', () => {
    assert.deepEqual(checkArgs(spec('create-task'), pairs({ text: 'Mleko' }), NONE), { args: { text: 'Mleko' }, dropped: 0 });
    assert.deepEqual(checkArgs(spec('create-task'), [], NONE), { args: {}, dropped: 0 });
  });

  it('takes enum values from the choices, spelled as the choice', () => {
    assert.deepEqual(checkArgs(spec('create-task'), pairs({ size: 'm' }), NONE).args, { size: 'M' });
    assert.deepEqual(checkArgs(spec('create-task'), pairs({ size: 'XL' }), NONE), { args: {}, dropped: 1 });
    assert.deepEqual(checkArgs(spec('complete-chore'), pairs({ chore: 'c1', when: 'Yesterday' }), NONE).args, { chore: 'c1', when: 'yesterday' });
  });

  it('passes an enum without known choices through as text', () => {
    assert.deepEqual(checkArgs(spec('tasks'), pairs({ scope: 'zalegle' }), NONE).args, { scope: 'zalegle' });
  });

  it('reads flags as true/false only', () => {
    assert.deepEqual(checkArgs(spec('create-chore'), pairs({ name: 'Śmieci', points: '10', once: 'TRUE' }), NONE).args, {
      name: 'Śmieci',
      points: '10',
      once: 'true',
    });
    assert.equal(checkArgs(spec('create-chore'), pairs({ once: 'maybe' }), NONE).dropped, 1);
  });

  it('caps lengths, longer for the raw bug report; drops empty values', () => {
    const long = 'x'.repeat(MAX_ARG_VALUE_CHARS + 1);
    assert.deepEqual(checkArgs(spec('create-task'), pairs({ text: long, due: '  ' }), NONE), { args: {}, dropped: 2 });
    const report = 'y'.repeat(MAX_ARG_VALUE_CHARS + 1);
    assert.deepEqual(checkArgs(spec('report-bug'), pairs({ report }), NONE).args, { report });
    assert.equal(checkArgs(spec('report-bug'), pairs({ report: 'y'.repeat(MAX_RAW_ARG_CHARS + 1) }), NONE).dropped, 1);
  });

  it('trims values', () => {
    assert.deepEqual(checkArgs(spec('create-goal'), pairs({ name: '  Rower ', target: ' 1500 zł' }), NONE).args, { name: 'Rower', target: '1500 zł' });
  });
});

describe('edit-pending', () => {
  const pending = new Map([
    ['p1', 'create-task'],
    ['p2', 'add-money'],
  ]);
  const edit = spec('edit-pending');

  it('checks the args against the pending card’s command', () => {
    assert.deepEqual(checkArgs(edit, pairs({ ref: 'p1', due: 'piątek', size: 'l', amount: '5' }), pending), {
      args: { ref: 'p1', due: 'piątek', size: 'L' },
      dropped: 1,
    });
    assert.deepEqual(checkArgs(edit, pairs({ ref: 'p2', amount: '12 zł' }), pending).args, { ref: 'p2', amount: '12 zł' });
  });

  it('drops the action without a pending ref, with a bad ref or with nothing to change', () => {
    assert.equal(checkArgs(edit, pairs({ due: 'piątek' }), pending).args, null);
    assert.equal(checkArgs(edit, pairs({ ref: 'p3', due: 'piątek' }), pending).args, null);
    assert.equal(checkArgs(edit, pairs({ ref: 't1', due: 'piątek' }), new Map([['t1', 'create-task']])).args, null);
    assert.equal(checkArgs(edit, pairs({ ref: 'p1', amount: '5' }), pending).args, null);
    assert.equal(checkArgs(edit, pairs({ ref: 'p1', due: 'x' }), new Map([['p1', 'edit-pending']])).args, null);
    assert.equal(checkArgs(edit, pairs({ ref: 'p1', due: 'x' }), new Map([['p1', 'format-disk']])).args, null);
  });

  it('reads the pending cards from the context, ignoring junk', () => {
    const cards = pendingCards({ pendingActions: [{ ref: 'p1', command: 'create-task' }, { ref: 2 }, null, 'x'] });
    assert.deepEqual([...cards], [['p1', 'create-task']]);
    assert.equal(pendingCards({ pendingActions: 'nope' }).size, 0);
    assert.equal(pendingCards({}).size, 0);
  });
});
