// In-app notification banners (docs/v2/PLAN.md 9.1, row c-3): a reminder slides in
// from the top like a phone's notification, while the app is open. One at a time;
// BannerHost (mounted once by the app shell) shows the head of the queue. Unlike a
// toast it is not feedback on an action: it comes on its own, so it says where it
// is from ("Kalendarz") and opens what it is about when tapped.
import { signal } from '@preact/signals';

export interface BannerInput {
  /** Where it comes from, e.g. "Kalendarz". */
  source: string;
  title: string;
  /** One line under the title. */
  body?: string;
  /** Tapping the banner: open what it is about. */
  onOpen?: () => void;
  /** Override the default time on screen. */
  durationMs?: number;
}

export interface Banner extends BannerInput {
  id: number;
}

/** Long enough to read a title and a line; the timer waits while a finger is on it. */
export const BANNER_DURATION_MS = 8000;
/** More waiting than this replace the oldest: a burst never builds a long line. */
export const BANNER_QUEUE_MAX = 3;

export const banners = signal<readonly Banner[]>([]);
let nextId = 1;

export function showBanner(input: BannerInput): number {
  const id = nextId++;
  const queue = [...banners.value, { ...input, id }];
  // Keep the one on screen and the newest others.
  banners.value = queue.length > BANNER_QUEUE_MAX ? [queue[0]!, ...queue.slice(queue.length - BANNER_QUEUE_MAX + 1)] : queue;
  return id;
}

export function dismissBanner(id: number): void {
  banners.value = banners.value.filter((b) => b.id !== id);
}

/** Swiping up this far (of the banner's height), or flicking up, dismisses it. */
export const BANNER_SWIPE_RATIO = 0.35;

/** Whether a vertical drag of `dy` px (negative = up) with `velocity` px/ms dismisses a banner `height` px tall. */
export function swipeDismisses(dy: number, velocity: number, height: number): boolean {
  if (velocity <= -0.3) return true;
  return -dy >= Math.max(1, height) * BANNER_SWIPE_RATIO;
}
