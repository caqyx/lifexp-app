// A deterministic stand-in for Gemini, for the Functions emulator ONLY, so the
// v2 end-to-end tests (5b-4) can drive exusTurn without a key or network.
// It refuses to exist anywhere else: see select.ts and its test.
//
// Rules on the message (lower case, Polish letters folded):
//   "zepsuj" / "malformed"  -> an answer that is not JSON (safe-reply path)
//   "nieznana" / "unknown"  -> one unknown command and one valid one
//   "wiele" / "many"        -> five actions (the server keeps three)
//   "usun" / "delete"       -> delete-task of t1 (destructive: the dialog path)
//   "zgubiony" / "lost"     -> complete-task of t9 (a ref the context never gave)
//   "zadanie" / "task"      -> create-task with the rest of the message as text, due "jutro"
//   "saldo" / "balance"     -> balance
//   "zmien" / "change"      -> edit-pending of card p1, due "piatek"
//                              (dropped by the server unless context.pendingActions has p1)
//   anything else           -> a plain reply, no actions
// Every call costs FAKE_TOKENS_PER_CALL tokens.
import { parseJson, type ModelClient, type ModelRequest, type ModelResponse } from './model';

export const FAKE_TOKENS_PER_CALL = 100;

export function isFunctionsEmulator(env: NodeJS.ProcessEnv): boolean {
  return env.FUNCTIONS_EMULATOR === 'true';
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l');

type FakeAction = { command: string; args: { name: string; value: string }[] };

function answer(message: string): string {
  const m = fold(message);
  const has = (...words: string[]) => words.some((w) => new RegExp(`\\b${w}\\b`).test(m));
  if (has('zepsuj', 'malformed')) return 'not json {';
  let actions: FakeAction[] = [];
  let reply = `Ex-us (emulator): ${message.slice(0, 200)}`;
  if (has('nieznana', 'unknown')) {
    actions = [
      { command: 'format-disk', args: [] },
      { command: 'balance', args: [] },
    ];
    reply = 'Ex-us (emulator): unknown + balance';
  } else if (has('wiele', 'many')) {
    actions = Array.from({ length: 5 }, (_, i) => ({
      command: 'create-task',
      args: [
        { name: 'text', value: `Zadanie ${i + 1}` },
        { name: 'due', value: 'jutro' },
      ],
    }));
    reply = 'Ex-us (emulator): 5 actions';
  } else if (has('usun', 'delete')) {
    actions = [{ command: 'delete-task', args: [{ name: 'task', value: 't1' }] }];
    reply = 'Ex-us (emulator): delete-task';
  } else if (has('zgubiony', 'lost')) {
    actions = [{ command: 'complete-task', args: [{ name: 'task', value: 't9' }] }];
    reply = 'Ex-us (emulator): complete-task t9';
  } else if (has('zadanie', 'task')) {
    const text = message.replace(/^.*?\b(zadanie|task)\b[:\s]*/i, '').trim() || 'Zadanie';
    actions = [{ command: 'create-task', args: [{ name: 'text', value: text }, { name: 'due', value: 'jutro' }] }];
    reply = 'Ex-us (emulator): create-task';
  } else if (has('zmien', 'change')) {
    actions = [{ command: 'edit-pending', args: [{ name: 'ref', value: 'p1' }, { name: 'due', value: 'piatek' }] }];
    reply = 'Ex-us (emulator): edit-pending';
  } else if (has('saldo', 'balance')) {
    actions = [{ command: 'balance', args: [] }];
    reply = 'Ex-us (emulator): balance';
  }
  return JSON.stringify({ reply, actions });
}

class FakeModelClient implements ModelClient {
  async generate({ contents }: ModelRequest): Promise<ModelResponse> {
    // The last turn is the user's message as typed (prompt.ts puts the context in the system part).
    const text = answer(contents[contents.length - 1]?.text ?? '');
    return { text, json: parseJson(text), usage: { totalTokens: FAKE_TOKENS_PER_CALL } };
  }
}

export function createFakeModelClient(env: NodeJS.ProcessEnv = process.env): ModelClient {
  if (!isFunctionsEmulator(env)) throw new Error('The fake model client exists only in the Functions emulator.');
  return new FakeModelClient();
}
