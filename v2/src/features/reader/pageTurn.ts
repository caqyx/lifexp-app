// The page turn of the two-page spread (row r-3): a leaf rotates over the spine like
// a book's page. It animates copies of the laid-out text, never the text itself, so
// nothing is laid out again while it moves:
//
//   forward (next)                       back (prev)
//   ┌────────┬────────┐                  ┌────────┬────────┐
//   │ old L  │ old R ↶│ leaf: front old R │↷ old L │ old R  │ leaf: front old L
//   │ (copy) │        │ back new L        │        │ (copy) │ back new R
//   └────────┴────────┘                  └────────┴────────┘
//
// Under the leaf the real columns already show the new spread (its far page is
// revealed as the leaf lifts); the near page stays a copy of the old one until the
// leaf lands on it. Shading: the leaf darkens toward the fold, the revealed page lies
// in its shadow. Only transform and opacity move (Web Animations), with the
// --duration-page-turn / --ease-page-turn tokens; with reduced motion the duration
// is 0 and the spread simply switches.
import { cssDurationMs } from '@/ui/motion';

export type TurnDir = 1 | -1;

export interface TurnGeometry {
  /** Page width (half the spread) and the text's left margin, in spread px. */
  pageW: number;
  padOuter: number;
  /** How many of the columns' children (blocks) reach the spread at `shift`. */
  keep: (shift: number) => number;
}

/** What is copied before the spread changes: the old pages. */
export interface TurnSnapshot {
  dir: TurnDir;
  /** The old near page (stays until the leaf lands) and the old far page (the leaf's front). */
  still: HTMLElement;
  front: HTMLElement;
}

export interface RunningTurn {
  finish: () => void;
}

/**
 * A copy of `columns` showing page `page` of the spread shifted by `shift`, in a face
 * box. Blocks after that spread are left out of the copy (`keep` = how many to keep):
 * with the columns filled in order, they cannot change the pages before them, and the
 * copy is laid out faster.
 */
function face(columns: HTMLElement, shift: number, page: 'left' | 'right', g: TurnGeometry, cls: string, keep: number): HTMLElement {
  const box = document.createElement('div');
  box.className = `spread__face spread__face--paper-${page} ${cls}`;
  const copy = columns.cloneNode(true) as HTMLElement;
  copy.removeAttribute('data-testid');
  copy.querySelector('.spread__lamp')?.remove();
  const blocks = [...copy.children];
  blocks.slice(keep).forEach((b) => b.remove());
  copy.style.setProperty('--col-shift', `${-shift}px`);
  // Inside a box of one page's width, the right page's text starts one page to the left.
  copy.style.setProperty('--col-left', `${page === 'left' ? g.padOuter : g.padOuter - g.pageW}px`);
  box.append(copy);
  const shade = document.createElement('div');
  shade.className = 'spread__shade';
  box.append(shade);
  return box;
}

export function turnDuration(): number {
  return cssDurationMs('--duration-page-turn');
}

/** Copies the old spread before it changes; null when turns are off (reduced motion). */
export function snapshotTurn(columns: HTMLElement, shift: number, dir: TurnDir, g: TurnGeometry): TurnSnapshot | null {
  if (turnDuration() === 0) return null;
  const near: 'left' | 'right' = dir > 0 ? 'left' : 'right';
  const far: 'left' | 'right' = dir > 0 ? 'right' : 'left';
  return {
    dir,
    still: face(columns, shift, near, g, `spread__face--${near}`, g.keep(shift)),
    front: face(columns, shift, far, g, 'spread__face--front', g.keep(shift)),
  };
}

/**
 * Runs the turn in `layer` once the real columns show the new spread (`shift`);
 * `onDone` runs when it ends or is finished early.
 */
export function runTurn(
  layer: HTMLElement,
  columns: HTMLElement,
  shift: number,
  snap: TurnSnapshot,
  g: TurnGeometry,
  onDone: () => void,
): RunningTurn {
  const duration = turnDuration();
  const easing = getComputedStyle(layer).getPropertyValue('--ease-page-turn').trim() || 'ease-in-out';
  const next = snap.dir > 0;
  const back = face(columns, shift, next ? 'left' : 'right', g, 'spread__face--back', g.keep(shift));
  const leaf = document.createElement('div');
  leaf.className = `spread__leaf spread__leaf--${next ? 'next' : 'prev'}`;
  leaf.dataset.testid = 'page-turn';
  leaf.append(snap.front, back);
  const cast = document.createElement('div');
  cast.className = `spread__cast spread__cast--${next ? 'next' : 'prev'}`;
  layer.replaceChildren(snap.still, cast, leaf);

  const timing = { duration, easing, fill: 'both' as const };
  const animations = [
    leaf.animate([{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${next ? -180 : 180}deg)` }], timing),
    // The front darkens as it rises toward the fold; the back comes out of the shade as it lands.
    snap.front.querySelector('.spread__shade')?.animate([{ opacity: 0 }, { opacity: 0.55 }], { ...timing, easing: 'linear', duration: duration / 2 }),
    back.querySelector('.spread__shade')?.animate([{ opacity: 0.55 }, { opacity: 0 }], {
      ...timing,
      easing: 'linear',
      duration: duration / 2,
      delay: duration / 2,
    }),
    cast.animate([{ opacity: 0.6 }, { opacity: 0 }], { ...timing, easing: 'ease-out' }),
  ].filter((a): a is Animation => a !== undefined);

  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    animations.forEach((a) => a.cancel());
    layer.replaceChildren();
    onDone();
  };
  void animations[0]?.finished.then(end, () => undefined);
  return { finish: end };
}

/** A spread reached by a jump (contents, slider): a short crossfade instead of a turn. */
export function crossfade(columns: HTMLElement): void {
  const duration = cssDurationMs('--duration-enter');
  if (duration === 0) return;
  columns.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing: 'ease-out' });
}
