// @ts-check
// Szybkie liczenie, LifeXP's own game (docs/v2/PLAN.md 9.1, stage g-4). This module
// wires the pure parts (questions.js, round.js, records.js) to the page: the three
// screens, the keypad and the keyboard, the clock, the feedback and the records.
//
// It runs in GameHost's frame on LifeXP's origin, with a CSP that allows only this
// origin. It touches only its own localStorage keys (lifexp-quickmath-*).
// Query: ?lang=pl|en (from GameHost); ?seed=<n> repeats the questions and puts the
// answer on the page (data-debug-answer), and with it ?round=<s> shortens the round:
// both for the browser test only.
import { LEVELS, createRng, formatNumber, formatQuestion, spokenQuestion } from './questions.js';
import { readBest, saveBest } from './records.js';
import { pickLang, testParams, translator } from './i18n.js';
import { ROUND_SECONDS, WRONG_PENALTY, createRound, endRound, multiplierFor, pressKey, roundStats, tick } from './round.js';

/** @typedef {import('./questions.js').Level} Level */
/** @typedef {import('./round.js').Round} Round */
/** @typedef {import('./round.js').Mode} Mode */
/** @typedef {import('./round.js').Key} Key */
/** @typedef {import('./round.js').RoundEvent} RoundEvent */

const MODE_KEY = 'lifexp-quickmath-mode';
/** A frame longer than this (a stalled tab) counts as this much. */
const MAX_FRAME = 0.1;
const LOW_TIME = 10;

// ── Setup ────────────────────────────────────────────────────────────────────

/** @param {string} id @returns {HTMLElement} */
function byId(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el;
}

function findElements() {
  return {
    app: byId('app'),
    roundLength: byId('round-length'),
    playLevel: byId('play-level'),
    score: byId('score'),
    combo: byId('combo'),
    comboMult: byId('combo-mult'),
    time: byId('time'),
    timerFill: byId('timer-fill'),
    endPractice: byId('end-practice'),
    card: byId('card'),
    questionText: byId('question-text'),
    questionSpoken: byId('question-spoken'),
    answer: byId('answer'),
    answerWrong: byId('answer-wrong'),
    feedback: byId('feedback'),
    pointsPop: byId('points-pop'),
    keypad: byId('keypad'),
    endTitle: byId('end-title'),
    endLevel: byId('end-level'),
    endScore: byId('end-score'),
    endAccuracy: byId('end-accuracy'),
    endPerMinute: byId('end-per-minute'),
    endStreak: byId('end-streak'),
    again: byId('again'),
    change: byId('change'),
  };
}

function storage() {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

/** @returns {Mode} */
function loadMode() {
  try {
    return localStorage.getItem(MODE_KEY) === 'practice' ? 'practice' : 'timed';
  } catch {
    return 'timed';
  }
}

/** @param {Mode} mode */
function saveMode(mode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Storage blocked: the choice lasts for this visit.
  }
}

function randomSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
}

const lang = pickLang(location.search);
const t = translator(lang);
const test = testParams(location.search);
const rng = createRng(test.seed ?? randomSeed());
const roundSeconds = test.round ?? ROUND_SECONDS;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const dom = findElements();

const state = {
  mode: loadMode(),
  level: /** @type {Level} */ ('easy'),
  round: /** @type {Round | null} */ (null),
  newBest: false,
};
const clock = { frame: 0, last: /** @type {number | null} */ (null), running: false };

/** @param {import('./i18n.js').Translate} translate */
function applyTexts(translate) {
  document.documentElement.lang = lang;
  document.title = translate('title');
  for (const el of document.querySelectorAll('[data-t]')) {
    el.textContent = translate(/** @type {import('./i18n.js').TextKey} */ (el.getAttribute('data-t')));
  }
  for (const el of document.querySelectorAll('[data-t-label]')) {
    el.setAttribute('aria-label', translate(/** @type {import('./i18n.js').TextKey} */ (el.getAttribute('data-t-label'))));
  }
  dom.roundLength.textContent = `· ${translate('seconds', { n: roundSeconds })}`;
}

