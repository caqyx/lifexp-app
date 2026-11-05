// LifeXP polish for Gridlock (docs/v2/VENDOR-PATCHES.md). Not part of the upstream game:
// scripts/vendor-game.mjs copies this file into the vendored copy and loads it just before
// the game's own scripts. It changes no rules, balance or saved data (cm_* keys), only:
//   1. a sharp board on high-DPI phones (the animation canvas and the cube's skin cache are
//      drawn at the screen's pixel density, capped at 2×),
//   2. a dash that fires on press instead of on release (the target was already locked on
//      press; release only added the length of the tap to the response),
//   3. a landing ring after a dash and a hit flash + short shake on death, both skipped or
//      reduced under prefers-reduced-motion.
// Everything reaches the game through its global functions and variables, so a renamed one
// switches the feature off instead of breaking the game; tests/vendor-game.spec.js checks
// that the names still exist in the vendored copy.
(function lifexpPolish() {
  'use strict';

  var MAX_DPR = 2;
  var reducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var canvasProto = HTMLCanvasElement.prototype;
  var widthProp = Object.getOwnPropertyDescriptor(canvasProto, 'width');
  var heightProp = Object.getOwnPropertyDescriptor(canvasProto, 'height');

  function pixelRatio() {
    return Math.max(1, Math.min(MAX_DPR, window.devicePixelRatio || 1));
  }

  /**
   * Makes a 2D canvas draw at the screen's pixel density while the game keeps working in CSS
   * pixels: `width`/`height` read and write the logical size, the bitmap is that × the pixel
   * ratio, and every resize (which resets the context) puts the scale back.
   */
  function hiDpiCanvas(canvas) {
    if (!canvas || canvas.lifexpHiDpi) return canvas;
    var logicalW = widthProp.get.call(canvas);
    var logicalH = heightProp.get.call(canvas);
    function applySize() {
      var ratio = pixelRatio();
      widthProp.set.call(canvas, Math.round(logicalW * ratio));
      heightProp.set.call(canvas, Math.round(logicalH * ratio));
      canvas.getContext('2d').setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    Object.defineProperty(canvas, 'width', {
      configurable: true,
      get: function () { return logicalW; },
      set: function (value) { logicalW = Number(value) || 0; applySize(); },
    });
    Object.defineProperty(canvas, 'height', {
      configurable: true,
      get: function () { return logicalH; },
      set: function (value) { logicalH = Number(value) || 0; applySize(); },
    });
    canvas.lifexpHiDpi = true;
    applySize();
    return canvas;
  }
  window.lifexpHiDpiCanvas = hiDpiCanvas;
  hiDpiCanvas(document.getElementById('anim-canvas'));

  // ── juice ──
  var boardWrap = null;
  var ringPool = [];
  var ringNext = 0;

  function createRing() {
    var ring = document.createElement('div');
    ring.className = 'lx-ring';
    ring.setAttribute('aria-hidden', 'true');
    boardWrap.appendChild(ring);
    return ring;
  }

  function playLandingRing(cellX, cellY, color) {
    if (reducedMotion.matches || !boardWrap) return;
    if (ringPool.length < 4) ringPool.push(createRing());
    var ring = ringPool[ringNext++ % ringPool.length];
    ring.style.setProperty('--lx-x', String(cellX));
    ring.style.setProperty('--lx-y', String(cellY));
    ring.style.setProperty('--lx-n', String(N));
    ring.style.setProperty('--lx-color', color);
    ring.classList.remove('lx-ring--on');
    void ring.offsetWidth; // restart the animation
    ring.classList.add('lx-ring--on');
  }

  function playHit() {
    if (!boardWrap) return;
    boardWrap.classList.remove('lx-hit');
    void boardWrap.offsetWidth;
    boardWrap.classList.add('lx-hit');
  }

  // ── wiring, once the game's scripts have run ──
  function wrapDash() {
    var original = window.tryDash;
    window.tryDash = function lifexpTryDash(x, y) {
      var fromX = cube.x, fromY = cube.y;
      var result = original.apply(this, arguments);
      if (cube.x !== fromX || cube.y !== fromY) playLandingRing(cube.x, cube.y, skinColor());
      return result;
    };
  }

  function wrapDeath() {
    var original = window.die;
    window.die = function lifexpDie() {
      var wasAlive = alive;
      var result = original.apply(this, arguments);
      if (wasAlive && !alive) playHit();
      return result;
    };
  }

  /** The cell listener records the pressed cell; fire the dash right away instead of at pointerup. */
  function dashOnPress() {
    document.getElementById('board').addEventListener('pointerdown', function (event) {
      if (event.button !== 0 || _dashPressX < 0) return;
      var x = _dashPressX, y = _dashPressY;
      _dashPressX = _dashPressY = -1;
      tryDash(x, y);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    boardWrap = document.getElementById('board-wrap');
    var canDash = typeof tryDash === 'function' && typeof cube === 'object';
    if (canDash && typeof skinColor === 'function' && typeof N === 'number') wrapDash();
    if (typeof die === 'function' && typeof alive === 'boolean') wrapDeath();
    if (canDash && typeof _dashPressX === 'number') dashOnPress();
  });
})();
