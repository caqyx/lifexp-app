// Prosta, "Cała strona": the whole section, the current sentences highlighted and
// scrolled to a third of the screen; a tap on a sentence moves there.
import { useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import type { Section, Sentence } from '@/domain/reader/book';
import { sectionBlocks, smoothScroll } from './blocks';

interface PageViewProps {
  sents: readonly Sentence[];
  sections: readonly Section[];
  secStart: readonly number[];
  start: number;
  end: number;
  /** Changes when the move should scroll smoothly. */
  anim: number;
  size: number;
  onPick: (sentence: number) => void;
}

export function PageView({ sents, sections, secStart, start, end, anim, size, onPick }: PageViewProps) {
  const view = useRef<HTMLDivElement>(null);
  const spans = useRef(new Map<number, HTMLElement>());
  const lit = useRef<HTMLElement[]>([]);
  const lastAnim = useRef(anim);
  const sec = sents[start]?.sec ?? 0;

  const blocks = useMemo(
    () =>
      sectionBlocks(sents, sections, secStart, sec, (i, s) => [
        <span key={i} class="reader__sent" data-i={i}>
          {s.t}
        </span>,
      ]),
    [sents, sections, secStart, sec],
  );

  useLayoutEffect(() => {
    const map = new Map<number, HTMLElement>();
    view.current?.querySelectorAll<HTMLElement>('[data-i]').forEach((el) => map.set(Number(el.dataset.i), el));
    spans.current = map;
    lit.current = [];
    if (view.current) view.current.scrollTop = 0;
  }, [blocks]);

  useLayoutEffect(() => {
    const el = view.current;
    if (!el) return;
    const animate = anim !== lastAnim.current;
    lastAnim.current = anim;
    lit.current.forEach((s) => s.classList.remove('is-on'));
    lit.current = [];
    for (let i = start; i < end; i++) {
      const span = spans.current.get(i);
      if (span) {
        span.classList.add('is-on');
        lit.current.push(span);
      }
    }
    const target = lit.current[0];
    if (target) el.scrollTo({ top: Math.max(0, target.offsetTop - el.clientHeight * 0.3), behavior: animate ? smoothScroll() : 'auto' });
  }, [blocks, start, end, anim, size]);

  return (
    <div
      ref={view}
      class="reader__scroller reader__scroller--page"
      onClick={(e) => {
        const span = (e.target as Element).closest<HTMLElement>('[data-i]');
        if (span) onPick(Number(span.dataset.i));
      }}
    >
      <div class="reader__full">{blocks}</div>
    </div>
  );
}