// ── Screens ──────────────────────────────────────────────────────────────────

/**
 * Shows a screen and moves the focus onto its first action (not on the first load: the
 * page opens without a focus ring; keyboard players have 1, 2, 3 there).
 * @param {'start' | 'play' | 'end'} screen @param {{ focus?: boolean }} options
 */
function showScreen(screen, { focus = true } = {}) {
  dom.app.dataset.screen = screen;
  if (!focus) return;
  const first = /** @type {HTMLElement | null} */ (
    screen === 'start' ? document.querySelector(`.level[data-level="${state.level}"]`) : screen === 'end' ? dom.again : null
  );
  first?.focus({ preventScroll: true });
}

function renderBests() {
  for (const el of document.querySelectorAll('[data-best]')) {
    el.textContent = String(readBest(storage(), /** @type {Level} */ (el.getAttribute('data-best'))));
  }
}

function renderMode() {
  for (const el of document.querySelectorAll('[data-mode]')) {
    el.setAttribute('aria-checked', String(el.getAttribute('data-mode') === state.mode));
  }
}

// ── The round on screen ──────────────────────────────────────────────────────

const OP_WORDS = () => ({ '+': t('op.+'), '-': t('op.-'), '*': t('op.*'), '/': t('op./') });

/** @param {Round} round */
function renderQuestion(round) {
  dom.questionText.textContent = formatQuestion(round.question);
  dom.questionSpoken.textContent = `${spokenQuestion(round.question, OP_WORDS())} =`;
  if (test.seed !== null) dom.app.dataset.debugAnswer = String(round.question.answer);
}

/** @param {Round} round */
function renderAnswer(round) {
  dom.answer.textContent = round.typed.replace('-', '−');
  dom.card.classList.toggle('is-empty', round.typed === '');
}

/** @param {Round} round */
function renderHud(round) {
  dom.score.textContent = String(round.score);
  dom.comboMult.textContent = `×${multiplierFor(round.streak)}`;
  dom.combo.classList.toggle('is-active', round.streak >= 3);
  if (round.mode === 'timed') {
    const seconds = Math.ceil(round.timeLeft);
    const text = t('seconds', { n: seconds });
    if (dom.time.textContent !== text) dom.time.textContent = text;
    dom.timerFill.style.setProperty('--left', (round.timeLeft / round.total).toFixed(4));
    dom.app.classList.toggle('is-low', round.timeLeft <= LOW_TIME);
  }
}

