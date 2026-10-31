// Back from a book: when the library opened it, the library is the previous history
// entry, so Back steps back to it (the system Back does the same); a book opened from
// a link or after a reload replaces itself with the library instead.
let fromLibrary = false;

export function markOpenedFromLibrary(): void {
  fromLibrary = true;
}

/** Consumes the mark: true once after the library opened a book. */
export function takeOpenedFromLibrary(): boolean {
  const was = fromLibrary;
  fromLibrary = false;
  return was;
}
