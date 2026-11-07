// The book open on two pages, for a phone held sideways (row r-2). The browser lays
// the whole text into columns exactly one page wide (domain/reader/spread gives the
// sizes, so the same screen and text size always give the same pages); a spread shows
// two columns, and turning moves the columns by two pages. Over the pages sits a
// "camera": with "Przybliżaj do zdania" on, Prosta steps one sentence at a time and
// the camera zooms onto it; with it off, the arrows turn whole spreads and nothing
// zooms. Auto's light walks the words and turns the spreads, and with the zoom on the
// camera follows its sentence. Normalny turns spreads. Moves go through transform
// only (motion tokens; none with reduced motion).
//
// The buttons sit beside the pages, never over the text: by the owner's choice the
// LEFT one goes forward (Dalej) and the RIGHT one back (Wstecz); "Zamień strony
// przycisków" swaps them.
import { ArrowLeft, ArrowRight } from 'lucide-preact';
import type { MutableRef } from 'preact/hooks';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Section, Sentence } from '@/domain/reader/book';
import type { ReaderMode } from '@/domain/reader/settings';
import { wordAt, wordDelay, wordRanges } from '@/domain/reader/settings';
import {
  OVERVIEW,
  pageCount,
  pageOfX,
  sentenceOfSpread,
  spreadLayout,
  spreadOfPage,
  spreadShift,
  unionBox,
  zoomTo,
  type Box,
  type Camera,
  type SpreadLayout,
} from '@/domain/reader/spread';
import { t } from '@/i18n';
import type { Jump } from './Reader';
import { sectionHeading } from './texts';
import type { VNode } from 'preact';

export interface SpreadControl {
  next: () => void;
  prev: () => void;
}

