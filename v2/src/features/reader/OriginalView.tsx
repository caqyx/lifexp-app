// Oryginał (row r-6): a PDF book's real pages, drawn by pdf.js from the kept file, with
// a text layer over them (selectable, invisible) and the reader's light on top: the
// current sentence in Prosta, the current word in Auto, found on the page by its text
// (domain/reader/pdf-match). Portrait: one page; landscape: two pages with the spine and
// the page turn of the text spread. The position is the reader's sentence, shared with
// the text view, so switching keeps the place. Zoom to the sentence (the "Przybliżaj do
// zdania" setting) moves a camera; pinch, the wheel and drag zoom and move by hand,
// a double tap goes back to the whole page.
import { ArrowLeft, ArrowRight } from 'lucide-preact';
import type { MutableRef } from 'preact/hooks';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Section, Sentence } from '@/domain/reader/book';
import type { PdfTextItem } from '@/domain/reader/parse-pdf';
import {
  boxesOf,
  compactPages,
  firstSentenceFrom,
  matchSentences,
  sentencePages,
  spreadOf,
  unionBox,
  wordRange,
  type CompactText,
  type PdfBox,
} from '@/domain/reader/pdf-match';
import { wordDelay, wordRanges, type ReaderMode } from '@/domain/reader/settings';
import { t } from '@/i18n';
import type { OriginalDoc, PageSize } from '@/services/reader-original';
import { cssDurationMs } from '@/ui/motion';
import { animateLeaf, faceBox, turnDuration, type RunningTurn, type TurnDir } from './pageTurn';
import type { Jump } from './Reader';
import { fmt } from './texts';

export interface OriginalControl {
  next: () => void;
  prev: () => void;
}

interface OriginalViewProps {
  bookId: string;
  control: MutableRef<OriginalControl | null>;
  sents: readonly Sentence[];
  sections: readonly Section[];
  mode: ReaderMode;
  landscape: boolean;
  pos: number;
  jump: Jump;
  zoom: boolean;
  swap: boolean;
  playing: boolean;
  wpm: number;
  onPosition: (sentence: number) => void;
  onEnd: () => void;
  /** Full screen in Auto: a tap starts or pauses. */
  onTapPage?: (() => void) | undefined;
  swipe: { onTouchStart: (e: TouchEvent) => void; onTouchEnd: (e: TouchEvent) => void };
}

type DocState = { kind: 'loading' } | { kind: 'missing' } | { kind: 'failed' } | { kind: 'ready'; doc: OriginalDoc };

