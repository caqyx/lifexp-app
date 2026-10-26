// @ts-check
// Szybkie liczenie: one round (docs/v2/PLAN.md 9.1, stage g-4). Pure: keys and time in,
// the next round and what happened (events) out; main.js draws it.
//
//   question ──correct──▶ feedback (short) ──▶ question …
//            ──wrong────▶ feedback (the correct answer shown, −3 s) ──▶ question …
//   timed: the clock runs only while a question waits; at 0 the round is over.
//   practice ("Trening"): no clock; the player ends it.
import { ALLOWS_NEGATIVE, BASE_POINTS, nextQuestion } from './questions.js';

/** @typedef {import('./questions.js').Level} Level */
/** @typedef {import('./questions.js').Question} Question */
/** @typedef {'timed' | 'practice'} Mode */
/** @typedef {'digit' | 'minus' | 'back' | 'ok'} KeyKind */
/** @typedef {{ kind: KeyKind, digit?: number }} Key */
/** @typedef {'typed' | 'correct' | 'wrong' | 'next' | 'end'} RoundEvent */

export const ROUND_SECONDS = 60;
export const WRONG_PENALTY = 3;
/** How long the result stays: a correct one only flashes; a wrong one shows the answer. */
export const FEEDBACK_SECONDS = { correct: 0.18, wrong: 1.1 };
/** Keys typed during the feedback wait for the next question, up to this many. */
export const BUFFER_LIMIT = 4;
export const MAX_TYPED = 4;

/**
 * @typedef {{
 *   level: Level,
 *   mode: Mode,
 *   total: number,
 *   timeLeft: number,
 *   elapsed: number,
 *   phase: 'question' | 'feedback' | 'over',
 *   question: Question,
 *   typed: string,
 *   score: number,
 *   streak: number,
 *   maxStreak: number,
 *   answered: number,
 *   correct: number,
 *   lastPoints: number,
 *   feedback: { kind: 'correct' | 'wrong', left: number, question: Question, typed: string } | null,
 *   buffer: Key[],
 *   rng: () => number,
 * }} Round
 */

/**
 * @param {{ level: Level, mode: Mode, rng: () => number, seconds?: number }} options
 * @returns {Round}
 */
export function createRound({ level, mode, rng, seconds = ROUND_SECONDS }) {
  return {
    level,
    mode,
    total: seconds,
    timeLeft: seconds,
    elapsed: 0,
    phase: 'question',
    question: nextQuestion(level, rng, null),
    typed: '',
    score: 0,
    streak: 0,
    maxStreak: 0,
    answered: 0,
    correct: 0,
    lastPoints: 0,
    feedback: null,
    buffer: [],
    rng,
  };
}

// ── Scoring ──────────────────────────────────────────────────────────────────

/**
 * The combo: ×1 for the first answers, then ×2 from 3 in a row, ×3 from 6, ×4 from 10.
 * @param {number} streak correct answers in a row, this one included
 */
export function multiplierFor(streak) {
  if (streak >= 10) return 4;
  if (streak >= 6) return 3;
  if (streak >= 3) return 2;
  return 1;
}

/** @param {Level} level @param {number} streak */
export function pointsFor(level, streak) {
  return BASE_POINTS[level] * multiplierFor(streak);
}

/**
 * The clock after a wrong answer (never below zero; practice has none).
 * @param {number} timeLeft @param {Mode} mode
 */
export function applyPenalty(timeLeft, mode) {
  return mode === 'timed' ? Math.max(0, timeLeft - WRONG_PENALTY) : timeLeft;
}

// ── Typing ───────────────────────────────────────────────────────────────────

/**
 * The typed text after one key (digits, the minus sign at the front, backspace).
 * @param {string} typed @param {Key} key @param {boolean} allowNegative
 */
export function applyKey(typed, key, allowNegative) {
  if (key.kind === 'back') return typed.slice(0, -1);
  if (key.kind === 'minus') {
    if (!allowNegative) return typed;
    return typed.startsWith('-') ? typed.slice(1) : `-${typed}`;
  }
  if (key.kind !== 'digit' || key.digit === undefined) return typed;
  const digits = typed.replace('-', '');
  if (digits.length >= MAX_TYPED - (typed.startsWith('-') ? 1 : 0)) return typed;
  // No leading zeros: "0" then "5" is "5".
  const next = digits === '0' ? String(key.digit) : digits + String(key.digit);
  return typed.startsWith('-') ? `-${next}` : next;
}

/** @param {string} typed @returns {number | null} */
export function typedValue(typed) {
  return /^-?\d+$/.test(typed) ? Number(typed) : null;
}

/**
 * Auto-submit: the answer is taken the moment the typed number equals it, so a right
 * answer never waits for OK. A wrong one is only taken with OK: the player is never
 * cut off mid-number (typing 1 on the way to 12 when the answer is 1 is still right).
 * @param {string} typed @param {number} answer
 */
