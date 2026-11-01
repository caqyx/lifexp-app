// Why a file could not be imported into the reader; the screen words it (i18n reader.errors.*).

export type ReaderImportProblem =
  /** The extension is not PDF, EPUB, TXT or MD (detail: the extension). */
  | 'unsupported'
  /** No text at all in the file. */
  | 'empty'
  /** A PDF without a text layer (a scan). */
  | 'scanned'
  /** The EPUB lacks a file it names (detail: its path). */
  | 'brokenEpub'
  /** The EPUB has no OPF (container.xml names none). */
  | 'noOpf'
  /** The PDF or EPUB support did not load (offline on first use). */
  | 'library'
  /** The file could not be read (detail: the browser's message). */
  | 'unreadable';

export class ReaderImportError extends Error {
  constructor(
    readonly problem: ReaderImportProblem,
    readonly detail = '',
  ) {
    super(detail ? `${problem}: ${detail}` : problem);
    this.name = 'ReaderImportError';
  }
}
