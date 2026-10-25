// Runs async jobs one after another, in the order they were queued, whatever each takes.
// A failed job does not stop the ones behind it. For storage whose writes must land in the
// order they were made (an earlier write that finishes late would overwrite a later one).

export type Serial = <T>(job: () => Promise<T>) => Promise<T>;

export function createSerial(): Serial {
  let tail: Promise<unknown> = Promise.resolve();
  return (job) => {
    const run = tail.then(job, job);
    tail = run.catch(() => undefined);
    return run;
  };
}