interface SpreadViewProps {
  control: MutableRef<SpreadControl | null>;
  sents: readonly Sentence[];
  sections: readonly Section[];
  secStart: readonly number[];
  mode: ReaderMode;
  /** The current sentence. */
  pos: number;
  /** A move asked from outside (the table of contents). */
  jump: Jump;
  zoom: boolean;
  swap: boolean;
  playing: boolean;
  wpm: number;
  /** The text size of Prosta (the pages use two thirds of it, like the other full-text views). */
  fontPx: number;
  onPosition: (sentence: number) => void;
  onEnd: () => void;
  swipe: { onTouchStart: (e: TouchEvent) => void; onTouchEnd: (e: TouchEvent) => void };
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** A tap that moved less than this is a tap, not a swipe. */
const TAP = 12;

export function SpreadView(props: SpreadViewProps) {
  const { sents, sections, secStart, mode, pos, jump, zoom, swap, playing, fontPx, control } = props;
  const latest = useRef(props);
  latest.current = props;

  const frame = useRef<HTMLDivElement>(null);
  const columns = useRef<HTMLDivElement>(null);
  const lamp = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [spread, setSpread] = useState(0);
  const [pages, setPages] = useState(1);
  const [zoomed, setZoomed] = useState(false);
  const [camera, setCamera] = useState<Camera>(OVERVIEW);
  /** Bumps when the text is laid out anew (size, text size): positions must be read again. */
  const [layoutRun, setLayoutRun] = useState(0);
  const pageFont = Math.round(fontPx * 0.66 * 100) / 100;
  const layout: SpreadLayout = useMemo(() => spreadLayout(size.w, size.h, pageFont), [size.w, size.h, pageFont]);

  // The frame's size, whole pixels (sub-pixel changes must not re-paginate).
  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const measure = () => {
      const next = { w: Math.floor(el.clientWidth), h: Math.floor(el.clientHeight) };
      setSize((old) => (old.w === next.w && old.h === next.h ? old : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The whole book, one span per sentence; built once per text.
  const blocks = useMemo(() => {
    const out: VNode[] = [];
    let i = 0;
    while (i < sents.length) {
      const s = sents[i] as Sentence;
      if (secStart[s.sec] === i) {
        const heading = sectionHeading(sections[s.sec], s.sec);
        if (heading) out.push(<h2 key={`h${s.sec}`}>{heading}</h2>);
      }
      const children: (VNode | string)[] = [];
      const first = i;
      while (i < sents.length && (sents[i] as Sentence).sec === s.sec && (sents[i] as Sentence).para === s.para) {
        if (children.length) children.push(' ');
        children.push(
          <span key={i} class="spread__sent" data-i={i}>
            {(sents[i] as Sentence).t}
          </span>,
        );
        i++;
      }
      out.push(s.h ? <h3 key={first}>{children}</h3> : <p key={first}>{children}</p>);
    }
    return out;
  }, [sents, sections, secStart]);

  const spans = useRef<HTMLElement[]>([]);
  const spreadCache = useRef(new Map<number, number>());

  // ── Reading the layout ──────────────────────────────────────────────────────
  /** Scale of the camera now (the columns are inside it). */
  const scaleNow = () => {
    const el = columns.current;
    if (!el || !el.offsetWidth) return 1;
    return el.getBoundingClientRect().width / el.offsetWidth || 1;
  };

  /** A sentence's line boxes in column coordinates (unscaled px from the first column's top left). */
  const boxesOf = (s: number): Box[] => {
    const el = columns.current;
    const span = spans.current[s];
    if (!el || !span) return [];
    const origin = el.getBoundingClientRect();
    const k = scaleNow();
    return [...span.getClientRects()].map((r) => ({
      x: (r.left - origin.left) / k,
      y: (r.top - origin.top) / k,
      w: r.width / k,
      h: r.height / k,
    }));
  };

  const pageOf = (s: number): number => {
    const first = boxesOf(s)[0];
    return first ? pageOfX(first.x, layout) : 0;
  };

  const spreadOf = (s: number): number => {
    const cached = spreadCache.current.get(s);
    if (cached !== undefined) return cached;
    const k = spreadOfPage(pageOf(s));
    spreadCache.current.set(s, k);
    return k;
  };

  const lastSpread = () => spreadOfPage(pages - 1);

  /** The sentence's box on the spread (spread px, as the camera sees it), its lines on that spread only. */
  const spreadBox = (s: number, k: number): Box | null => {
    const shift = spreadShift(k, layout);
    const lines = boxesOf(s)
      .map((b) => ({ ...b, x: b.x - shift + layout.padOuter, y: b.y + layout.padTop }))
      .filter((b) => b.x + b.w > 0 && b.x < layout.pageW * 2);
    return unionBox(lines);
  };

  // Laid out (again): spans, pages; the current sentence stays on screen.
  useLayoutEffect(() => {
    const el = columns.current;
    if (!el || !size.w) return;
    spans.current = [];
    el.querySelectorAll<HTMLElement>('[data-i]').forEach((span) => {
      spans.current[Number(span.dataset.i)] = span;
    });
    spreadCache.current = new Map();
    setPages(pageCount(el.scrollWidth, layout));
    setLayoutRun((n) => n + 1);
  }, [blocks, layout]);

  // ── Where the camera and the spread go ─────────────────────────────────────
  const ownMove = useRef<number | null>(null);
  const highlighted = useRef<HTMLElement | null>(null);

  const followsSentence = mode !== 'normal' && zoom;
  const sentenceStep = mode === 'easy' && zoom;

  useLayoutEffect(() => {
    if (!layoutRun) return;
    // A turn made here already chose the spread; anything else (a jump, a new layout,
    // a rotation, Auto moving on) shows the spread the sentence starts on.
    const target = ownMove.current === pos ? spread : spreadOf(pos);
    ownMove.current = null;
    if (target !== spread) setSpread(target);
    // The sentence lit in Prosta with the zoom on.
    highlighted.current?.classList.remove('is-on');
    highlighted.current = null;
    if (sentenceStep) {
      const span = spans.current[pos];
      span?.classList.add('is-on');
      highlighted.current = span ?? null;
    }
    const box = zoomed && followsSentence ? spreadBox(pos, target) : null;
    setCamera(box ? zoomTo(box, { w: layout.pageW * 2, h: layout.pageH }) : OVERVIEW);
  }, [pos, layoutRun, zoomed, followsSentence, sentenceStep]);

  // ── Moving ─────────────────────────────────────────────────────────────────
  const turnTo = (k: number) => {
    const target = clamp(k, 0, lastSpread());
    if (target === spread) {
      if (k > spread) latest.current.onEnd();
      return;
    }
    const s = sentenceOfSpread(target, sents.length, spreadOf);
    ownMove.current = s;
    setSpread(target);
    if (s === pos) ownMove.current = null;
    latest.current.onPosition(s);
  };

  const step = (delta: number) => {
    if (mode === 'auto') {
      auto.current.word = 0;
      moveAuto(clamp(pos + delta, 0, sents.length - 1));
      return;
    }
    if (sentenceStep) {
      const s = pos + delta;
      if (s >= sents.length) return latest.current.onEnd();
      if (s < 0) return;
      setZoomed(true);
      latest.current.onPosition(s);
      return;
    }
    turnTo(spread + delta);
  };

  control.current = { next: () => step(1), prev: () => step(-1) };

  // A jump from the table of contents: Auto restarts its light there.
  const firstJump = useRef(jump.n);
  useEffect(() => {
    if (jump.n === firstJump.current) return;
    firstJump.current = jump.n;
    if (mode === 'auto') {
      auto.current.word = 0;
      moveAuto(jump.s);
    }
  }, [jump.n]);

  // ── Auto: the light ────────────────────────────────────────────────────────
  const auto = useRef({ sentence: pos, word: 0, timer: 0 });

  const placeLamp = () => {
    const el = lamp.current;
    const span = spans.current[auto.current.sentence];
    const text = span?.firstChild;
    const box = columns.current?.getBoundingClientRect();
    if (!el || !text || !box) return;
    const sentence = sents[auto.current.sentence]?.t ?? '';
    const r = wordRanges(sentence)[auto.current.word];
    if (!r) return;
    const range = document.createRange();
    range.setStart(text, Math.min(r.start, text.textContent?.length ?? 0));
    range.setEnd(text, Math.min(r.end, text.textContent?.length ?? 0));
    const rect = range.getClientRects()[0];
    if (!rect) return;
    const k = scaleNow();
    el.style.setProperty('--lamp-x', `${(rect.left - box.left) / k}px`);
    el.style.setProperty('--lamp-y', `${(rect.top - box.top) / k}px`);
    el.style.setProperty('--lamp-w', `${rect.width / k}px`);
    el.style.setProperty('--lamp-h', `${rect.height / k}px`);
    el.dataset.word = sentence.slice(r.start, r.end);
  };

  const moveAuto = (s: number) => {
    auto.current.sentence = s;
    placeLamp();
    if (s !== latest.current.pos) latest.current.onPosition(s);
    schedule();
  };

  const schedule = () => {
    const a = auto.current;
    clearTimeout(a.timer);
    if (latest.current.mode !== 'auto' || !latest.current.playing) return;
    const sentence = latest.current.sents[a.sentence]?.t ?? '';
    const words = wordRanges(sentence);
    const word = words[a.word];
    a.timer = window.setTimeout(
      () => {
        if (!latest.current.playing) return;
        if (a.word + 1 < words.length) {
          a.word++;
          placeLamp();
          schedule();
        } else if (a.sentence + 1 < latest.current.sents.length) {
          a.word = 0;
          moveAuto(a.sentence + 1);
        } else {
          latest.current.onEnd();
        }
      },
      wordDelay(word ? sentence.slice(word.start, word.end) : '', latest.current.wpm),
    );
  };

  // Entering Auto, or the text laid out anew: the light goes to the current sentence's word.
  useLayoutEffect(() => {
    if (mode !== 'auto' || !layoutRun) return;
    if (auto.current.sentence !== pos) {
      auto.current.sentence = pos;
      auto.current.word = 0;
    }
    placeLamp();
  }, [mode, layoutRun, spread, camera]);

  useEffect(() => {
    if (mode === 'auto' && playing) {
      // Auto follows its sentence with the zoom on.
      if (zoom) setZoomed(true);
      schedule();
    } else clearTimeout(auto.current.timer);
  }, [mode, playing]);

  useEffect(() => () => clearTimeout(auto.current.timer), []);

  // ── Taps ───────────────────────────────────────────────────────────────────
  const down = useRef({ x: 0, y: 0 });
  const onClick = (e: MouseEvent) => {
    if (Math.abs(e.clientX - down.current.x) > TAP || Math.abs(e.clientY - down.current.y) > TAP) return;
    if (mode === 'auto') {
      // A tap on a word moves the light there.
      const caret = document.caretRangeFromPoint?.(e.clientX, e.clientY);
      const span = (caret?.startContainer.parentElement ?? (e.target as Element)).closest<HTMLElement>('[data-i]');
      if (span) {
        const s = Number(span.dataset.i);
        auto.current.word = caret && span.contains(caret.startContainer) ? wordAt(sents[s]?.t ?? '', caret.startOffset) : 0;
        moveAuto(s);
        return;
      }
    }
    // Elsewhere a tap switches between the sentence close up and the whole spread.
    if (followsSentence) setZoomed((z) => !z);
  };

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
  const leftPage = spread * 2 + 1;
  const rightPage = spread * 2 + 2;

  return (
    <div class="spread" data-zoomed={zoomed && followsSentence ? 'true' : 'false'}>
      <div class="spread__side spread__side--left">{swap ? back : forward}</div>
      <div ref={frame} class="spread__frame" {...props.swipe}>
        <div
          class="spread__camera"
          data-testid="spread-camera"
          style={{ '--cam-x': `${camera.x}px`, '--cam-y': `${camera.y}px`, '--cam-scale': String(camera.scale) }}
          onPointerDown={(e) => {
            down.current = { x: e.clientX, y: e.clientY };
          }}
          onClick={onClick}
        >
          <div class="spread__page spread__page--left" aria-hidden="true">
            <span class="spread__folio" data-testid="folio-left">
              {leftPage}
            </span>
          </div>
          <div class="spread__page spread__page--right" aria-hidden="true">
            {rightPage <= pages && (
              <span class="spread__folio" data-testid="folio-right">
                {rightPage}
              </span>
            )}
          </div>
          <div class="spread__gutter" aria-hidden="true" />
          <div
            ref={columns}
            class="spread__columns"
            data-testid="spread-columns"
            style={{
              '--col-w': `${layout.colW}px`,
              '--col-h': `${layout.colH}px`,
              '--col-gap': `${layout.gap}px`,
              '--col-left': `${layout.padOuter}px`,
              '--col-top': `${layout.padTop}px`,
              '--col-shift': `${-spreadShift(spread, layout)}px`,
              '--page-font': `${pageFont}px`,
            }}
          >
            {mode === 'auto' && <div ref={lamp} class="spread__lamp" data-testid="spread-lamp" aria-hidden="true" />}
            {blocks}
          </div>
        </div>
      </div>
      <div class="spread__side spread__side--right">{swap ? forward : back}</div>
    </div>
  );
}
