// Szybkie liczenie's pure parts (docs/v2/PLAN.md 9.1, stage g-4): the game is plain ES
// modules in public/games/quick-math (no build step, its own CSP), and these tests import
// the same files the game runs.
import { describe, expect, test } from 'vitest';
import { pickLang, testParams, translator } from '../public/games/quick-math/js/i18n.js';
import {
  LEVELS,
  createQuestion,
  createRng,
  formatQuestion,
  nextQuestion,
  spokenQuestion,
  type Level,
  type Question,
} from '../public/games/quick-math/js/questions.js';
import { RECORD_PREFIX, readBest, recordKey, saveBest } from '../public/games/quick-math/js/records.js';
import {
  BUFFER_LIMIT,
  FEEDBACK_SECONDS,
  ROUND_SECONDS,
  WRONG_PENALTY,
  applyKey,
  applyPenalty,
  createRound,
  endRound,
  multiplierFor,
  pointsFor,
  pressKey,
  roundStats,
  shouldAutoSubmit,
  tick,
  type Key,
  type Round,
} from '../public/games/quick-math/js/round.js';

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 7919 + 1);
const PER_SEED = 120;

/** Evaluates the parts with the usual order of operations (× and ÷ first). */
function evaluate(parts: (number | string)[]): number {
  const terms: (number | string)[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    if (p === '*' || p === '/') {
      const left = terms.pop() as number;
      const right = parts[++i] as number;
      terms.push(p === '*' ? left * right : left / right);
    } else terms.push(p);
  }
  let value = terms[0] as number;
  for (let i = 1; i < terms.length; i += 2) {
    value = terms[i] === '+' ? value + (terms[i + 1] as number) : value - (terms[i + 1] as number);
  }
  return value;
}

function questions(level: Level): Question[] {
  return SEEDS.flatMap((seed) => {
    const rng = createRng(seed);
    let previous: string | null = null;
    return Array.from({ length: PER_SEED }, () => {
      const q = nextQuestion(level, rng, previous);
      previous = q.key;
      return q;
    });
  });
}

const digit = (d: number): Key => ({ kind: 'digit', digit: d });
const OK: Key = { kind: 'ok' };

/** Types a number on the keypad. */
function type(round: Round, value: number) {
  let r = round;
  const events: string[] = [];
  if (value < 0) {
    const step = pressKey(r, { kind: 'minus' });
    r = step.round;
    events.push(...step.events);
  }
  for (const ch of String(Math.abs(value))) {
    const step = pressKey(r, digit(Number(ch)));
    r = step.round;
    events.push(...step.events);
  }
  return { round: r, events };
}

/** Lets the feedback finish. */
const settle = (round: Round) => tick(round, FEEDBACK_SECONDS.wrong + 0.01);

describe('questions', () => {
  test.each(LEVELS)('%s: every answer is a whole number and matches the expression', (level) => {
    for (const q of questions(level)) {
      expect(Number.isInteger(q.answer)).toBe(true);
      expect(evaluate(q.parts)).toBe(q.answer);
      for (const p of q.parts) if (typeof p === 'number') expect(Number.isInteger(p)).toBe(true);
    }
  });

  test('easy: + and − up to 20, never below zero', () => {
    for (const q of questions('easy')) {
      expect(q.parts).toHaveLength(3);
      expect(['+', '-']).toContain(q.parts[1]);
      for (const p of q.parts) if (typeof p === 'number') expect(p).toBeLessThanOrEqual(20);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThanOrEqual(20);
    }
  });

  test('medium: + and − up to 100 and the times table up to 10, never below zero', () => {
    const ops = new Set<unknown>();
    for (const q of questions('medium')) {
      ops.add(q.parts[1]);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThanOrEqual(100);
      if (q.parts[1] === '*') for (const p of q.parts) if (typeof p === 'number') expect(p).toBeLessThanOrEqual(10);
    }
    expect([...ops].sort()).toEqual(['*', '+', '-']);
  });

  test('hard: all four operations and two steps; division always exact', () => {
    const ops = new Set<unknown>();
    let twoSteps = 0;
    let negatives = 0;
    for (const q of questions('hard')) {
      for (const p of q.parts) if (typeof p === 'string') ops.add(p);
      if (q.parts.length === 5) twoSteps++;
      if (q.answer < 0) negatives++;
      const at = q.parts.indexOf('/');
      if (at > 0) expect((q.parts[at - 1] as number) % (q.parts[at + 1] as number)).toBe(0);
      expect(Math.abs(q.answer)).toBeLessThan(1000);
      // Typeable on the keypad: at most 3 digits and the sign.
      expect(String(Math.abs(q.answer)).length).toBeLessThanOrEqual(3);
    }
    expect([...ops].sort()).toEqual(['*', '+', '-', '/']);
    expect(twoSteps).toBeGreaterThan(0);
    // Below zero happens, but rarely: it is still a kid's game.
    expect(negatives).toBeGreaterThan(0);
    expect(negatives / (SEEDS.length * PER_SEED)).toBeLessThan(0.25);
  });

  test.each(LEVELS)('%s: never the same question twice in a row', (level) => {
    for (const seed of SEEDS) {
      const rng = createRng(seed);
      let previous = nextQuestion(level, rng, null);
      for (let i = 0; i < PER_SEED; i++) {
        const next = nextQuestion(level, rng, previous.key);
        expect(next.key).not.toBe(previous.key);
        previous = next;
      }
    }
  });

  test('the same seed asks the same questions', () => {
    const a = createRng(5);
    const b = createRng(5);
    expect(Array.from({ length: 10 }, () => createQuestion('hard', a).key)).toEqual(
      Array.from({ length: 10 }, () => createQuestion('hard', b).key),
    );
  });

  test('shown with real signs, read with words', () => {
    const q: Question = { parts: [7, '*', 8, '-', 9], answer: 47, key: '7 * 8 - 9' };
    expect(formatQuestion(q)).toBe('7 × 8 − 9');
    expect(spokenQuestion(q, { '+': 'plus', '-': 'minus', '*': 'razy', '/': 'podzielić przez' })).toBe('7 razy 8 minus 9');
  });
});

