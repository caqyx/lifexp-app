import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { pendingCards } from './args';
import { parseTurnInput } from './input';

// Built by v2 (v2/tools/exus-context-fixture.ts) for a typical account and committed;
// `npm run check --prefix v2` fails when it is stale. Read from src, not lib-test.
const FIXTURE = join(__dirname, '..', '..', 'src', 'test', 'fixtures', 'exus-context.json');

describe('the context v2 sends', () => {
  const context = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, unknown>;

  it('passes the backend input check unchanged', () => {
    const input = parseTurnInput({ message: 'Co dziś?', history: [], context, lang: 'pl', clientVersion: 'fixture' });
    assert.deepEqual(input.context, context);
  });

  it('stays well under the 16 KB cap', () => {
    assert.ok(Buffer.byteLength(JSON.stringify(context), 'utf8') < 12 * 1024);
  });

  it('gives edit-pending its pending cards', () => {
    assert.deepEqual([...pendingCards(context)], [['p1', 'create-task']]);
  });
});
