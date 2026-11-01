import { describe, expect, it } from 'vitest';
import { endsWithAbbreviation, MAX_SENTENCE, normSpace, splitLong, splitSentences } from './sentences';

describe('normSpace', () => {
  it('turns non-breaking and figure spaces into spaces and collapses runs', () => {
    expect(normSpace('  a\u00a0b\u2007c\u202fd \n\t e  ')).toBe('a b c d e');
  });
});

describe('splitSentences', () => {
  it('splits at . ! ? … before a capital letter', () => {
    expect(splitSentences('Ala ma kota. Kot ma Alę! Czy na pewno? Tak… Oczywiście.')).toEqual([
      'Ala ma kota.',
      'Kot ma Alę!',
      'Czy na pewno?',
      'Tak…',
      'Oczywiście.',
    ]);
  });

  it('splits before Polish capitals, digits, opening quotes and dashes', () => {
    expect(splitSentences('To koniec. Łódź jest duża. 2024 był dobry. „Cytat” padł. — Dialog.')).toEqual([
      'To koniec.',
      'Łódź jest duża.',
      '2024 był dobry.',
      '„Cytat” padł.',
      '— Dialog.',
    ]);
  });

  it('keeps closing quotes and brackets with the sentence they end', () => {
    expect(splitSentences('Powiedział: „Idę.” Potem wyszedł. (Naprawdę.) Koniec.')).toEqual([
      'Powiedział: „Idę.”',
      'Potem wyszedł.',
      '(Naprawdę.)',
      'Koniec.',
    ]);
  });

  it('does not split after a lower-case start', () => {
    expect(splitSentences('Było 5 kg. ziemniaków i wody.')).toEqual(['Było 5 kg. ziemniaków i wody.']);
  });

  it('does not split after Polish abbreviations', () => {
    expect(splitSentences('Przyszedł m.in. Jan. Był też prof. Nowak i dr Kowalski.')).toEqual([
      'Przyszedł m.in. Jan.',
      'Był też prof. Nowak i dr Kowalski.',
    ]);
    expect(splitSentences('Mieszka przy ul. Długiej, zob. Rozdz. 3 i tzw. Starym Mieście.')).toHaveLength(1);
    expect(splitSentences('Kupił np. Chleb. Potem św. Mikołaj przyszedł.')).toEqual([
      'Kupił np. Chleb.',
      'Potem św. Mikołaj przyszedł.',
    ]);
  });

  it('does not split after an initial', () => {
    expect(splitSentences('Autorem jest J. R. R. Tolkien. Książka jest długa.')).toEqual([
      'Autorem jest J. R. R. Tolkien.',
      'Książka jest długa.',
    ]);
    expect(splitSentences('Wiersz napisał (A. Mickiewicz) dawno. Tak.')).toEqual(['Wiersz napisał (A. Mickiewicz) dawno.', 'Tak.']);
  });

  it('does not split after English abbreviations', () => {
    expect(splitSentences('Mr. Smith met Mrs. Jones vs. Dr. Who. Then they left.')).toEqual([
      'Mr. Smith met Mrs. Jones vs. Dr. Who.',
      'Then they left.',
    ]);
  });

  it('gives nothing for empty text', () => {
    expect(splitSentences('   ')).toEqual([]);
  });

  it('cuts sentences longer than the limit', () => {
    const long = `${'Słowo '.repeat(40).trim()}, ${'inne słowo '.repeat(20).trim()}.`;
    expect(long.length).toBeGreaterThan(MAX_SENTENCE);
    const parts = splitSentences(long);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join(' ')).toBe(long);
  });
});

describe('endsWithAbbreviation', () => {
  it('knows initials and abbreviations, not ordinary words', () => {
    expect(endsWithAbbreviation('Jak mówi J.')).toBe(true);
    expect(endsWithAbbreviation('Było to itd.')).toBe(true);
    expect(endsWithAbbreviation('Był tam „ks.')).toBe(true);
    expect(endsWithAbbreviation('Koniec zdania.')).toBe(false);
    expect(endsWithAbbreviation('Pytanie np?')).toBe(false);
    expect(endsWithAbbreviation('')).toBe(false);
  });
});

describe('splitLong', () => {
  it('leaves short text alone', () => {
    expect(splitLong('Krótkie zdanie.')).toEqual(['Krótkie zdanie.']);
  });

  it('cuts at the comma, colon, semicolon or spaced dash nearest the middle', () => {
    const a = 'a'.repeat(100);
    const b = 'b'.repeat(80);
    const c = 'c'.repeat(120);
    const text = `${a}, ${b} — ${c}`;
    expect(text.length).toBeGreaterThan(MAX_SENTENCE);
    // middle ≈ 152: the dash cut (after "— ", at 186) is farther than the comma cut (102)? 152-102 = 50, 186-152 = 34.
    expect(splitLong(text)).toEqual([`${a}, ${b} —`, c]);
  });

  it('ignores cuts within 50 characters of either end', () => {
    const text = `${'x'.repeat(20)}, ${'y'.repeat(300)}`;
    expect(splitLong(text)).toEqual([text]);
  });

  it('cuts a very long sentence without punctuation at a space before the middle', () => {
    const words = Array.from({ length: 100 }, (_, i) => `słowo${i}`).join(' ');
    expect(words.length).toBeGreaterThan(MAX_SENTENCE * 1.6);
    const parts = splitLong(words);
    expect(parts.length).toBe(2);
    // Halves still over the limit but under the hard one stay whole (nowhere better to cut).
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(MAX_SENTENCE * 1.6);
    expect(parts[0]?.endsWith(' ')).toBe(false);
    expect(parts.join(' ')).toBe(words);
  });

  it('keeps a long sentence without punctuation under the hard limit whole', () => {
    const words = Array.from({ length: 45 }, (_, i) => `wyraz${i}`).join(' ');
    expect(words.length).toBeGreaterThan(MAX_SENTENCE);
    expect(words.length).toBeLessThan(MAX_SENTENCE * 1.6);
    expect(splitLong(words)).toEqual([words]);
  });

  it('splits recursively until every part fits', () => {
    const clause = (ch: string) => `${ch.repeat(90)}`;
    const text = [clause('a'), clause('b'), clause('c'), clause('d'), clause('e')].join(', ');
    const parts = splitLong(text);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(MAX_SENTENCE);
    expect(parts.join(' ')).toBe(text);
  });
});