describe('scoring and the combo', () => {
  test('the multiplier grows with the streak: ×2 from 3, ×3 from 6, ×4 from 10', () => {
    expect([1, 2, 3, 5, 6, 9, 10, 30].map(multiplierFor)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    expect(pointsFor('easy', 1)).toBe(10);
    expect(pointsFor('medium', 3)).toBe(30);
    expect(pointsFor('hard', 10)).toBe(100);
  });

  test('correct answers add points with the combo; a wrong one breaks it', () => {
    let round = createRound({ level: 'easy', mode: 'timed', rng: createRng(1) });
    for (let i = 0; i < 4; i++) {
      round = type(round, round.question.answer).round;
      round = settle(round).round;
    }
    expect(round.streak).toBe(4);
    expect(round.score).toBe(10 + 10 + 20 + 20);
    const wrong = round.question.answer + 1;
    round = type(round, wrong).round;
    const result = pressKey(round, OK);
    expect(result.events).toEqual(['wrong']);
    expect(result.round.streak).toBe(0);
    expect(result.round.maxStreak).toBe(4);
    expect(result.round.score).toBe(60);
    expect(result.round.feedback).toMatchObject({ kind: 'wrong', typed: String(wrong) });
    expect(result.round.feedback?.question.answer).toBe(round.question.answer);
  });
});

describe('the clock and the penalty', () => {
  test('a wrong answer costs 3 seconds, never below zero; practice has no clock', () => {
    expect(applyPenalty(42, 'timed')).toBe(42 - WRONG_PENALTY);
    expect(applyPenalty(2, 'timed')).toBe(0);
    expect(applyPenalty(42, 'practice')).toBe(42);
  });

  test('the clock runs only while a question waits, and the round ends at zero', () => {
    let round = createRound({ level: 'easy', mode: 'timed', rng: createRng(2) });
    expect(round.timeLeft).toBe(ROUND_SECONDS);
    round = tick(round, 10).round;
    expect(round.timeLeft).toBeCloseTo(50);
    round = pressKey(type(round, round.question.answer + 1).round, OK).round;
    expect(round.timeLeft).toBeCloseTo(47);
    // The correction is on screen: the clock waits.
    round = tick(round, 0.5).round;
    expect(round.timeLeft).toBeCloseTo(47);
    round = settle(round).round;
    expect(round.phase).toBe('question');
    const end = tick(round, 100);
    expect(end.events).toEqual(['end']);
    expect(end.round.phase).toBe('over');
    expect(end.round.timeLeft).toBe(0);
    expect(end.round.elapsed).toBeCloseTo(60 - WRONG_PENALTY);
  });

  test('a penalty that empties the clock ends the round after the correction', () => {
    let round = createRound({ level: 'easy', mode: 'timed', rng: createRng(3), seconds: 5 });
    round = tick(round, 3).round;
    round = pressKey(type(round, round.question.answer + 1).round, OK).round;
    expect(round.timeLeft).toBe(0);
    expect(round.phase).toBe('feedback');
    expect(settle(round).events).toEqual(['end']);
  });

  test('practice never ends by itself; the player ends it', () => {
    let round = createRound({ level: 'medium', mode: 'practice', rng: createRng(4) });
    round = tick(round, 1000).round;
    expect(round.phase).toBe('question');
    expect(endRound(round).events).toEqual(['end']);
  });
});

describe('typing and auto-submit', () => {
  test('digits, backspace, no leading zeros, a length limit', () => {
    expect(applyKey('', digit(0), false)).toBe('0');
    expect(applyKey('0', digit(5), false)).toBe('5');
    expect(applyKey('12', { kind: 'back' }, false)).toBe('1');
    expect(applyKey('1234', digit(5), false)).toBe('1234');
  });

  test('the minus sign only where results can be negative (Trudny)', () => {
    expect(applyKey('12', { kind: 'minus' }, false)).toBe('12');
    expect(applyKey('12', { kind: 'minus' }, true)).toBe('-12');
    expect(applyKey('-12', { kind: 'minus' }, true)).toBe('12');
    expect(applyKey('-123', digit(4), true)).toBe('-123');
  });

  test('a right answer is taken the moment it is typed; a wrong one waits for OK', () => {
    expect(shouldAutoSubmit('56', 56)).toBe(true);
    expect(shouldAutoSubmit('5', 56)).toBe(false);
    expect(shouldAutoSubmit('-4', -4)).toBe(true);
    expect(shouldAutoSubmit('4', -4)).toBe(false);

    const round = createRound({ level: 'easy', mode: 'timed', rng: createRng(9) });
    const typed = type(round, round.question.answer);
    expect(typed.events.at(-1)).toBe('correct');
    expect(typed.round.phase).toBe('feedback');

    const wrong = type(round, round.question.answer + 1);
    expect(wrong.events).not.toContain('wrong');
    expect(wrong.round.phase).toBe('question');
    expect(pressKey(round, OK).events).toEqual([]); // OK with nothing typed does nothing
  });

  test('keys typed during the feedback go to the next question (buffered, bounded)', () => {
    let round = createRound({ level: 'easy', mode: 'timed', rng: createRng(11) });
    round = type(round, round.question.answer).round;
    expect(round.phase).toBe('feedback');
    for (let i = 0; i < BUFFER_LIMIT + 3; i++) round = pressKey(round, digit(1)).round;
    expect(round.buffer).toHaveLength(BUFFER_LIMIT);

    let fresh = createRound({ level: 'easy', mode: 'timed', rng: createRng(12) });
    fresh = type(fresh, fresh.question.answer).round;
    fresh = pressKey(fresh, digit(7)).round;
    const next = tick(fresh, FEEDBACK_SECONDS.correct + 0.01);
    expect(next.events[0]).toBe('next');
    if (next.round.question.answer !== 7) expect(next.round.typed).toBe('7');
    else expect(next.round.phase).toBe('feedback');
  });
});

describe('results and records', () => {
  test('accuracy and answers per minute', () => {
    let round = createRound({ level: 'easy', mode: 'timed', rng: createRng(13) });
    for (let i = 0; i < 3; i++) {
      round = tick(round, 5).round;
      round = settle(type(round, round.question.answer).round).round;
    }
    round = settle(pressKey(type(round, round.question.answer + 1).round, OK).round).round;
    round = tick(round, 15).round;
    expect(roundStats(round)).toEqual({ accuracy: 75, perMinute: 6, correct: 3, answered: 4, maxStreak: 3 });
    expect(roundStats(createRound({ level: 'easy', mode: 'timed', rng: createRng(1) }))).toMatchObject({ accuracy: 0, perMinute: 0 });
  });

  test('the best per level is kept under its own key only, and only goes up', () => {
    const data = new Map<string, string>([['lifexp-theme', 'dark']]);
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    expect(readBest(storage, 'medium')).toBe(0);
    expect(saveBest(storage, 'medium', 120)).toEqual({ best: 120, isNew: true });
    expect(saveBest(storage, 'medium', 80)).toEqual({ best: 120, isNew: false });
    expect(saveBest(storage, 'medium', 120)).toEqual({ best: 120, isNew: false });
    expect(readBest(storage, 'medium')).toBe(120);
    expect(readBest(storage, 'easy')).toBe(0);
    expect(recordKey('hard')).toBe(`${RECORD_PREFIX}hard`);
    expect([...data.keys()].sort()).toEqual(['lifexp-quickmath-best-medium', 'lifexp-theme']);
    expect(data.get('lifexp-theme')).toBe('dark');
  });

  test('blocked or broken storage reads as no record and does not throw', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(readBest(broken, 'easy')).toBe(0);
    expect(saveBest(broken, 'easy', 10)).toEqual({ best: 10, isNew: true });
    expect(readBest({ getItem: () => 'abc', setItem: () => undefined }, 'easy')).toBe(0);
    expect(readBest(null, 'easy')).toBe(0);
  });
});

describe('language and test switches', () => {
  test('Polish unless ?lang=en, with placeholders filled', () => {
    expect(pickLang('?lang=en')).toBe('en');
    expect(pickLang('')).toBe('pl');
    expect(translator('pl')('wrong', { q: '7 × 8', a: 56 })).toBe('Poprawnie: 7 × 8 = 56');
    expect(translator('en')('seconds', { n: 60 })).toBe('60 s');
  });

  test('?round= only together with ?seed=, within bounds', () => {
    expect(testParams('?seed=4&round=8')).toEqual({ seed: 4, round: 8 });
    expect(testParams('?round=8')).toEqual({ seed: null, round: null });
    expect(testParams('?seed=4&round=1')).toEqual({ seed: 4, round: 3 });
    expect(testParams('?seed=x')).toEqual({ seed: null, round: null });
  });
});