interface Match {
  stream: CompactText;
  ranges: Map<number, { from: number; to: number }>;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const TAP = 8;
const MAX_USER_ZOOM = 5;

/** A text layer span: where it is (CSS px in the page) and how wide its text must be stretched. */
interface Span {
  key: number;
  str: string;
  x: number;
  y: number;
  fs: number;
  sx: number;
}

let measureCtx: CanvasRenderingContext2D | null = null;
function textWidth(str: string, fs: number): number {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return str.length * fs * 0.5;
  measureCtx.font = `${fs}px sans-serif`;
  return measureCtx.measureText(str).width;
}

function spansOf(items: readonly PdfTextItem[], size: PageSize, s: number): Span[] {
  const out: Span[] = [];
  items.forEach((it, key) => {
    if (!it.str.trim()) return;
    const [, , c = 0, d = 1, e = 0, f = 0] = it.transform;
    const h = Math.hypot(c, d) || it.height || 10;
    const fs = h * s;
    const w = (it.width ?? 0) * s;
    const natural = textWidth(it.str, fs);
    out.push({ key, str: it.str, x: (e - size.x0) * s, y: (size.y0 + size.h - f - h * 0.85) * s, fs, sx: natural > 0 && w > 0 ? w / natural : 1 });
  });
  return out;
}

/** A PDF box (y up) as CSS px in the page drawn at scale `s`. */
const cssBox = (b: PdfBox, size: PageSize, s: number) => ({ x: (b.x - size.x0) * s, y: (size.y0 + size.h - b.y - b.h) * s, w: b.w * s, h: b.h * s });

export function OriginalView(props: OriginalViewProps) {
  const { bookId, sents, sections, mode, landscape, pos, jump, zoom, playing, wpm } = props;
  const [state, setState] = useState<DocState>({ kind: 'loading' });
  const doc = state.kind === 'ready' ? state.doc : null;

  useEffect(() => {
    let alive = true;
    let opened: OriginalDoc | null = null;
    setState({ kind: 'loading' });
    import('@/services/reader-original')
      .then((m) => m.openOriginal(bookId))
      .then((d) => {
        opened = d;
        if (!alive) return d?.close();
        setState(d ? { kind: 'ready', doc: d } : { kind: 'missing' });
      })
      .catch(() => alive && setState({ kind: 'failed' }));
    return () => {
      alive = false;
      opened?.close();
    };
  }, [bookId]);

  const sentPage = useMemo(
    () =>
      sentencePages(sents, (sec) => {
        const label = sections[sec]?.label;
        return label?.kind === 'page' ? label.n : null;
      }),
    [sents, sections],
  );
  const total = doc?.pages ?? 1;

  // ── Which page ────────────────────────────────────────────────────────────
  const follows = mode !== 'normal';
  const [page, setPage] = useState(() => sentPage[pos] ?? 1);
  const jumpN = useRef(jump.n);
  /** The next page change came from a jump (contents, slider): no turn. */
  const jumped = useRef(false);
  useEffect(() => {
    if (follows) setPage(sentPage[pos] ?? 1);
  }, [follows, pos, sentPage]);
  useEffect(() => {
    if (jump.n === jumpN.current) return;
    jumpN.current = jump.n;
    jumped.current = true;
    setPage(sentPage[jump.s] ?? 1);
  }, [jump.n]);
  const shown = useMemo(() => {
    const p = clamp(page, 1, total);
    return landscape ? spreadOf(p).filter((n) => n <= total) : [p];
  }, [page, total, landscape]);
  const first = shown[0] ?? 1;
  const shownKey = shown.join('-');

  // ── Sizes ─────────────────────────────────────────────────────────────────
  const frame = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [state.kind, landscape]);
  const [size, setSize] = useState<PageSize | null>(null);
  useEffect(() => {
    if (doc) void doc.size(first).then(setSize);
  }, [doc, first]);
  const per = landscape ? 2 : 1;
  const scale = size && box.w > 0 ? Math.min(box.w / (per * size.w), box.h / size.h) : 0;
  const pageW = size ? Math.floor(size.w * scale) : 0;
  const pageH = size ? Math.floor(size.h * scale) : 0;
  const bookW = pageW * per;
  const ox = (box.w - bookW) / 2;
  const oy = (box.h - pageH) / 2;

  // ── Text of pages (for the text layer and the light) ──────────────────────
  const [texts, setTexts] = useState<ReadonlyMap<number, readonly PdfTextItem[]>>(new Map());
  const anchor = sentPage[pos] ?? first;
  const wanted = useMemo(() => [...new Set([...shown, anchor, anchor + 1])].filter((n) => n >= 1 && n <= total), [shown, anchor, total]);
  useEffect(() => {
    if (!doc) return;
    let alive = true;
    for (const n of wanted) {
      if (texts.has(n)) continue;
      void doc.text(n).then((items) => {
        if (alive) setTexts((m) => (m.has(n) ? m : new Map(m).set(n, items)));
      });
    }
    return () => {
      alive = false;
    };
  }, [doc, wanted]);

