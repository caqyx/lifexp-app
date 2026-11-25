/*
 * LifeXP patches for War Time (docs/v2/VENDOR-PATCHES.md). Not part of the upstream game:
 * scripts/vendor-game.mjs copies this file into the vendored copy and loads it after the game's
 * scripts (before js/main.js). Plain script on `window`, like the game; it also runs in node
 * (v2/tests/wartime.test.ts).
 *
 *  1. Missions (and achievements) complete the moment they are met. The game checked them only in the end-of-turn
 *     step (WT.goals.processTurn), so provinces won in a peace treaty or a land deal showed
 *     "7 / 6" until the next end of turn. Now every change of ownership, peace, annexation and
 *     vassalage re-checks them at once, every player input (tap, click, key) right after it is
 *     handled (God Mode buildings, research, answered events), and so does loading a save (a save
 *     already past a target completes on load). The end-of-turn check stays as a safety net.
 *  2. Random-event settings (WT.lifexpEvents): each random event, elections, historical events,
 *     rebellions and coalition wars can be switched off; the random ones, rebellions and
 *     coalitions also get a frequency (rare ×0.5 / normal ×1 / often ×2 of the game's own
 *     chance), and rebellions a strength (mild ×0.6 / normal / harsh ×1.5 of the rebel army).
 *     Defaults are the game's behaviour exactly. Stored in this browser (`wartime_lifexp_events`,
 *     versioned), so they apply to every game, new or loaded, and a running game picks a change
 *     up at once (they are read when an event is rolled). They apply to every country, not only
 *     the player's.
 */