/** @param {Keyframe[]} frames @param {HTMLElement} el @param {number} duration */
function animate(el, frames, duration) {
  if (reducedMotion.matches) return;
  el.animate(frames, { duration, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
}

/** @param {'correct' | 'wrong'} kind */
function flashCard(kind) {
  dom.card.classList.remove('is-correct', 'is-wrong');
  // Restart the CSS fade even when the same class comes twice in a row.
  void dom.card.offsetWidth;
  dom.card.classList.add(kind === 'correct' ? 'is-correct' : 'is-wrong');
}

/** @param {Round} round */
function showCorrect(round) {
  flashCard('correct');
  dom.feedback.textContent = t('correct');
  dom.pointsPop.textContent = `+${round.lastPoints}`;
  animate(dom.pointsPop, [
    { opacity: 0, transform: 'translateY(6px) scale(0.9)' },
    { opacity: 1, transform: 'translateY(-10px) scale(1)', offset: 0.35 },
    { opacity: 0, transform: 'translateY(-26px) scale(1)' },
  ], 650);
  if (round.streak >= 3) animate(dom.combo, [{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }], 260);
}

/** @param {Round} round */
function showWrong(round) {
  const feedback = round.feedback;
  if (!feedback) return;
  flashCard('wrong');
  dom.answerWrong.textContent = feedback.typed.replace('-', '−');
  dom.answer.textContent = formatNumber(feedback.question.answer);
  dom.card.classList.remove('is-empty');
  dom.card.classList.add('is-corrected');
  const correction = t('wrong', { q: formatQuestion(feedback.question), a: formatNumber(feedback.question.answer) });
  dom.feedback.textContent = round.mode === 'timed' ? `${correction} · ${t('penalty', { n: WRONG_PENALTY })}` : correction;
  animate(dom.card, [
    { transform: 'translateX(0)' },
    { transform: 'translateX(-6px)' },
    { transform: 'translateX(5px)' },
    { transform: 'translateX(-3px)' },
    { transform: 'translateX(0)' },
  ], 280);
}

function clearFeedback() {
  dom.feedback.textContent = '';
  dom.answerWrong.textContent = '';
  dom.card.classList.remove('is-corrected');
}

/** @param {RoundEvent[]} events */
function reactToEvents(events) {
  const round = state.round;
  if (!round || events.length === 0) return;
  for (const event of events) {
    if (event === 'typed') renderAnswer(round);
    if (event === 'correct') showCorrect(round);
    if (event === 'wrong') showWrong(round);
    if (event === 'next') {
      clearFeedback();
      renderQuestion(round);
      renderAnswer(round);
    }
    if (event === 'end') finishRound(round);
  }
  renderHud(round);
}

// ── Flow ─────────────────────────────────────────────────────────────────────

/** @param {Level} level */
function startRound(level) {
  state.level = level;
  state.round = createRound({ level, mode: state.mode, rng, seconds: roundSeconds });
  dom.app.dataset.mode = state.mode;
  dom.app.dataset.level = level;
  dom.app.classList.remove('is-low');
  dom.playLevel.textContent = t(`level.${level}`);
  clearFeedback();
  dom.card.classList.remove('is-correct', 'is-wrong');
  renderQuestion(state.round);
  renderAnswer(state.round);
  renderHud(state.round);
  showScreen('play');
  startLoop();
}

/** @param {Round} round */
function finishRound(round) {
  stopLoop();
  const stats = roundStats(round);
  const record = round.mode === 'timed' ? saveBest(storage(), round.level, round.score) : { best: 0, isNew: false };
  state.newBest = record.isNew && round.score > 0;
  dom.app.classList.toggle('is-new-best', state.newBest);
  dom.endTitle.textContent = round.mode === 'timed' ? t('timeUp') : t('practiceOver');
  dom.endLevel.textContent = `${t(`level.${round.level}`)} · ${round.mode === 'timed' ? t('timed') : t('practice')}`;
  dom.endScore.textContent = String(round.score);
  dom.endAccuracy.textContent = `${stats.accuracy}%`;
  const sub = document.createElement('span');
  sub.className = 'stats__sub';
  sub.textContent = `${stats.correct}/${stats.answered}`;
  dom.endAccuracy.append(sub);
  dom.endPerMinute.textContent = String(stats.perMinute).replace('.', lang === 'pl' ? ',' : '.');
  dom.endStreak.textContent = String(stats.maxStreak);
  for (const el of document.querySelectorAll('[data-record]')) {
    el.classList.toggle('is-current', el.getAttribute('data-record') === round.level);
  }
  renderBests();
  showScreen('end');
}

// ── Input ────────────────────────────────────────────────────────────────────

/** @param {string} name data-key of a keypad button @returns {Key | null} */
function keyFromName(name) {
  if (/^\d$/.test(name)) return { kind: 'digit', digit: Number(name) };
  if (name === 'back' || name === 'minus' || name === 'ok') return { kind: name };
  return null;
}

/** @param {Key} key */
function handleKey(key) {
  if (!state.round || dom.app.dataset.screen !== 'play') return;
  const step = pressKey(state.round, key);
  state.round = step.round;
  reactToEvents(step.events);
}

/** @param {PointerEvent} event */
function handleKeypadPointer(event) {
  const button = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (event.target).closest('[data-key]'));
  if (!button || event.button !== 0) return;
  // On pointerdown, not click: a fast tapper's keys are never lost to a double-tap delay.
  event.preventDefault();
  const key = keyFromName(button.getAttribute('data-key') ?? '');
  if (key) handleKey(key);
  button.classList.add('is-pressed');
}

/** @param {MouseEvent} event keyboard activation of a focused key (Enter/Space on it) */
function handleKeypadClick(event) {
  if (event.detail !== 0) return; // pointer clicks were taken at pointerdown
  const button = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (event.target).closest('[data-key]'));
  const key = button ? keyFromName(button.getAttribute('data-key') ?? '') : null;
  if (key) handleKey(key);
}

