// Words of the reader that depend on the book: section names, import errors.
import { isPlainSection, type Section } from '@/domain/reader/book';
import { locale, t } from '@/i18n';
import { formatInteger } from '@/lib/format';
import { ReaderImportError } from '@/services/reader';

/** The section's own title, or the one the parser made up, in the reader's language. */
export function sectionName(sec: Section | undefined, index: number): string {
  if (!sec) return '';
  if (sec.title) return sec.title;
  const label = sec.label ?? { kind: 'part' as const, n: index + 1 };
  return t(`reader.sections.${label.kind}`, { n: label.n });
}

/** A heading above the section's text, unless its name is only a page or part number. */
export function sectionHeading(sec: Section | undefined, index: number): string | null {
  if (!sec || isPlainSection(sec)) return null;
  return sectionName(sec, index) || null;
}

/** The crumb: the book's title and, when it says more, the section's. */
export function crumbText(bookTitle: string, sec: Section | undefined, index: number): string {
  const name = sectionHeading(sec, index);
  return name && name !== bookTitle ? `${bookTitle}  ·  ${name}` : bookTitle;
}

export const fmt = (n: number) => formatInteger(n, locale());

export function importErrorMessage(err: unknown): string {
  if (err instanceof ReaderImportError) {
    switch (err.problem) {
      case 'unsupported':
        return t('reader.errors.unsupported', { ext: err.detail });
      case 'brokenEpub':
        return t('reader.errors.brokenEpub', { path: err.detail });
      default:
        return t(`reader.errors.${err.problem}`);
    }
  }
  return t('reader.errors.unreadable');
}
