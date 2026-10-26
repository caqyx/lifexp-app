// [MODULE] Ad transactions — the three rewarded offers (2× payout, extra loot box, revive) and the
// [MODULE] random interstitial. This is the first file that actually CALLS the ad helpers built in
// [MODULE] js/sdk.js; everything here self-gates on _cgReady/_cgSdk, so with no SDK present the
// [MODULE] game behaves exactly as it did before this file existed: no buttons, no interstitials.
// [MODULE] Guiding rule: an ad is never the only route to anything. Every reward below is a top-up
// [MODULE] on something the player already earns for free.
// [MODULE] Load order: after sdk.js (ad helpers) and lootbox.js (_resolveBoxOpen), before main.js.
// ── AD REWARDS [2.0-ads] ──

const INTERSTITIAL_CHANCE      = 0.30;  // ~30% of deaths, when nothing else blocks it
const INTERSTITIAL_COOLDOWN_MS = 90000; // never two ads inside 90s, however unlucky the rolls get

// [2.0-adfix] Latched the first time an ad turns out not to be servable at all (no fill, ads off for
// this build, blocked by an extension). Everything ad-shaped disappears for the rest of the session
// from that moment on. The alternative is a button that does nothing when clicked, which is both a
// bad first impression and exactly the kind of dead control a store review flags.
let _adsUnavailable = false;

// ADS_ENABLED (js/constants.js) is the launch-stage gate; _adsUnavailable is the runtime one. Both
// have to say yes before any ad affordance is drawn, and maybeShowInterstitial() checks the same
// pair — so a single `false` in constants.js removes ads from the build entirely.
function _adsAvailable() { return ADS_ENABLED && _cgReady && _cgSdk && !_adsUnavailable; }

// Shared handling for a rewarded ad that didn't pay out.
//   'unavailable' — the ad never appeared. Nothing is coming this session; retire the offers.
//   'incomplete'  — it played but wasn't finished (closed early). Their choice, so let them retry.
function _onRewardedFail(reason, btn) {
  if (reason === 'unavailable') {
    _adsUnavailable = true;
    _hideDeathAdButtons();
    _adNote('Ads unavailable right now');
    if (typeof renderVoidOpener === 'function' && voidShopEl && voidShopEl.classList.contains('open')) {
      renderVoidOpener(); // drop the ad row too, if the player is standing in the shop
    }
    return;
  }
  if (btn) btn.disabled = false;
  _adNote('Ad not completed');
}

// Every ad of either kind stamps this, so the cooldown covers rewarded→interstitial too: a player
// who just chose to watch an ad for a revive doesn't get an unsolicited one right behind it.
function _markAdShown() { _lastInterstitialAt = Date.now(); }

// ══════════════════════════════════════════════════
// DEATH SCREEN — shared button plumbing
// ══════════════════════════════════════════════════
// Both death buttons are static elements in index.html rather than part of the deathStats
// innerHTML rebuild, so .onclick survives without being re-attached on every death.
function _deathAdBtn()     { return document.getElementById('death-ad-btn'); }
function _deathReviveBtn() { return document.getElementById('death-revive-btn'); }

function _resetDeathAdButtons() { // called at the top of every game-over screen build
  for (const btn of [_deathAdBtn(), _deathReviveBtn()]) {
    if (!btn) continue;
    btn.style.display = 'none';
    btn.disabled = false;
    btn.onclick = null;
  }
}

// One ad per game-over screen. Taking the revive tears the overlay down anyway; taking the 2×
// hides the revive, which also keeps sessionCoinsEarned from being doubled before a later death
// recomputes the record bonus from it.
function _hideDeathAdButtons() {
  for (const btn of [_deathAdBtn(), _deathReviveBtn()]) if (btn) btn.style.display = 'none';
}

// ══════════════════════════════════════════════════
// 1. REWARDED — double this run's payout
// ══════════════════════════════════════════════════
function offerDeathAdBonus() {
  if (!_adsAvailable()) return;
  const btn = _deathAdBtn();
  if (!btn) return;
  if (sessionCoinsEarned <= 0 && sessionCrystalsEarned <= 0) return; // nothing to double
  btn.style.display = '';
  btn.textContent = currentWorld === 2 ? '▶ WATCH AD FOR 2× CRYSTALS' : '▶ WATCH AD FOR 2× COINS';
  btn.onclick = () => {
    btn.disabled = true;
    cgShowRewardedAd(
      () => {
        _markAdShown();
        const base  = currentWorld === 2 ? sessionCrystalsEarned : sessionCoinsEarned;
        const bonus = base; // exactly 2× the total, record bonus included
        if (currentWorld === 2) { crystals += bonus; sessionCrystalsEarned += bonus; }
        else                    { coins    += bonus; sessionCoinsEarned    += bonus; }
        addCurrencyTotal(bonus);
        save();
        updateMenuCoins(true);
        _hideDeathAdButtons();
        // Re-render the itemised sum from the same helper the screen was built with, so the ad row
        // slots in and the multiplier on the Total stays truthful. Overwriting #_dc alone would
        // leave a "3×" label sitting over a total that is now 6× the base.
        const earnEl = document.getElementById('death-earn-block');
        if (earnEl) earnEl.outerHTML = _earnRows(_lastRecBonus, bonus);
        animateCounter('_dc', base + bonus, 420); // always counts from 0, same as the first reveal
        _adRewardFlash(bonus);
      },
      (reason) => _onRewardedFail(reason, btn)
    );
  };
}

