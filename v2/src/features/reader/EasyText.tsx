// Prosta, sentence view: the current one or two sentences, large, the section's name
// above its first sentence. A move forward or back brings the new text up into place.
// A picture or a table right before the sentences (or after the section's last one)
// shows with them; stepping itself goes from sentence to sentence, past the elements.
import type { Section, Sentence } from '@/domain/reader/book';
import { elementsAfter, elementsBefore } from './blocks';
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
  const before = elementsBefore(sents, sections, start);
  const after = elementsAfter(sents, sections, end - 1);
  return (
    <div class="reader__easy-inner">
      <div class="reader__easy-label">{label}</div>
      <div key={anim} class={`reader__easy-group${anim > 0 ? ' is-entering' : ''}`}>
        {before.length > 0 && <div class="reader__easy-els">{before}</div>}
        <div class={`reader__easy-text${first.h ? ' is-heading' : ''}`} data-testid="reader-easy-text">
          {text}
        </div>
        {after.length > 0 && <div class="reader__easy-els">{after}</div>}
      </div>
    </div>
  );
}
