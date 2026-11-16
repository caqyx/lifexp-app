// One section's text as paragraphs and headings, built once per section: the views
// that light sentences or words (Cała strona, Auto) then only toggle classes on
// what is already there, so a step does not re-render hundreds of spans.
import type { ComponentChildren, VNode } from 'preact';
import { elementsBetween, type Section, type Sentence } from '@/domain/reader/book';
import { cssDurationMs } from '@/ui/motion';
import { ElementBlock } from './ElementBlock';
import { sectionHeading } from './texts';

/** First and one-past-last sentence of section `si`. */
export function sectionRange(sents: readonly Sentence[], secStart: readonly number[], si: number): [number, number] {
  return [secStart[si] ?? 0, secStart[si + 1] ?? sents.length];
}

/**
 * Classes of paragraph `k` in a frame (ramka): the frame is drawn around a run of
 * paragraphs, its top on the first and its bottom on the last.
 */
export function frameClass(sec: Section | undefined, k: number): string {
  const f = sec?.paras[k]?.frame;
  if (f === undefined || !sec) return '';
  let cls = ' reader-framed';
  if (sec.paras[k - 1]?.frame !== f) cls += ' reader-framed--first';
  if (sec.paras[k + 1]?.frame !== f) cls += ' reader-framed--last';
  return cls;
}

/** The elements (pictures, tables) between paragraphs `from` and `to` of a section, in their places. */
export function elementNodes(sections: readonly Section[], si: number, from: number, to: number): VNode[] {
  const sec = sections[si];
  return elementsBetween(sec, from, to).map(({ para, el }) => <ElementBlock key={`e${si}-${para}`} el={el} cls={frameClass(sec, para)} />);
}

/** The elements just before sentence `i`, when it starts a paragraph (none inside a paragraph). */
export function elementsBefore(sents: readonly Sentence[], sections: readonly Section[], i: number): VNode[] {
  const s = sents[i];
  if (!s) return [];
  const prev = sents[i - 1];
  if (prev && prev.sec === s.sec && prev.para === s.para) return [];
  return elementNodes(sections, s.sec, prev && prev.sec === s.sec ? prev.para : -1, s.para);
}

/** The elements after sentence `i`, when it is the last of its section (those after the section's text). */
export function elementsAfter(sents: readonly Sentence[], sections: readonly Section[], i: number): VNode[] {
  const s = sents[i];
  if (!s || sents[i + 1]?.sec === s.sec) return [];
  return elementNodes(sections, s.sec, s.para, Infinity);
}

/**
 * The section's heading and paragraphs; `pieces` turns one sentence into its inline
 * children (separated by spaces, as the text was).
 */
export function sectionBlocks(
  sents: readonly Sentence[],
  sections: readonly Section[],
  secStart: readonly number[],
  si: number,
  pieces: (i: number, s: Sentence) => ComponentChildren[],
): VNode[] {
  const out: VNode[] = [];
  const heading = sectionHeading(sections[si], si);
  if (heading) out.push(<h2 key="h">{heading}</h2>);
  const [from, to] = sectionRange(sents, secStart, si);
  let i = from;
  let prev = -1;
  while (i < to) {
    const head = sents[i] as Sentence;
    out.push(...elementNodes(sections, si, prev, head.para));
    prev = head.para;
    const children: ComponentChildren[] = [];
    while (i < to && (sents[i] as Sentence).para === head.para) {
      for (const piece of pieces(i, sents[i] as Sentence)) {
        if (children.length) children.push(' ');
        children.push(piece);
      }
      i++;
    }
    const cls = frameClass(sections[si], head.para).trim() || undefined;
    out.push(
      head.h ? (
        <h3 key={i} class={cls}>
          {children}
        </h3>
      ) : (
        <p key={i} class={cls}>
          {children}
        </p>
      ),
    );
  }
  out.push(...elementNodes(sections, si, prev, Infinity));
  return out;
}

/** Duration tokens are 0 ms when the system asks for reduced motion (ui/tokens.css). */
export function smoothScroll(): ScrollBehavior {
  return cssDurationMs('--duration-enter') > 0 ? 'smooth' : 'auto';
}
