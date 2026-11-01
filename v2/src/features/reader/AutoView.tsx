// Auto: a light walks the section word by word at the chosen pace (domain wordDelay:
// longer at punctuation and long words), keeping the lit line at a third of the
// screen; at the end of a section it goes on to the next one, at the end of the book
// it stops. A tap on a word moves the light there. The lit word is a class on spans
// built once per section, so each step touches two elements, not the whole text.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Section, Sentence } from '@/domain/reader/book';
import { wordDelay, wordsOf } from '@/domain/reader/settings';
import type { Jump } from './Reader';
import { sectionBlocks, smoothScroll } from './blocks';

interface AutoViewProps {
  sents: readonly Sentence[];
  sections: readonly Section[];
  secStart: readonly number[];
  /** The sentence to start at. */
  start: number;
  /** A move asked from outside (the table of contents, the arrow keys). */
  jump: Jump;
  playing: boolean;
  wpm: number;
  size: number;
  /** The light reached another sentence. */
  onSentence: (sentence: number) => void;
  /** The light passed the book's last word. */
  onEnd: () => void;
}

interface SectionWords {
  blocks: ReturnType<typeof sectionBlocks>;
  /** Per word: its sentence and its text. */
  sent: number[];
  text: string[];
  /** Per sentence of the section: its first word. */
  firstWord: Map<number, number>;
}

export function AutoView(props: AutoViewProps) {
  // The pace is read when the next word is timed: a change applies from the next word.
  const { sents, sections, secStart, start, jump, playing, size } = props;
  const [sec, setSec] = useState(() => sents[start]?.sec ?? 0);
  const view = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const st = useRef({
    words: [] as HTMLElement[],
    idx: 0,
    lit: null as HTMLElement | null,
    lastTop: -1,
    lastSent: -1,
    timer: 0,
    /** Sentence to light once the section's words are on screen. */
    pending: start as number | null,
    toTop: false,
  });

  const model = useMemo((): SectionWords => {
    const sent: number[] = [];
    const text: string[] = [];
    const firstWord = new Map<number, number>();
    const blocks = sectionBlocks(sents, sections, secStart, sec, (i, s) => {
      firstWord.set(i, sent.length);
      return wordsOf(s.t).map((word) => {
        const k = sent.length;
        sent.push(i);
        text.push(word);
        return (
          <span key={k} class="reader__w" data-k={k}>
            {word}
          </span>
        );
      });
    });
    return { blocks, sent, text, firstWord };
  }, [sents, sections, secStart, sec]);
  const modelRef = useRef(model);
  modelRef.current = model;

  const setWord = (i: number, smooth: boolean) => {
    const s = st.current;
    const el = s.words[i];
    const box = view.current;
    if (!el || !box) return;
    s.lit?.classList.remove('is-now');
    s.idx = i;
    s.lit = el;
    el.classList.add('is-now');
    const top = el.offsetTop;
    if (top !== s.lastTop) {
      s.lastTop = top;
      box.scrollTo({ top: Math.max(0, top - box.clientHeight * 0.36), behavior: smooth ? smoothScroll() : 'auto' });
    }
    const sentence = modelRef.current.sent[i] ?? 0;
    if (sentence !== s.lastSent) {
      s.lastSent = sentence;
      latest.current.onSentence(sentence);
    }
  };

  const nextSection = () => {
    const m = modelRef.current;
    const next = (m.sent[m.sent.length - 1] ?? 0) + 1;
    const { sents: all } = latest.current;
    const target = all[next];
    if (!target) {
      latest.current.onEnd();
      return;
    }
    st.current.pending = next;
    st.current.toTop = true;
    setSec(target.sec);
  };

  const schedule = () => {
    const s = st.current;
    clearTimeout(s.timer);
    if (!latest.current.playing || !s.words.length) return;
    s.timer = window.setTimeout(
      () => {
        if (!latest.current.playing) return;
        if (s.idx + 1 < s.words.length) {
          setWord(s.idx + 1, true);
          schedule();
        } else {
          nextSection();
        }
      },
      wordDelay(modelRef.current.text[s.idx] ?? '', latest.current.wpm),
    );
  };

  // A section's words are on screen: light the pending one and go on if playing.
  useLayoutEffect(() => {
    const s = st.current;
    s.words = [...(view.current?.querySelectorAll<HTMLElement>('.reader__w') ?? [])];
    s.lit = null;
    s.lastTop = -1;
    s.lastSent = -1;
    if (s.toTop && view.current) view.current.scrollTop = 0;
    s.toTop = false;
    if (s.pending !== null) {
      setWord(model.firstWord.get(s.pending) ?? 0, false);
      s.pending = null;
    }
    schedule();
  }, [model]);

  const firstJump = useRef(jump.n);
  useEffect(() => {
    if (jump.n === firstJump.current) return;
    const s = Math.min(Math.max(jump.s, 0), sents.length - 1);
    const target = sents[s];
    if (!target) return;
    if (target.sec !== sec) {
      st.current.pending = s;
      setSec(target.sec);
      return;
    }
    setWord(model.firstWord.get(s) ?? 0, false);
    schedule();
  }, [jump.n]);

  useEffect(() => {
    if (playing) schedule();
    else clearTimeout(st.current.timer);
  }, [playing]);

  const firstSize = useRef(size);
  useEffect(() => {
    if (size === firstSize.current) return;
    firstSize.current = size;
    st.current.lastTop = -1;
    setWord(st.current.idx, false);
  }, [size]);

  useEffect(() => () => clearTimeout(st.current.timer), []);

  return (
    <div
      ref={view}
      class="reader__scroller reader__scroller--auto"
      onClick={(e) => {
        const w = (e.target as Element).closest<HTMLElement>('.reader__w');
        if (!w) return;
        setWord(Number(w.dataset.k), false);
        schedule();
      }}
    >
      <div class="reader__full">{model.blocks}</div>
    </div>
  );
}