  // Sentences found on their page (and the next, where a sentence may end), once per page.
  const matches = useRef(new Map<number, Match>());
  useEffect(() => matches.current.clear(), [sents]);
  const matchOf = (p: number): Match | null => {
    const hit = matches.current.get(p);
    if (hit) return hit;
    const here = texts.get(p);
    if (!here) return null;
    const next = p + 1 <= total ? texts.get(p + 1) : [];
    if (!next) return null;
    const stream = compactPages([
      { page: p, items: here },
      { page: p + 1, items: next },
    ]);
    const list: { i: number; t: string }[] = [];
    const from = firstSentenceFrom(sentPage, p);
    for (let i = from; i < sents.length && sentPage[i] === p; i++) list.push({ i, t: (sents[i] as Sentence).t });
    const m = { stream, ranges: matchSentences(stream.text, list) };
    matches.current.set(p, m);
    return m;
  };

  // ── The light: the sentence (Prosta), the word (Auto) ─────────────────────
  const [word, setWord] = useState(0);
  useEffect(() => setWord(0), [pos]);
  const light = useMemo(() => {
    if (mode === 'normal') return { sentence: new Map<number, PdfBox[]>(), word: new Map<number, PdfBox[]>() };
    const m = matchOf(anchor);
    const range = m?.ranges.get(pos);
    if (!m || !range) return { sentence: new Map<number, PdfBox[]>(), word: new Map<number, PdfBox[]>() };
    const items = (n: number) => texts.get(n);
    const sentence = boxesOf(m.stream.refs, range.from, range.to, items);
    let w = new Map<number, PdfBox[]>();
    const text = sents[pos]?.t ?? '';
    const r = wordRanges(text)[word];
    if (mode === 'auto' && r) {
      const wr = wordRange(text, range, r.start, r.end);
      w = boxesOf(m.stream.refs, wr.from, wr.to, items);
    }
    return { sentence, word: w };
  }, [mode, anchor, pos, word, texts, sents]);

  // ── Auto: the light walks the words ───────────────────────────────────────
  const onPosition = useRef(props.onPosition);
  onPosition.current = props.onPosition;
  const onEnd = useRef(props.onEnd);
  onEnd.current = props.onEnd;
  useEffect(() => {
    if (mode !== 'auto' || !playing) return;
    const text = sents[pos]?.t ?? '';
    const words = wordRanges(text);
    const r = words[word];
    const delay = wordDelay(r ? text.slice(r.start, r.end) : text, wpm);
    const timer = setTimeout(() => {
      if (word + 1 < words.length) setWord(word + 1);
      else if (pos + 1 < sents.length) onPosition.current(pos + 1);
      else onEnd.current();
    }, delay);
    return () => clearTimeout(timer);
  }, [mode, playing, pos, word, wpm, sents]);

  // ── Moving ────────────────────────────────────────────────────────────────
  const step = (dir: 1 | -1) => {
    if (mode === 'normal') {
      if (!doc) return;
      const next = clamp(first + dir * per, 1, total);
      if (next === first || (landscape && spreadOf(next)[0] === first)) {
        if (dir > 0) onEnd.current();
        return;
      }
      setPage(next);
      onPosition.current(firstSentenceFrom(sentPage, next));
      return;
    }
    const s = pos + dir;
    if (s < 0) return;
    if (s >= sents.length) return onEnd.current();
    onPosition.current(s);
  };
  props.control.current = { next: () => step(1), prev: () => step(-1) };

  // ── Camera: close to the sentence (Prosta, Auto) or the whole page ────────
  const [camOff, setCamOff] = useState(false);
  const camera = useMemo(() => {
    const none = { x: 0, y: 0, scale: 1 };
    if (!zoom || camOff || mode === 'normal' || !size || !scale) return none;
    const boxes: { x: number; y: number; w: number; h: number }[] = [];
    shown.forEach((n, k) => {
      for (const b of light.sentence.get(n) ?? []) {
        const c = cssBox(b, size, scale);
        boxes.push({ ...c, x: c.x + k * pageW });
      }
    });
    const u = unionBox(boxes);
    if (!u) return none;
    const k = clamp(Math.min((box.w * 0.92) / u.w, (box.h * 0.6) / u.h), 1, 3);
    const cx = ox + u.x + u.w / 2;
    const cy = oy + u.y + u.h / 2;
    const fit = (t: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : clamp(t, lo, hi));
    return {
      scale: k,
      x: fit(box.w / 2 - cx * k, box.w - (ox + bookW) * k, -ox * k),
      y: fit(box.h / 2 - cy * k, box.h - (oy + pageH) * k, -oy * k),
    };
  }, [zoom, camOff, mode, light, size, scale, shownKey, box.w, box.h]);