(function (root) {
  'use strict';
  var WT = root.WT;
  if (!WT || !WT.state || !WT.goals || !WT.world) return;

  var P = WT.lifexpPatches = { missionsLive: true, eventsLive: true };

  // ===========================================================================
  // 1. Missions checked as soon as their inputs change
  // ===========================================================================
  var checking = false, settingUp = false;
  function checkMissionsNow() {
    var g = WT.G;
    if (!P.missionsLive || checking || settingUp || !g || g.gameOver || typeof WT.goals.checkMissions !== 'function') return;
    var c = g.countries && g.countries[g.player];
    if (!c || !c.alive) return;
    checking = true;
    try {
      // Missions are made on first use (goals panel or the first end of turn); never invent them mid-action.
      if (g.missions) WT.goals.checkMissions();
      if (typeof WT.goals.checkAchievements === 'function') WT.goals.checkAchievements();
    } finally { checking = false; }
  }
  P.checkMissionsNow = checkMissionsNow;

  var newGame = WT.state.newGame;
  WT.state.newGame = function lifexpNewGame() {
    settingUp = true;
    try { return newGame.apply(this, arguments); } finally { settingUp = false; }
  };
  var setOwner = WT.state.setOwner;
  WT.state.setOwner = function lifexpSetOwner() {
    var result = setOwner.apply(this, arguments);
    checkMissionsNow();
    return result;
  };
  // Loading a save (WT.save.load / importJSON) and starting a game end with goals.attach().
  var attach = WT.goals.attach;
  WT.goals.attach = function lifexpAttach() {
    var result = attach.apply(this, arguments);
    checkMissionsNow();
    return result;
  };
  var emit = WT.events.emit;
  var RECHECK_ON = { peace: 1, annex: 1, vassal: 1, released: 1, goal: 1 };
  WT.events.emit = function lifexpEmit(name) {
    var result = emit.apply(this, arguments);
    if (RECHECK_ON[name]) checkMissionsNow();
    return result;
  };

  // Anything else the player does (God Mode instant buildings, research, answering an event,
  // a deal…) is followed by a check right after the input is handled.
  var queued = false;
  function afterInput() {
    if (queued) return;
    queued = true;
    setTimeout(function () { queued = false; checkMissionsNow(); }, 0);
  }
  P.afterInput = afterInput;
  if (typeof root.addEventListener === 'function') {
    ['click', 'change', 'keyup', 'pointerup'].forEach(function (type) { root.addEventListener(type, afterInput, true); });
  }

  // ===========================================================================
  // 2. Random-event settings
  // ===========================================================================
  var KEY = 'wartime_lifexp_events', VERSION = 1;
  var FREQ = { rare: 0.5, normal: 1, often: 2 };
  var STRENGTH = { mild: 0.6, normal: 1, harsh: 1.5 };
  var RANDOM = WT.world.EVENTS.map(function (e) { return e.id; });
  var OTHER = ['revolt', 'coalition', 'election', 'history'];
  var IDS = RANDOM.concat(OTHER);
  var HAS_FREQ = {}; RANDOM.concat(['revolt', 'coalition']).forEach(function (id) { HAS_FREQ[id] = true; });
  var HAS_STRENGTH = { revolt: true };

  function storage() { try { return root.localStorage || null; } catch (e) { return null; } }
  function defaults() { return { on: true, freq: 'normal', strength: 'normal' }; }
  function clean(saved) {
    var out = defaults();
    if (saved && typeof saved === 'object') {
      if (typeof saved.on === 'boolean') out.on = saved.on;
      if (FREQ[saved.freq]) out.freq = saved.freq;
      if (STRENGTH[saved.strength]) out.strength = saved.strength;
    }
    return out;
  }
  var settings = {};
  function reload() {
    var saved = null, s = storage();
    try { saved = s ? JSON.parse(s.getItem(KEY) || 'null') : null; } catch (e) { saved = null; }
    var events = saved && saved.v === VERSION && saved.events && typeof saved.events === 'object' ? saved.events : {};
    settings = {};
    IDS.forEach(function (id) { settings[id] = clean(events[id]); });
  }
  function persist() {
    var s = storage(); if (!s) return;
    try { s.setItem(KEY, JSON.stringify({ v: VERSION, events: settings })); } catch (e) { /* full or blocked storage: kept for this session */ }
  }
  function get(id) { var x = settings[id] || defaults(); return { on: x.on, freq: x.freq, strength: x.strength }; }
  function set(id, change) {
    if (IDS.indexOf(id) < 0) return;
    var next = get(id);
    Object.keys(change || {}).forEach(function (k) { next[k] = change[k]; });
    settings[id] = clean(next);
    persist();
  }
  function reset() { settings = {}; IDS.forEach(function (id) { settings[id] = defaults(); }); persist(); }
  function live() { return P.eventsLive; }
  function enabled(id) { return !live() || get(id).on; }
  /** Multiplier of the game's own chance: 0 when off. */
  function chance(id) { if (!live()) return 1; var x = get(id); return x.on ? (HAS_FREQ[id] ? FREQ[x.freq] : 1) : 0; }
  function strength(id) { return live() && HAS_STRENGTH[id] ? STRENGTH[get(id).strength] : 1; }
  function isDefault() {
    return IDS.every(function (id) { var x = get(id); return x.on && x.freq === 'normal' && x.strength === 'normal'; });
  }
  function randomDefault() { return RANDOM.every(function (id) { return chance(id) === 1; }); }

  /**
   * The world's random-event roll for one country, when some random event is not at its default
   * (with defaults the game's own code runs, so the same seed gives the same game). Per-event
   * chance = game chance × weight / eligible weight × multiplier, as the game computes it.
   * Returns true when it handled the roll.
   */
  function rollFor(cc, playerChance, playerGap, aiChance) {
    if (!live() || randomDefault()) return false;
    var g = WT.G, U = WT.util, W = WT.world, player = cc === g.player;
    if (player && (W.pending().length || g.turn - (g.lastEventTurn != null ? g.lastEventTurn : -99) < playerGap)) return true;
    var ok = W.EVENTS.filter(function (ev) { return ev.cond(cc); });
    var base = ok.reduce(function (s, ev) { return s + ev.w; }, 0);
    var weighted = ok.map(function (ev) { return ev.w * chance(ev.id); });
    var sum = weighted.reduce(function (s, w) { return s + w; }, 0);
    if (!base || !sum || !U.chance(Math.min(1, (player ? playerChance : aiChance) * sum / base))) return true;
    var r = U.rand() * sum;
    for (var i = 0; i < ok.length; i++) { r -= weighted[i]; if (weighted[i] > 0 && r <= 0) { W.fire(ok[i], cc); return true; } }
    return true;
  }

  // ----- settings UI (in the game's "Ustawienia gry" window) -----
  var EN = {
    title: 'Random events', hint: 'For every country, from now on, also in this game; remembered in this browser.',
    reset: 'Restore defaults', on: 'On', freq: 'How often', strength: 'Strength',
    rare: 'Rarely', normal: 'Normal', often: 'Often', mild: 'Mild', medium: 'Normal', harsh: 'Harsh',
    names: { crisis: 'Financial crisis', boom: 'Economic boom', strike: 'General strike', disaster: 'Natural disaster', epidemic: 'Epidemic',
      deposits: 'Mineral discovery', science: 'Scientific breakthrough', volunteers: 'Wave of volunteers', desertion: 'Desertion at the front',
      scandal: 'Corruption scandal', revolution: 'Revolution', revolt: 'Rebellions in restless provinces', coalition: 'Coalition wars against aggressors',
      election: 'Elections in democracies', history: 'Historical events (scenarios)' }
  };
  var PL = {
    title: 'Wydarzenia losowe', hint: 'Dla wszystkich państw, od razu, także w tej grze; zapamiętane w tej przeglądarce.',
    reset: 'Przywróć domyślne', on: 'Włączone', freq: 'Jak często', strength: 'Siła',
    rare: 'Rzadko', normal: 'Normalnie', often: 'Często', mild: 'Łagodny', medium: 'Normalny', harsh: 'Ostry',
    names: { revolt: 'Bunty w niespokojnych prowincjach', coalition: 'Wojny koalicji przeciw agresorom', election: 'Wybory w demokracjach', history: 'Wydarzenia historyczne (scenariusze)' }
  };
  function lang() {
    try { return /(?:^|[?&])lang=en\b/.test(root.location.search) ? EN : PL; } catch (e) { return PL; }
  }
  function nameOf(id, t) {
    if (t.names[id]) return t.names[id];
    var ev = WT.world.EVENTS.filter(function (e) { return e.id === id; })[0];
    return ev ? ev.title : id;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  function segHtml(id, kind, values, current, t) {
    var label = function (v) { return kind === 'strength' && v === 'normal' ? t.medium : t[v]; };
    return '<div class="seg lx-ev-seg" role="radiogroup" aria-label="' + esc(t[kind] + ': ' + nameOf(id, t)) + '">' + values.map(function (v) {
      return '<button type="button" class="seg-btn' + (v === current ? ' on' : '') + '" role="radio" aria-checked="' + (v === current) + '" data-ev="' + id + '" data-kind="' + kind + '" data-val="' + v + '">' + esc(label(v)) + '</button>';
    }).join('') + '</div>';
  }
  function rowHtml(id, t) {
    var x = get(id);
    var h = '<div class="lx-ev-row' + (x.on ? '' : ' off') + '" data-row="' + id + '">' +
      '<label class="check"><span>' + esc(nameOf(id, t)) + '</span><input type="checkbox" data-ev="' + id + '" data-kind="on"' + (x.on ? ' checked' : '') + '></label>';
    if (HAS_FREQ[id]) h += '<div class="lx-ev-opt"><span class="lx-ev-lbl">' + esc(t.freq) + '</span>' + segHtml(id, 'freq', ['rare', 'normal', 'often'], x.freq, t) + '</div>';
    if (HAS_STRENGTH[id]) h += '<div class="lx-ev-opt"><span class="lx-ev-lbl">' + esc(t.strength) + '</span>' + segHtml(id, 'strength', ['mild', 'normal', 'harsh'], x.strength, t) + '</div>';
    return h + '</div>';
  }
  function render(box) {
    var t = lang();
    box.innerHTML = '<div class="section-title">' + esc(t.title) + '</div><p class="hint lx-ev-hint">' + esc(t.hint) + '</p>' +
      OTHER.concat(RANDOM).map(function (id) { return rowHtml(id, t); }).join('') +
      '<button type="button" class="btn lx-ev-reset">' + esc(t.reset) + '</button>';
  }
  function mountSettings(body) {
    if (!body || !body.ownerDocument) return;
    var box = body.ownerDocument.createElement('div');
    box.className = 'lx-ev';
    box.id = 'lx-events';
    render(box);
    box.addEventListener('change', function (e) {
      var el = e.target;
      if (el.getAttribute('data-kind') !== 'on') return;
      set(el.getAttribute('data-ev'), { on: el.checked });
      el.closest('.lx-ev-row').classList.toggle('off', !el.checked);
    });
    box.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      if (btn.classList.contains('lx-ev-reset')) { reset(); render(box); return; }
      var id = btn.getAttribute('data-ev'), kind = btn.getAttribute('data-kind'), val = btn.getAttribute('data-val');
      if (!id || !kind || !val) return;
      var change = {}; change[kind] = val;
      set(id, change);
      btn.parentNode.querySelectorAll('.seg-btn').forEach(function (b) {
        var on = b === btn; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on));
      });
    });
    body.appendChild(box);
  }

  reload();
  WT.lifexpEvents = {
    IDS: IDS, RANDOM: RANDOM, FREQ: FREQ, STRENGTH: STRENGTH,
    reload: reload, get: get, set: set, reset: reset, enabled: enabled, chance: chance, strength: strength,
    isDefault: isDefault, rollFor: rollFor, mountSettings: mountSettings
  };
})(typeof window !== 'undefined' ? window : globalThis);