export function shouldAutoSubmit(typed, answer) {
  return typedValue(typed) === answer;
}

// ── Steps ────────────────────────────────────────────────────────────────────

/**
 * @param {Round} round
 * @returns {{ round: Round, events: RoundEvent[] }}
 */
function submit(round) {
  const value = typedValue(round.typed);
  if (value === null) return { round, events: [] };
  const answered = round.answered + 1;
  if (value === round.question.answer) {
    const streak = round.streak + 1;
    const points = pointsFor(round.level, streak);
    return {
      round: {
        ...round,
        phase: 'feedback',
        feedback: { kind: 'correct', left: FEEDBACK_SECONDS.correct, question: round.question, typed: round.typed },
        score: round.score + points,
        lastPoints: points,
        streak,
        maxStreak: Math.max(round.maxStreak, streak),
        answered,
        correct: round.correct + 1,
      },
      events: ['correct'],
    };
  }
  return {
    round: {
      ...round,
      phase: 'feedback',
      feedback: { kind: 'wrong', left: FEEDBACK_SECONDS.wrong, question: round.question, typed: round.typed },
      timeLeft: applyPenalty(round.timeLeft, round.mode),
      lastPoints: 0,
      streak: 0,
      answered,
    },
    events: ['wrong'],
  };
}

/**
 * A key from the keypad or the keyboard. During the feedback it is kept for the next question.
 * @param {Round} round @param {Key} key
 * @returns {{ round: Round, events: RoundEvent[] }}
 */
export function pressKey(round, key) {
  if (round.phase === 'over') return { round, events: [] };
  if (round.phase === 'feedback') {
    if (round.buffer.length >= BUFFER_LIMIT) return { round, events: [] };
    return { round: { ...round, buffer: [...round.buffer, key] }, events: [] };
  }
  if (key.kind === 'ok') return submit(round);
  const typed = applyKey(round.typed, key, ALLOWS_NEGATIVE[round.level]);
  if (typed === round.typed) return { round, events: [] };
  const next = { ...round, typed };
  if (shouldAutoSubmit(typed, round.question.answer)) {
    const done = submit(next);
    return { round: done.round, events: ['typed', ...done.events] };
  }
  return { round: next, events: ['typed'] };
}

/**
 * After the feedback: the next question, with the keys typed meanwhile already in it.
 * @param {Round} round
 * @returns {{ round: Round, events: RoundEvent[] }}
 */
function advance(round) {
  if (round.mode === 'timed' && round.timeLeft <= 0) return endRound(round);
  /** @type {Round} */
  let next = {
    ...round,
    phase: 'question',
    feedback: null,
    question: nextQuestion(round.level, round.rng, round.question.key),
    typed: '',
    buffer: [],
  };
  /** @type {RoundEvent[]} */
  const events = ['next'];
  for (const key of round.buffer) {
    const step = pressKey(next, key);
    next = step.round;
    events.push(...step.events);
  }
  return { round: next, events };
}

/**
 * The round is over (time is up, or the player ended practice).
 * @param {Round} round
 * @returns {{ round: Round, events: RoundEvent[] }}
 */
export function endRound(round) {
  if (round.phase === 'over') return { round, events: [] };
  return { round: { ...round, phase: 'over', feedback: null, buffer: [], timeLeft: Math.max(0, round.timeLeft) }, events: ['end'] };
}

/**
 * Time passes: the clock (only while a question waits) and the feedback.
 * @param {Round} round @param {number} dt seconds
 * @returns {{ round: Round, events: RoundEvent[] }}
 */
export function tick(round, dt) {
  if (round.phase === 'over' || dt <= 0) return { round, events: [] };
  if (round.phase === 'feedback' && round.feedback) {
    const left = round.feedback.left - dt;
    if (left > 0) return { round: { ...round, feedback: { ...round.feedback, left } }, events: [] };
    return advance(round);
  }
  const elapsed = round.elapsed + dt;
  if (round.mode === 'practice') return { round: { ...round, elapsed }, events: [] };
  const timeLeft = round.timeLeft - dt;
  if (timeLeft <= 0) return endRound({ ...round, elapsed: elapsed + timeLeft, timeLeft: 0 });
  return { round: { ...round, elapsed, timeLeft }, events: [] };
}

// ── Results ──────────────────────────────────────────────────────────────────

/**
 * Accuracy (0–100, whole) and correct answers per minute of play.
 * @param {Round} round
 */
export function roundStats(round) {
  const accuracy = round.answered ? Math.round((round.correct / round.answered) * 100) : 0;
  const minutes = round.elapsed / 60;
  const perMinute = minutes > 0 ? Math.round((round.correct / minutes) * 10) / 10 : 0;
  return { accuracy, perMinute, correct: round.correct, answered: round.answered, maxStreak: round.maxStreak };
}