  // ── By hand: pinch, wheel, drag; a double tap resets ──────────────────────
  const [user, setUser] = useState({ scale: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const down = useRef({ x: 0, y: 0, moved: false });
  const zoomBy = (factor: number) => setUser((u) => (u.scale * factor <= 1.001 ? { scale: 1, x: 0, y: 0 } : { ...u, scale: clamp(u.scale * factor, 1, MAX_USER_ZOOM) }));

  // ── Drawing the pages (cached; the next ones drawn ahead) ─────────────────
  const slots = useRef(new Map<number, HTMLDivElement>());
  const turnLayer = useRef<HTMLDivElement>(null);
  const turning = useRef<RunningTurn | null>(null);
  const lastFirst = useRef<number | null>(null);
  /** Copies of the old pages for a page turn, taken before the new ones are drawn. */
  const turnSnap = useRef<{ dir: TurnDir; still: HTMLElement; front: HTMLElement } | null>(null);

  /** A copy of what the page at place `k` (0 left or single, 1 right) shows now. */
  const copyOf = (k: number): HTMLCanvasElement | null => {
    const src = slots.current.get(k)?.querySelector('canvas');
    if (!src || !src.width) return null;
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    c.className = 'orig__canvas';
    c.getContext('2d')?.drawImage(src, 0, 0);
    return c;
  };

  useLayoutEffect(() => {
    const before = lastFirst.current;
    lastFirst.current = first;
    turning.current?.finish();
    turnSnap.current = null;
    const wasJump = jumped.current;
    jumped.current = false;
    if (before === null || before === first || !doc || pageW === 0) return;
    const dir: TurnDir = first > before ? 1 : -1;
    const el = frame.current;
    if (landscape && !wasJump && Math.abs(first - before) === 2 && turnDuration() > 0) {
      // The near page stays until the leaf lands on it; the far page is the leaf's front.
      // The page boxes stay (keyed by place), still holding the old pages here.
      const still = copyOf(dir > 0 ? 0 : 1);
      const front = copyOf(dir > 0 ? 1 : 0);
      if (still && front) {
        turnSnap.current = {
          dir,
          still: faceBox(still, dir > 0 ? 'left' : 'right', `spread__face--${dir > 0 ? 'left' : 'right'}`),
          front: faceBox(front, dir > 0 ? 'right' : 'left', 'spread__face--front'),
        };
      }
    } else if (el && cssDurationMs('--duration-enter') > 0) {
      // One page (or a jump): the new page slides in a little.
      el.querySelector('.orig__book')?.animate(
        [
          { opacity: 0, transform: `translateX(${wasJump ? 0 : dir * 18}px)` },
          { opacity: 1, transform: 'none' },
        ],
        { duration: cssDurationMs('--duration-enter'), easing: getComputedStyle(el).getPropertyValue('--ease-out').trim() || 'ease-out' },
      );
    }
  }, [first, doc, pageW, landscape]);

  // Close up (the camera or a pinch), the pages are drawn sharper: in half steps, up to the pixel budget.
  const closeness = Math.min(3, Math.max(camera.scale, user.scale));
  const drawW = Math.round(pageW * (closeness > 1.05 ? Math.ceil(closeness * 2) / 2 : 1));
  useEffect(() => {
    if (!doc || pageW === 0) return;
    let alive = true;
    const pages = shown;
    // A page box showing another page: its new page now if it is drawn, else blank paper (never the wrong page).
    pages.forEach((n, k) => {
      const slot = slots.current.get(k);
      const now = slot?.firstElementChild as HTMLElement | null | undefined;
      if (!slot || !now || now.dataset.page === String(n)) return;
      const ready = doc.cached(n, drawW) ?? doc.cached(n, pageW);
      if (ready) slot.replaceChildren(ready);
      else slot.replaceChildren();
    });
    void Promise.all(pages.map((n) => doc.draw(n, drawW))).then((canvases) => {
      if (!alive) return;
      canvases.forEach((c, k) => {
        const slot = slots.current.get(k);
        c.dataset.page = String(pages[k]);
        if (slot && slot.firstChild !== c) slot.replaceChildren(c);
      });
      const snap = turnSnap.current;
      turnSnap.current = null;
      const layer = turnLayer.current;
      if (snap && layer) {
        const nearNew = copyOf(snap.dir > 0 ? 0 : 1);
        if (nearNew) {
          const back = faceBox(nearNew, snap.dir > 0 ? 'left' : 'right', 'spread__face--back');
          turning.current = animateLeaf(layer, snap.dir, snap.still, snap.front, back, () => {
            turning.current = null;
          });
        }
      }
      // Ahead: the next page or spread, then the one before (idle time).
      const ahead = [...pages.map((n) => n + per), ...pages.map((n) => n - per)].filter((n) => n >= 1 && n <= doc.pages);
      const idle = (globalThis as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 120));
      idle(() => {
        if (!alive) return;
        void ahead.reduce((p, n) => p.then(() => (alive ? doc.draw(n, drawW).then(() => undefined) : undefined)), Promise.resolve());
      });
    });
    return () => {
      alive = false;
    };
  }, [doc, shownKey, pageW, drawW]);

  const onClick = () => {
    if (down.current.moved) return;
    if (mode === 'auto' && props.onTapPage) return props.onTapPage();
    if (zoom && mode !== 'normal') setCamOff((v) => !v);
  };

  const content =
    state.kind !== 'ready' ? (
      <p class="orig__message" role="status">
        {t(state.kind === 'loading' ? 'reader.original.loading' : state.kind === 'missing' ? 'reader.original.missing' : 'reader.original.failed')}
      </p>
    ) : (
      <div
        class="orig__user"
        style={{ '--u-scale': String(user.scale), '--u-x': `${user.x}px`, '--u-y': `${user.y}px` }}
      >
        <div class="orig__camera" data-testid="orig-camera" style={{ '--cam-x': `${camera.x}px`, '--cam-y': `${camera.y}px`, '--cam-scale': String(camera.scale) }}>
          <div class="orig__book" style={{ '--ox': `${ox}px`, '--oy': `${oy}px`, '--bw': `${bookW}px`, '--bh': `${pageH}px` }}>
            {shown.map((n, k) => {
              const items = texts.get(n);
              const spans = items && size ? spansOf(items, size, scale) : [];
              const marks = (light.sentence.get(n) ?? []).map((b) => (size ? cssBox(b, size, scale) : null));
              const wordMarks = (light.word.get(n) ?? []).map((b) => (size ? cssBox(b, size, scale) : null));
              return (
                <div
                  key={k}
                  class={`orig__page orig__page--${k === 0 && landscape ? 'left' : landscape ? 'right' : 'single'}`}
                  data-testid="orig-page"
                  data-page={n}
                  style={{ '--pw': `${pageW}px`, '--ph': `${pageH}px`, '--px': `${k * pageW}px` }}
                >
                  <div
                    class="orig__slot"
                    ref={(el) => {
                      if (el) slots.current.set(k, el);
                      else slots.current.delete(k);
                    }}
                  />
                  <div class="orig__text">
                    {spans.map((s) => (
                      <span key={s.key} style={{ '--x': `${s.x}px`, '--y': `${s.y}px`, '--fs': `${s.fs}px`, '--sx': String(s.sx) }}>
                        {s.str}
                      </span>
                    ))}
                  </div>
                  {marks.map(
                    (m, i) =>
                      m && <div key={`s${i}`} class="orig__mark" data-testid="orig-mark" style={{ '--x': `${m.x}px`, '--y': `${m.y}px`, '--w': `${m.w}px`, '--h': `${m.h}px` }} />,
                  )}
                  {wordMarks.map(
                    (m, i) =>
                      m && (
                        <div key={`w${i}`} class="orig__mark orig__mark--word" data-testid="orig-word" style={{ '--x': `${m.x}px`, '--y': `${m.y}px`, '--w': `${m.w}px`, '--h': `${m.h}px` }} />
                      ),
                  )}
                </div>
              );
            })}
            {landscape && <div class="spread__gutter orig__gutter" aria-hidden="true" />}
            <div ref={turnLayer} class="spread__turn orig__turn" aria-hidden="true" />
          </div>
        </div>
      </div>
    );

  const folio =
    state.kind === 'ready' ? (
      <span class="orig__folio" data-testid="orig-folio">
        {shown.length > 1
          ? t('reader.original.pagesSpread', { a: fmt(shown[0] ?? 1), b: fmt(shown[1] ?? 1), total: fmt(total) })
          : t('reader.original.pages', { n: fmt(first), total: fmt(total) })}
      </span>
    ) : null;

  const frameEl = (
    <div
      ref={frame}
      class={`orig__frame${landscape ? ' spread__frame' : ''}`}
      data-testid="orig-frame"
      data-zoomed={user.scale > 1 ? 'true' : 'false'}
      onTouchStart={(e) => {
        if (user.scale === 1 && pointers.current.size < 2) props.swipe.onTouchStart(e);
      }}
      onTouchEnd={(e) => {
        if (user.scale === 1 && !pinch.current && pointers.current.size === 0) props.swipe.onTouchEnd(e);
      }}
      onPointerDown={(e) => {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        down.current = { x: e.clientX, y: e.clientY, moved: false };
        if (pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
          pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: user.scale };
        }
      }}
      onPointerMove={(e) => {
        const prev = pointers.current.get(e.pointerId);
        if (!prev) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (Math.abs(e.clientX - down.current.x) > TAP || Math.abs(e.clientY - down.current.y) > TAP) down.current.moved = true;
        if (pointers.current.size === 2 && pinch.current) {
          const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
          const s = clamp((pinch.current.scale * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(1, pinch.current.dist), 1, MAX_USER_ZOOM);
          setUser((u) => (s <= 1.001 ? { scale: 1, x: 0, y: 0 } : { ...u, scale: s }));
        } else if (pointers.current.size === 1 && user.scale > 1) {
          const dx = e.clientX - prev.x;
          const dy = e.clientY - prev.y;
          setUser((u) => ({ ...u, x: u.x + dx, y: u.y + dy }));
        }
      }}
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId);
        if (pointers.current.size < 2) pinch.current = null;
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId);
        pinch.current = null;
      }}
      onWheel={(e) => {
        e.preventDefault();
        zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15);
      }}
      onDblClick={() => setUser((u) => (u.scale > 1 ? { scale: 1, x: 0, y: 0 } : { scale: 2, x: 0, y: 0 }))}
      onClick={onClick}
    >
      {content}
      {folio}
    </div>
  );

  if (!landscape) return <div class="orig orig--single">{frameEl}</div>;
  const forward = (
    <button type="button" class="spread__btn spread__btn--next" title={t('reader.nextLabel')} onClick={() => step(1)}>
      <ArrowRight aria-hidden="true" />
      <span>{t('reader.next')}</span>
    </button>
  );
  const back = (
    <button type="button" class="spread__btn" title={t('reader.prevLabel')} onClick={() => step(-1)}>
      <ArrowLeft aria-hidden="true" />
      <span>{t('reader.prev')}</span>
    </button>
  );
  return (
    <div class="spread orig orig--spread">
      <div class="spread__side spread__side--left">{props.swap ? back : forward}</div>
      {frameEl}
      <div class="spread__side spread__side--right">{props.swap ? forward : back}</div>
    </div>
  );
}
