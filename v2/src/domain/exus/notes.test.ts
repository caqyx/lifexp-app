import { describe, expect, it } from 'vitest';
import type { Note } from '../notes';
import { searchNotes } from './notes';

let n = 0;
const note = (title: string, content = '', over: Partial<Note> = {}): Note => ({
  id: `n${(n += 1)}`,
  title,
  content,
  icon: '',
  color: '',
  createdAt: new Date(Date.UTC(2026, 9, n)),
  archived: false,
  ...over,
});

const titles = (notes: Note[], query: string, max?: number) => searchNotes(notes, query, max).hits.map((h) => h.note.title);

describe('searchNotes', () => {
  it('ignores case and Polish letters, in the title and in the content', () => {
    const list = [note('Zażółć gęślą jaźń'), note('Inna', 'Kupić ŻÓŁTY ser')];
    expect(titles(list, 'zazolc')).toEqual(['Zażółć gęślą jaźń']);
    expect(titles(list, 'zolty')).toEqual(['Inna']);
    expect(titles(list, 'ŻÓŁTY')).toEqual(['Inna']);
  });

  it('wants every word, anywhere in the note', () => {
    const list = [note('Zakupy', 'mleko i chleb'), note('Plan', 'chleb')];
    expect(titles(list, 'chleb mleko')).toEqual(['Zakupy']);
    expect(titles(list, 'chleb')).toHaveLength(2);
    expect(titles(list, 'masło')).toEqual([]);
  });

  it('a title hit ranks above a content hit, a title that starts with it first; then active, then newer', () => {
    const inContent = note('Inne', 'o rowerze');
    const inTitle = note('Mój rower');
    const startsTitle = note('Rower górski');
    const archived = note('Rower stary', '', { archived: true });
    const newer = note('Rower miejski');
    expect(titles([inContent, inTitle, archived, startsTitle, newer], 'rower')).toEqual([
      'Rower miejski',
      'Rower górski',
      'Rower stary',
      'Mój rower',
      'Inne',
    ]);
  });

  it('gives the best five and counts the rest', () => {
    const list = Array.from({ length: 8 }, (_, i) => note(`Rower ${i}`));
    const { hits, total } = searchNotes(list, 'rower');
    expect(hits).toHaveLength(5);
    expect(total).toBe(8);
    expect(hits[0]!.note.title).toBe('Rower 7');
  });

  it('an empty query finds nothing', () => {
    expect(searchNotes([note('A')], '   ')).toEqual({ hits: [], total: 0 });
  });

  it('the snippet is a short plain piece around the hit, the start of the content when only the title matched', () => {
    const long = `${'Lorem ipsum dolor sit amet. '.repeat(6)}Tu jest **Żółw** w środku zdania i dalej ${'tekst '.repeat(20)}`;
    const [hit] = searchNotes([note('Zwierzęta', long)], 'zolw').hits;
    expect(hit!.snippet).toContain('Żółw');
    expect(hit!.snippet).not.toContain('**');
    expect(hit!.snippet.startsWith('…')).toBe(true);
    expect(hit!.snippet.endsWith('…')).toBe(true);
    expect(hit!.snippet.length).toBeLessThanOrEqual(95);
    expect(searchNotes([note('Żółw', 'nic **ważnego**')], 'zolw').hits[0]!.snippet).toBe('nic ważnego');
    expect(searchNotes([note('Żółw')], 'zolw').hits[0]!.snippet).toBe('');
    expect(searchNotes([note('Notatka', 'Żółw')], 'zolw').hits[0]!.snippet).toBe('Żółw');
  });
});
