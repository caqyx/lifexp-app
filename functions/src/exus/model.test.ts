import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { ThinkingLevel, type GenerateContentParameters, type GenerateContentResponse } from '@google/genai';
import { buildResponseSchema } from './commands';
import { MAX_OUTPUT_TOKENS, MODEL_NAME } from './config';
import { FAKE_TOKENS_PER_CALL, createFakeModelClient } from './fake';
import { GeminiModelClient } from './gemini';
import { validateOutput } from './output';
import { selectModelClient } from './select';

const EMULATOR = { FUNCTIONS_EMULATOR: 'true' };

describe('model selection', () => {
  it('uses Gemini everywhere except the Functions emulator', () => {
    for (const env of [{}, { FUNCTIONS_EMULATOR: 'false' }, { FUNCTIONS_EMULATOR: '1' }, { FUNCTIONS_EMULATOR: 'TRUE' }, { NODE_ENV: 'test' }]) {
      assert.ok(selectModelClient(env, () => 'key') instanceof GeminiModelClient, JSON.stringify(env));
    }
  });

  it('cannot build the fake outside the emulator', () => {
    for (const env of [{}, { FUNCTIONS_EMULATOR: 'false' }, { FUNCTIONS_EMULATOR: '' }]) {
      assert.throws(() => createFakeModelClient(env), /only in the Functions emulator/);
    }
  });

  it('uses the fake in the emulator without reading the secret', () => {
    let read = false;
    const client = selectModelClient(EMULATOR, () => {
      read = true;
      return 'key';
    });
    assert.ok(!(client instanceof GeminiModelClient));
    assert.equal(read, false);
  });
});

describe('GeminiModelClient', () => {
  it('sends one structured-output request and reports the billed tokens', async () => {
    const seen: GenerateContentParameters[] = [];
    const client = new GeminiModelClient('key', async (params) => {
      seen.push(params);
      return {
        text: '{"reply":"ok","actions":[]}',
        usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 40, totalTokenCount: 950 },
      } as GenerateContentResponse;
    });
    const schema = buildResponseSchema();
    const res = await client.generate({ system: 'S', contents: [{ role: 'user', text: 'Hej' }], schema });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].model, MODEL_NAME);
    assert.equal(seen[0].config?.responseMimeType, 'application/json');
    assert.equal(seen[0].config?.responseSchema, schema);
    assert.equal(seen[0].config?.systemInstruction, 'S');
    assert.equal(MODEL_NAME, 'gemini-3.5-flash');
    assert.deepEqual(seen[0].config?.thinkingConfig, { thinkingLevel: ThinkingLevel.MINIMAL });
    assert.equal(seen[0].config?.temperature, undefined, 'Gemini 3 keeps its default temperature');
    assert.equal(seen[0].config?.maxOutputTokens, MAX_OUTPUT_TOKENS);
    assert.deepEqual(seen[0].contents, [{ role: 'user', parts: [{ text: 'Hej' }] }]);
    assert.deepEqual(res, { text: '{"reply":"ok","actions":[]}', json: { reply: 'ok', actions: [] }, usage: { totalTokens: 950 } });
  });

  it('adds the parts when the total is missing, and survives an empty answer', async () => {
    const client = new GeminiModelClient('key', async () =>
      ({ text: undefined, usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 2 } }) as unknown as GenerateContentResponse,
    );
    const res = await client.generate({ system: 'S', contents: [], schema: buildResponseSchema() });
    assert.deepEqual(res, { text: '', json: undefined, usage: { totalTokens: 17 } });
  });
});

describe('fake model (emulator)', () => {
  const fake = createFakeModelClient(EMULATOR);
  const ask = async (message: string) => {
    const res = await fake.generate({ system: '', contents: [{ role: 'user', text: message }], schema: buildResponseSchema() });
    assert.equal(res.usage.totalTokens, FAKE_TOKENS_PER_CALL);
    return validateOutput(res, 'pl');
  };

  it('turns "zadanie" into create-task', async () => {
    const out = await ask('Dodaj zadanie kupić mleko');
    assert.deepEqual(out.actions, [{ command: 'create-task', args: { text: 'kupić mleko', due: 'jutro' } }]);
  });

  it('turns "saldo" into balance and plain text into a reply', async () => {
    assert.deepEqual((await ask('Jakie mam saldo?')).actions, [{ command: 'balance', args: {} }]);
    const plain = await ask('Cześć');
    assert.deepEqual(plain.actions, []);
    assert.match(plain.reply, /Cześć/);
  });

  it('turns "zmień" into edit-pending of p1, kept only when p1 is pending', async () => {
    const res = await fake.generate({ system: '', contents: [{ role: 'user', text: 'Zmień termin na piątek' }], schema: buildResponseSchema() });
    assert.deepEqual(validateOutput(res, 'pl', new Map([['p1', 'create-task']])).actions, [
      { command: 'edit-pending', args: { ref: 'p1', due: 'piatek' } },
    ]);
    assert.deepEqual(validateOutput(res, 'pl').actions, []);
  });

  it('turns "usuń" into delete-task of t1 and "zgubiony" into a ref the context never gave', async () => {
    assert.deepEqual((await ask('Usuń to zadanie')).actions, [{ command: 'delete-task', args: { task: 't1' } }]);
    assert.deepEqual((await ask('zgubiony')).actions, [{ command: 'complete-task', args: { task: 't9' } }]);
  });

  it('drives the safe paths: malformed, unknown, too many', async () => {
    assert.equal((await ask('zepsuj')).issues.malformed, true);
    const unknown = await ask('nieznana komenda');
    assert.deepEqual(unknown.actions, [{ command: 'balance', args: {} }]);
    assert.equal(unknown.issues.droppedUnknown, 1);
    const many = await ask('wiele');
    assert.equal(many.actions.length, 3);
    assert.equal(many.issues.trimmed, 2);
  });
});
