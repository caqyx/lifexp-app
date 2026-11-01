// Prosta, sentence view: the current one or two sentences, large, the section's name
// above its first sentence. A move forward or back brings the new text up into place.
import type { Section, Sentence } from '@/domain/reader/book';
import { sectionName } from './texts';

interface EasyTextProps {
  sents: readonly Sentence[];
  sections: readonly Section[];
  secStart: readonly number[];
  start: number;
  end: number;
  /** Changes when the move should animate (a step, not a slider drag or a mode change). */
  anim: number;
}

export function EasyText({ sents, sections, secStart, start, end, anim }: EasyTextProps) {
  const first = sents[start];
  if (!first) return null;
  const label = start === secStart[first.sec] ? sectionName(sections[first.sec], first.sec) : '';
  const text = sents
    .slice(start, end)
    .map((s) => s.t)
    .join(' ');
  return (
    <div class="reader__easy-inner">
      <div class="reader__easy-label">{label}</div>
      <div
        key={anim}
        class={`reader__easy-text${first.h ? ' is-heading' : ''}${anim > 0 ? ' is-entering' : ''}`}
        data-testid="reader-easy-text"
      >
        {text}
      </div>
    </div>
  );
}
