// [MODULE] CrazyGames SDK v3 — init, loading/gameplay lifecycle, ad helpers.
// [MODULE] Everything here is optional: the game must behave identically with no SDK at all
// [MODULE] (opened from disk, or hosted on GitHub Pages). Nothing in this file may throw.
// ── CRAZYGAMES SDK ──

let _cgSdk   = null;
let _cgReady = false;

// [2.0-sdk] Mirrors what we last told CrazyGames, so every call site can be written as a plain
// cgGameplayStart()/cgGameplayStop() and stay idempotent. showMenu() in particular fires on cold
// boot and from stats/PIN/modes/shop-close, where no gameplay was ever running — without this
// latch it would emit a stream of gameplayStop with no matching start.
let _cgGameplayActive = false;

// [2.0-sdk] loadingStop is requested by main.js's bootstrap tail, which runs synchronously at the
// end of page load — while init() is still awaiting. So the request is recorded and flushed once
// the SDK is actually ready; the latch keeps it to exactly one call.
let _cgLoadingStopWanted = false;
let _cgLoadingStopDone   = false;

// [2.0-notester] Same treatment for gameplayStart. init() resolves ~120ms after the game becomes
// interactive (measured), so a gameplayStart issued in that window would be dropped by the _cgReady
// guard and never retried — and because _cgGameplayActive would still read false, the matching stop
// would vanish too, leaving the whole session invisible to CrazyGames. Recording the intent costs
// one flag and removes the race.
let _cgGameplayStartWanted = false;

(async function initCrazyGamesSdk() {
  if (!window.CrazyGames || !window.CrazyGames.SDK) {
    console.log('[CrazyGames SDK] not present — running standalone');
    return; // opened from disk, or the CDN is unreachable. Game runs untouched.
  }
  _cgSdk = window.CrazyGames.SDK;

  try {
    await _cgSdk.init();
    // The environment gate is the important part. On any domain that isn't CrazyGames or
    // localhost the SDK loads fine and window.CrazyGames.SDK exists, but the environment is
    // 'disabled' and EVERY method call throws. A presence check alone would leave the game
    // throwing on every lifecycle event on GitHub Pages.
    const env = typeof _cgSdk.getEnvironment === 'function' ? _cgSdk.getEnvironment() : _cgSdk.environment;
    if (env !== 'local' && env !== 'crazygames') {
      console.log('[CrazyGames SDK] environment "' + env + '" — SDK calls disabled, running standalone');
      _cgSdk = null;
      return;
    }
    _cgReady = true;
    console.log('[CrazyGames SDK] initialized (environment: ' + env + ')');
    // loadingStart must come AFTER init. Calling it earlier — which is what you'd want, to catch
    // the whole load — makes the SDK log "CrazySDK is not initialized yet" to the console on every
    // single boot. Verified in the browser. A red error at startup is exactly what a submission
    // reviewer looks for, and the measurement is near-worthless here anyway: every script in this
    // game loads synchronously, so the real work is already done by the time init() resolves.
    try { _cgSdk.game.loadingStart(); } catch (e) {}
    _cgFlushLoadingStop();   // the bootstrap tail almost certainly already asked for this
    _cgFlushGameplayStart(); // ...and a very fast player may already be mid-run
  } catch (e) {
    console.warn('[CrazyGames SDK] init failed — running standalone', e);
    _cgReady = false;
    _cgSdk   = null;
  }
})();

function _cgFlushLoadingStop() {
  if (_cgLoadingStopDone || !_cgLoadingStopWanted || !_cgReady || !_cgSdk) return;
  _cgLoadingStopDone = true;
  try { _cgSdk.game.loadingStop(); } catch (e) {}
}

function cgLoadingStop() { // [2.0-sdk] game is interactive
  _cgLoadingStopWanted = true;
  _cgFlushLoadingStop();
}

function _cgFlushGameplayStart() {
  if (!_cgGameplayStartWanted || !_cgReady || !_cgSdk) return;
  _cgGameplayStartWanted = false;
  if (!alive) return; // the run ended while the SDK was still coming up — nothing left to report
  cgGameplayStart();
}

function cgGameplayStart() { // [2.0-sdk] player is actually playing
  if (_cgGameplayActive) return;
  if (!_cgReady || !_cgSdk) { _cgGameplayStartWanted = true; return; } // replayed by _cgFlushGameplayStart
  _cgGameplayActive = true;
  try { _cgSdk.game.gameplayStart(); } catch (e) {}
}

