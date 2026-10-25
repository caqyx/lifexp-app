import { describe, expect, it } from 'vitest';
import { createSerial } from './serial';

const later = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('createSerial', () => {
  it('runs jobs in the order queued, even when an earlier one is slower', async () => {
    const serial = createSerial();
    const done: string[] = [];
    await Promise.all([
      serial(async () => {
        await later(30);
        done.push('old save');
      }),
      serial(async () => {
        await later(1);
        done.push('clear');
      }),
    ]);
    expect(done).toEqual(['old save', 'clear']);
  });

  it('never overlaps two jobs', async () => {
    const serial = createSerial();
    let running = 0;
    let most = 0;
    const job = async () => {
      running += 1;
      most = Math.max(most, running);
      await later(2);
      running -= 1;
    };
    await Promise.all([serial(job), serial(job), serial(job)]);
    expect(most).toBe(1);
  });

  it('hands back each job’s own result, and a failure does not stop the next job', async () => {
    const serial = createSerial();
    const failing = serial(() => Promise.reject(new Error('boom')));
    const next = serial(() => Promise.resolve(7));
    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe(7);
  });
});