function releaseKeys() {
  for (const el of dom.keypad.querySelectorAll('.is-pressed')) el.classList.remove('is-pressed');
}

/** @param {KeyboardEvent} event @returns {Key | null} */
function keyFromKeyboard(event) {
  if (/^\d$/.test(event.key)) return { kind: 'digit', digit: Number(event.key) };
  if (event.key === 'Backspace') return { kind: 'back' };
  if (event.key === 'Enter') return { kind: 'ok' };
  if (event.key === '-' || event.key === '−') return { kind: 'minus' };
  return null;
}

/** @param {KeyboardEvent} event */
function handleKeyDown(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const screen = dom.app.dataset.screen;
  if (screen === 'start' && /^[123]$/.test(event.key)) {
    event.preventDefault();
    startRound(LEVELS[Number(event.key) - 1] ?? 'easy');
    return;
  }
  if (screen !== 'play') return;
  const key = keyFromKeyboard(event);
  if (!key) return;
  // Enter on a focused keypad button would also click it: the keyboard path takes it.
  event.preventDefault();
  handleKey(key);
}

/** @param {Mode} mode */
function chooseMode(mode) {
  state.mode = mode;
  saveMode(mode);
  renderMode();
}

/** @param {KeyboardEvent} event arrow keys move within the radio group */
function handleModeKeys(event) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  chooseMode(state.mode === 'timed' ? 'practice' : 'timed');
  /** @type {HTMLElement | null} */ (document.querySelector(`[data-mode="${state.mode}"]`))?.focus();
}

function bindInput() {
  for (const el of document.querySelectorAll('[data-mode]')) {
    el.addEventListener('click', () => chooseMode(/** @type {Mode} */ (el.getAttribute('data-mode'))));
    el.addEventListener('keydown', (event) => handleModeKeys(/** @type {KeyboardEvent} */ (event)));
  }
  for (const el of document.querySelectorAll('[data-level]')) {
    el.addEventListener('click', () => startRound(/** @type {Level} */ (el.getAttribute('data-level'))));
  }
  dom.keypad.addEventListener('pointerdown', handleKeypadPointer);
  dom.keypad.addEventListener('click', handleKeypadClick);
  addEventListener('pointerup', releaseKeys);
  addEventListener('pointercancel', releaseKeys);
  addEventListener('keydown', handleKeyDown);
  dom.endPractice.addEventListener('click', () => {
    if (!state.round) return;
    const step = endRound(state.round);
    state.round = step.round;
    reactToEvents(step.events);
  });
  dom.again.addEventListener('click', () => startRound(state.level));
  dom.change.addEventListener('click', () => {
    renderBests();
    showScreen('start');
  });
}

// ── Clock ────────────────────────────────────────────────────────────────────

/** @param {number} now */
function frame(now) {
  clock.frame = requestAnimationFrame(frame);
  const seconds = clock.last === null ? 0 : Math.min(MAX_FRAME, (now - clock.last) / 1000);
  clock.last = now;
  if (!state.round) return;
  const step = tick(state.round, seconds);
  state.round = step.round;
  reactToEvents(step.events);
  if (state.round.phase !== 'over') renderHud(state.round);
}

function startLoop() {
  if (clock.running) return;
  clock.running = true;
  clock.last = null;
  clock.frame = requestAnimationFrame(frame);
}

function stopLoop() {
  clock.running = false;
  cancelAnimationFrame(clock.frame);
}

/** A hidden tab stops the clock; the question waits (nobody can see it meanwhile). */
function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') stopLoop();
  else if (dom.app.dataset.screen === 'play') startLoop();
}

// ── Start ────────────────────────────────────────────────────────────────────

applyTexts(t);
renderMode();
renderBests();
bindInput();
document.addEventListener('visibilitychange', handleVisibilityChange);
showScreen('start', { focus: false });
