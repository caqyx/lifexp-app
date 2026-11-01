// One section's text as paragraphs and headings, built once per section: the views
// that light sentences or words (Cała strona, Auto) then only toggle classes on
// what is already there, so a step does not re-render hundreds of spans.
import type { ComponentChildren, VNode } from 'preact';
import type { Section, Sentence } from '@/domain/reader/book';
import { cssDurationMs } from '@/ui/motion';
import { sectionHeading } from './texts';

/** First and one-past-last sentence of section `si`. */
export function sectionRange(sents: readonly Sentence[], secStart: readonly number[], si: number): [number, number] {
  return [secStart[si] ?? 0, secStart[si + 1] ?? sents.length];
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
  while (i < to) {
    const head = sents[i] as Sentence;
    const children: ComponentChildren[] = [];
    while (i < to && (sents[i] as Sentence).para === head.para) {
      for (const piece of pieces(i, sents[i] as Sentence)) {
        if (children.length) children.push(' ');
        children.push(piece);
      }
      i++;
    }
    out.push(head.h ? <h3 key={i}>{children}</h3> : <p key={i}>{children}</p>);
  }
  return out;
}

/** Duration tokens are 0 ms when the system asks for reduced motion (ui/tokens.css). */
export function smoothScroll(): ScrollBehavior {
  return cssDurationMs('--duration-enter') > 0 ? 'smooth' : 'auto';
}