// ══════════════════════════════════════════════════
// 2. REWARDED — an extra Void loot box, once a day
// ══════════════════════════════════════════════════
// Independent of the daily free box AND of the 2/day buy limit: watching is a third source, never
// a replacement. Resolves to a normal _resolveBoxOpen() result so lootbox.js can feed it straight
// into the existing reel, or null if the player backed out.
function offerAdBox() {
  if (!_adsAvailable() || !canOpenAdBox()) return Promise.resolve(null);
  return new Promise((resolve) => {
    cgShowRewardedAd(
      () => {
        _markAdShown();
        box_adWatchedDate = _todayStr();
        localStorage.setItem('cm_world2_box_ad_date', box_adWatchedDate);
        resolve(_resolveBoxOpen());
      },
      (reason) => {
        // Nothing is consumed either way; 'unavailable' additionally retires the row, so the shop
        // never leaves a button sitting there that has already proven it does nothing.
        if (reason === 'unavailable') { _adsUnavailable = true; _adNote('Ads unavailable right now'); }
        resolve(null);
      }
    );
  });
}

// ══════════════════════════════════════════════════
// 3. REWARDED — continue after death, once per game
// ══════════════════════════════════════════════════
// Restricted to the plain endless run. Hardcore's whole premise is one life a day; Daily is a
// score every player is meant to be able to compare; Time Attack counts down against an absolute
// timestamp that an ad break would eat into.
function offerReviveAd() {
  if (!_adsAvailable()) return;
  if (reviveUsedThisGame || tutorialActive || gameMode !== null) return;
  const btn = _deathReviveBtn();
  if (!btn) return;
  btn.style.display = '';
  btn.onclick = () => {
    btn.disabled = true;
    cgShowRewardedAd(
      () => {
        _markAdShown();
        reviveUsedThisGame = true;
        _hideDeathAdButtons();
        deathOverlay.classList.remove('show');
        alive = true;
        // pauseGame() early-returns while dead, so the ad break was never excluded from the
        // survival clock. Rewind virtual time to the exact moment of death instead: the run keeps
        // the seconds it earned and loses the ones spent watching.
        _virtAccum = parseFloat(lastTime) * 1000;
        _virtBase  = Date.now();
        lasers = []; blocks = []; asteroids = [];
        clearTimeout(asteroidTimer); asteroidTimer = null;
        if (_asteroidsEnabled()) scheduleAsteroid();
        _resetBlackHole();
        round--;      // startRound() increments — so the player replays the round that killed them,
        startRound(); // which they never got paid for. No free progression out of an ad.
        cgGameplayStart();
      },
      (reason) => _onRewardedFail(reason, btn)
    );
  };
}

// ══════════════════════════════════════════════════
// 4. INTERSTITIAL — unprompted, ~30% of deaths
// ══════════════════════════════════════════════════
// Not a reward: no player choice, no payout. Only ever at the natural break a death already is,
// and never in the modes that are meant to run clean start-to-finish.
function maybeShowInterstitial(onDone) {
  if (!_adsAvailable())                                             { onDone(); return; }
  if (tutorialActive)                                               { onDone(); return; }
  if (gameMode === 'hardcore' || gameMode === 'daily')              { onDone(); return; }
  if (reviveUsedThisGame)                                           { onDone(); return; } // already watched one this game
  if (Date.now() - _lastInterstitialAt < INTERSTITIAL_COOLDOWN_MS)  { onDone(); return; } // no ad chains on repeated quick deaths
  if (Math.random() >= INTERSTITIAL_CHANCE)                         { onDone(); return; }
  _markAdShown();
  cgShowMidgameAd(onDone); // handles its own pause/mute/resume
}

// ══════════════════════════════════════════════════
// FEEDBACK
// ══════════════════════════════════════════════════
// Same idea as spawnMenuCoinFloat (js/main.js) but deliberately its own class: ad rewards get a
// hotter colour and a slower rise, so they never read as an ordinary round payout.
function _adRewardFlash(amount) { _adFloat(`+${amount} ${curIcon()}`, 'ad-reward-float'); }

// [2.0-adfix] Neutral sibling for the times an ad doesn't pay out. Being told "ads unavailable"
// is a far better outcome than a button that silently stops existing.
function _adNote(text) { _adFloat(text, 'ad-note-float'); }

function _adFloat(text, cls) {
  const el = document.createElement('div');
  el.className = cls;
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1400);
}
