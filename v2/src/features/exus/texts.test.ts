import { describe, expect, it } from 'vitest';
import { COMMANDS } from '@/domain/exus/commands';
import en from '@/i18n/en.json';
import pl from '@/i18n/pl.json';

// Every command is described in the palette and /pomoc, and writes its syntax and what a missing slot is called.
describe.each([
  ['pl', pl],
  ['en', en],
])('the Ex-us texts (%s)', (_lang, dictionary) => {
  const exus = dictionary.exus as {
    commands: Record<string, string>;
    args: Record<string, string>;
    slots: Record<string, string>;
    undoWhat: Record<string, string>;
  };

  it('describe every command, and give the ones with arguments their syntax', () => {
    for (const spec of COMMANDS) {
      expect(exus.commands[spec.id], spec.id).toBeTruthy();
      if (spec.slots('2026-10-09').length > 0) expect(exus.args[spec.id], spec.id).toBeTruthy();
    }
    expect(Object.keys(exus.commands).sort()).toEqual(COMMANDS.map((c) => c.id).sort());
  });

  it('name every slot that can be missing', () => {
    for (const spec of COMMANDS) {
      for (const slot of spec.slots('2026-10-09')) if (slot.required) expect(exus.slots[slot.name], `${spec.id}.${slot.name}`).toBeTruthy();
    }
  });

  it('say what /cofnij took back for the commands the new PR makes undoable', () => {
    for (const id of ['lend', 'borrow', 'money-limit', 'create-chore', 'delete-chore', 'delete-chore-entry']) expect(exus.undoWhat[id], id).toBeTruthy();
  });
});
