// Lists whose rows move instead of jumping (docs/v2/PLAN.md 7.1): when a row is
// added, removed or reordered, the rows that stay glide from their old place to the
// new one, and a removed row fades out where it was while the others close the gap.
// Transform and opacity only, on the compositor; nothing when motion is reduced
// (the duration tokens are 0 ms then).
import { toChildArray, type ComponentChildren, type RefObject } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { cssDurationMs } from './motion';

const GHOST = 'ui-motion-ghost';

interface Place {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Snapshot {
  rows: Element[];
  places: Map<Element, Place>;
}

/** The list's own rows: its children, without the fading copies of removed ones. */
function rowsOf(list: HTMLElement): HTMLElement[] {
  return [...list.children].filter((c): c is HTMLElement => c instanceof HTMLElement && !c.classList.contains(GHOST));
}

/** Layout boxes relative to the list (offsets ignore transforms, so a row mid-animation still reads its place). */
function placeOf(row: HTMLElement): Place {
  return { x: row.offsetLeft, y: row.offsetTop, w: row.offsetWidth, h: row.offsetHeight };
}

function sameRows(a: readonly Element[], b: readonly Element[]): boolean {
  return a.length === b.length && a.every((row, i) => row === b[i]);
}

function fadeOut(list: HTMLElement, row: Element, place: Place, duration: number, easing: string): void {
  const ghost = row.cloneNode(true) as HTMLElement;
  ghost.classList.add(GHOST);
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  // A copy for the eye only: nothing in it may be found as the row it was.
  for (const el of [ghost, ...ghost.querySelectorAll('[id], [name], [for], [data-testid]')]) {
    for (const attr of ['id', 'name', 'for', 'data-testid']) el.removeAttribute(attr);
  }
  ghost.style.setProperty('--ghost-x', `${place.x}px`);
  ghost.style.setProperty('--ghost-y', `${place.y}px`);
  ghost.style.setProperty('--ghost-w', `${place.w}px`);
  ghost.style.setProperty('--ghost-h', `${place.h}px`);
  list.append(ghost);
  const animation = ghost.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.96)' }], {
    duration,
    easing,
    fill: 'forwards',
  });
  animation.onfinish = animation.oncancel = () => ghost.remove();
}

/**
 * What identifies each row of a list for Preact: its key, or its type and place when
 * unkeyed. The same sequence twice means Preact keeps every row element where it was.
 */
export function rowKeys(children: ComponentChildren): unknown[] {
  return toChildArray(children).map((child) => (typeof child === 'object' ? (child.key ?? child.type) : child));
}

function sameKeys(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((key, i) => key === b[i]);
}

/**
 * Put the returned ref on a list (ul/ol or any container of rows). Its rows animate
 * between renders; rows that appear rise in by CSS (.ui-stagger).
 *
 * `keys` (rowKeys of the list's children): when they are the same as at the last
 * render, no row can move, so the old layout is not read. Reading it forces the
 * browser to lay out the page in the middle of a render (docs/v2/PERF.md: opening the
 * drawer re-rendered the lists of the screen and paid for a layout each time).
 */
export function useListMotion<T extends HTMLElement>(keys?: readonly unknown[]): RefObject<T> {
  const ref = useRef<T>(null);
  const before = useRef<Snapshot | null>(null);
  const lastKeys = useRef<readonly unknown[] | null>(null);
  const unchanged = keys !== undefined && lastKeys.current !== null && sameKeys(lastKeys.current, keys);
  lastKeys.current = keys ?? null;

  // Where every row is just before this render changes the list. The component
  // body runs before Preact touches the list's children, so this is the old layout.
  const list = ref.current;
  before.current = null;
  if (list && !unchanged) {
    const rows = rowsOf(list);
    before.current = { rows, places: new Map(rows.map((row) => [row, placeOf(row)])) };
  }

  useLayoutEffect(() => {
    const list = ref.current;
    const old = before.current;
    before.current = null;
    if (!list) return;
    list.classList.add('ui-motion-list');
    if (!old || typeof list.animate !== 'function') return;
    const rows = rowsOf(list);
    if (sameRows(old.rows, rows)) return;
    const duration = cssDurationMs('--duration-enter', list);
    if (duration === 0) return;
    const style = getComputedStyle(list);
    const easeOut = style.getPropertyValue('--ease-out').trim() || 'ease-out';
    const easeIn = style.getPropertyValue('--ease-in').trim() || 'ease-in';

    // When a row leaves, the rest set off a moment later, once it has begun to fade,
    // so its text and theirs do not cross at full strength.
    const exit = cssDurationMs('--duration-exit', list);
    const removed = old.rows.some((row) => !rows.includes(row as HTMLElement));
    const delay = removed ? exit / 4 : 0;
    for (const row of rows) {
      const from = old.places.get(row);
      if (!from) continue;
      const to = placeOf(row);
      const dx = from.x - to.x;
      const dy = from.y - to.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      row.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
        duration,
        delay,
        easing: easeOut,
        fill: 'backwards',
      });
    }

    for (const row of old.rows) {
      if (rows.includes(row as HTMLElement)) continue;
      const place = old.places.get(row);
      if (place && exit > 0) fadeOut(list, row, place, exit, easeIn);
    }
  });

  return ref;
}