function cgGameplayStop() { // [2.0-sdk] menu, pause, death, world choice — anything that isn't play
  _cgGameplayStartWanted = false; // a stop always cancels a start that never got through
  if (!_cgReady || !_cgSdk || !_cgGameplayActive) return;
  _cgGameplayActive = false;
  try { _cgSdk.game.gameplayStop(); } catch (e) {}
}

// [2.0-sdk] Tab hidden / phone locked. gamePaused is already true during a player pause (pause.js
// sets it), so that check alone would do — _pausedByPlayer is kept alongside it because the two mean
// different things and a future change to either shouldn't silently couple them.
// [2.0-clean] tutorialActive is excluded for the same reason startGame() excludes it: the tutorial is
// onboarding, not gameplay. Without this, tabbing away and back mid-tutorial started reporting it as
// a live session — the one path that contradicted that decision.
document.addEventListener('visibilitychange', () => {
  if (!alive || gamePaused || _pausedByPlayer || tutorialActive) return;
  if (document.hidden) cgGameplayStop();
  else                 cgGameplayStart();
});

// ── ADS ───────────────────────────────────────────────────────────────────────
// Called from js/ads-rewards.js. Both helpers freeze the game through pauseGame()/resumeGame()
// (js/pause.js), which stops every timer with full elapsed-time accounting.
// Note pauseGame() early-returns when !alive — an ad shown from a death screen or the shop simply
// doesn't pause anything, which is correct, since nothing is running.
// Ads only serve under Full Launch; under Basic Launch the network side is a no-op, but the
// integration is complete either way.

// [2.0-adfix] requestAd can accept a request and then never call back at all — verified in the
// CrazyGames `local` environment, where a rewarded request fires adStarted and nothing follows, and
// reported on preview builds where clicking the button did nothing. Without a guard that leaves the
// game muted (_cgMuteAudio suspended the context), frozen (pauseGame never undone) and, for a
// midgame ad, permanently short of its death screen, because onDone is what puts it up.
//
// Two different waits, because they mean different things:
//   • no adStarted within AD_START_TIMEOUT_MS  → nothing is on screen, the ad never came. Bail.
//   • adStarted but no end within AD_WATCHDOG_MS → a real ad IS playing, so this must be long
//     enough never to cut a legitimate one short. It exists only so a hung ad can't strand the
//     game forever; it is not a timeout on the ad itself.
const AD_START_TIMEOUT_MS = 8000;
const AD_WATCHDOG_MS      = 120000;

// Wraps one ad request so exactly one outcome is ever delivered, whichever arrives first, and the
// game is always unmuted and unfrozen on the way out.
function _cgRunAd(type, onOk, onFail) {
  let settled = false, started = false, timer = null;
  const finish = (fn, arg) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    _cgMuteAudio(false);
    resumeGame();
    fn(arg);
  };
  timer = setTimeout(() => {
    console.warn('[CrazyGames] ' + type + ' ad never started — treating as unavailable');
    finish(onFail, 'unavailable');
  }, AD_START_TIMEOUT_MS);
  try {
    _cgSdk.ad.requestAd(type, {
      adStarted: () => {
        started = true;
        clearTimeout(timer);
        timer = setTimeout(() => {
          console.warn('[CrazyGames] ' + type + ' ad started but never ended — releasing the game');
          finish(onFail, 'incomplete');
        }, AD_WATCHDOG_MS);
        pauseGame(); _cgMuteAudio(true);
      },
      adFinished: () => finish(onOk),
      adError:    (e) => {
        console.warn('[CrazyGames] ' + type + ' ad error', e);
        finish(onFail, started ? 'incomplete' : 'unavailable');
      },
    });
  } catch (e) {
    console.warn('[CrazyGames] ' + type + ' ad threw', e);
    finish(onFail, 'unavailable');
  }
}

function cgShowMidgameAd(onDone) {
  if (!_cgReady || !_cgSdk) { onDone(); return; } // no SDK: carry on as if the ad finished
  // Either way the game must continue — a midgame ad owes the player nothing, so success and
  // failure land in the same place.
  _cgRunAd('midgame', onDone, onDone);
}

function cgShowRewardedAd(onReward, onDeclineOrFail) {
  if (!_cgReady || !_cgSdk) { onDeclineOrFail('unavailable'); return; } // no SDK: no ad, no reward
  _cgRunAd('rewarded', onReward, onDeclineOrFail);
}
