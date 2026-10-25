import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COMMANDS } from '@/domain/exus/commands';
import { REGEN_COMMAND, SCHEMA_PATH, buildExusSchema, serializeExusSchema } from './exus-schema';

const committed = () => readFileSync(fileURLToPath(new URL(`../${SCHEMA_PATH}`, import.meta.url)), 'utf8');

describe('Ex-us schema for the AI backend (functions/src/exus/schema.gen.json)', () => {
  it('is up to date with the registry', () => {
    // On failure: run `npm run gen:exus-schema --prefix v2` and commit the file.
    expect(committed(), `schema.gen.json is stale: run ${REGEN_COMMAND}`).toBe(serializeExusSchema());
  });

  it('the stale check notices a changed registry', () => {
    const schema = buildExusSchema();
    const fewer = { ...schema, commands: schema.commands.slice(1) };
    const renamed = { ...schema, commands: schema.commands.map((c, i) => (i === 0 ? { ...c, description: `${c.description}!` } : c)) };
    expect(serializeExusSchema(fewer)).not.toBe(committed());
    expect(serializeExusSchema(renamed)).not.toBe(committed());
  });

  it('lists exactly the aiExposed commands, then edit-pending', () => {
    const ids = buildExusSchema().commands.map((c) => c.id);
    expect(ids).toEqual([...COMMANDS.filter((c) => c.aiExposed).map((c) => c.id), 'edit-pending']);
    for (const hidden of ['help', 'undo', 'lang', 'theme', 'module', 'new-chat']) expect(ids).not.toContain(hidden);
  });

  it('describes create-task with its slots and size choices', () => {
    const task = buildExusSchema().commands.find((c) => c.id === 'create-task');
    expect(task).toEqual({
      id: 'create-task',
      description: 'Nowe zadanie',
      risk: 'write',
      slots: [
        { name: 'text', type: 'text', required: true },
        { name: 'due', type: 'date', required: true },
        { name: 'size', type: 'enum', required: false, choices: ['S', 'M', 'L'] },
      ],
    });
  });

  it('keeps named keys, flags and raw slots', () => {
    const byId = new Map(buildExusSchema().commands.map((c) => [c.id, c]));
    expect(byId.get('edit-task')?.slots.find((s) => s.name === 'due')).toEqual({
      name: 'due',
      type: 'date',
      required: false,
      keys: ['termin', 'due'],
    });
    expect(byId.get('create-chore')?.slots.find((s) => s.name === 'once')).toEqual({
      name: 'once',
      type: 'flag',
      required: false,
      keys: ['jednorazowy', 'once'],
    });
    expect(byId.get('report-bug')?.slots).toEqual([{ name: 'report', type: 'text', required: true, raw: true }]);
  });

  it('adds edit-pending as an AI-only command with a p1..p3 ref', () => {
    const edit = buildExusSchema().commands.at(-1);
    expect(edit).toMatchObject({ id: 'edit-pending', pendingSlots: true });
    expect(edit?.slots).toEqual([{ name: 'ref', type: 'ref', required: true, pattern: '^p[1-3]$' }]);
    expect(COMMANDS.map((c): string => c.id)).not.toContain('edit-pending');
  });
});
