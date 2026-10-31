// Normalny: the whole book as ordinary text, scrolled freely. The position is the
// paragraph at the top of the screen (the last sentence at the very end), reported
// once a frame while scrolling. Built once per book.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import { lastAtOrBefore, type Section, type Sentence } from '@/domain/reader/book';
import type { VNode } from 'preact';
import type { Jump } from './Reader';
import { sectionHeading } from './texts';

interface NormalViewProps {
  sents: readonly Sentence[];
  sections: readonly Section[];
  secStart: readonly number[];
  /** Where to open. */
  start: number;
  /** Where reading is now (kept in place when the text size changes). */
  current: number;
  jump: Jump;
  size: number;
  onPosition: (sentence: number) => void;
}

export function NormalView({ sents, sections, secStart, start, current, jump, size, onPosition }: NormalViewProps) {
  const view = useRef<HTMLDivElement>(null);
  const paras = useRef<{ el: HTMLElement; s: number }[]>([]);
  /** scrollTop the reader itself scrolled to, until its scroll event arrives. */
  const ignoreTop = useRef<number | null>(null);
  const ticking = useRef(false);
  const currentRef = useRef(current);
  currentRef.current = current;

  const blocks = useMemo(() => {
    const out: VNode[] = [];
    let i = 0;
    while (i < sents.length) {
      const s = sents[i] as Sentence;
      const first = i;
      if (secStart[s.sec] === i) {
        const heading = sectionHeading(sections[s.sec], s.sec);
        if (heading) out.push(<h2 key={`h${s.sec}`}>{heading}</h2>);
      }
      while (i < sents.length && (sents[i] as Sentence).sec === s.sec && (sents[i] as Sentence).para === s.para) i++;
      const text = sections[s.sec]?.paras[s.para]?.t ?? '';
      out.push(
        s.h ? (
          <h3 key={first} data-s={first}>
            {text}
          </h3>
        ) : (
          <p key={first} data-s={first}>
            {text}
          </p>
        ),
      );
    }
    return out;
  }, [sents, sections, secStart]);

  const scrollToSentence = (idx: number) => {
    const box = view.current;
    const list = paras.current;
    if (!box || !list.length) return;
    const at = list[lastAtOrBefore(list.map((p) => p.s), idx)];
    const top = Math.max(0, (at?.el.offsetTop ?? 0) - 12);
    if (Math.abs(box.scrollTop - top) < 1) return;
    box.scrollTop = top;
    // The scroll this causes is not the reader's: it must not move the position.
    ignoreTop.current = box.scrollTop;
  };

  useLayoutEffect(() => {
    paras.current = [...(view.current?.querySelectorAll<HTMLElement>('[data-s]') ?? [])].map((el) => ({ el, s: Number(el.dataset.s) }));
    const frame = requestAnimationFrame(() => scrollToSentence(start));
    return () => cancelAnimationFrame(frame);
  }, [blocks]);

  const firstJump = useRef(jump.n);
  useEffect(() => {
    if (jump.n !== firstJump.current) scrollToSentence(jump.s);
  }, [jump.n]);

  const firstSize = useRef(size);
  useEffect(() => {
    if (size === firstSize.current) return;
    firstSize.current = size;
    scrollToSentence(currentRef.current);
  }, [size]);

  const onScroll = () => {
    const box0 = view.current;
    if (box0 && ignoreTop.current !== null) {
      const own = Math.abs(box0.scrollTop - ignoreTop.current) < 1;
      ignoreTop.current = null;
      if (own) return;
    }
    if (ticking.current) return;
    ticking.current = true;
    requestAnimationFrame(() => {
      ticking.current = false;
      const box = view.current;
      const list = paras.current;
      if (!box || !list.length) return;
      const y = box.scrollTop + 16;
      let lo = 0;
      let hi = list.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if ((list[mid]?.el.offsetTop ?? 0) <= y) lo = mid;
        else hi = mid - 1;
      }
      const atEnd = box.scrollTop + box.clientHeight >= box.scrollHeight - 4;
      onPosition(atEnd ? sents.length - 1 : (list[lo]?.s ?? 0));
    });
  };

  return (
    <div ref={view} class="reader__scroller reader__scroller--normal" onScroll={onScroll}>
      <div class="reader__full">{blocks}</div>
    </div>
  );
}
