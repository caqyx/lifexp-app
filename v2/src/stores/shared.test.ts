import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { session } from './session';
import { sharedWatch } from './shared';

const GRACE = 1000;

function signIn(uid: string) {
  session.value = {
    status: 'signedIn',
    user: { uid, email: `${uid}@test`, displayName: null, emailVerified: true },
    profile: 'loading',
  };
}

function fakeStore() {
  const log: string[] = [];
  let failed = false;
  const watch = sharedWatch(
    (uid) => {
      log.push(`start ${uid}`);
      return () => log.push(`stop ${uid}`);
    },
    GRACE,
    () => failed,
  );
  return { watch, log, fail: () => (failed = true) };
}

describe('sharedWatch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    signIn('u1');
  });
  afterEach(() => {
    vi.useRealTimers();
    session.value = { status: 'loading' };
  });

  test('screens watching the same account share one set of listeners', () => {
    const { watch, log } = fakeStore();
    const leaveA = watch('u1');
    const leaveB = watch('u1');
    leaveA();
    vi.advanceTimersByTime(GRACE * 2);
    expect(log).toEqual(['start u1']);
    leaveB();
    leaveB(); // leaving twice counts once
    vi.advanceTimersByTime(GRACE);
    expect(log).toEqual(['start u1', 'stop u1']);
  });

  test('coming back within the grace keeps the listeners; later they stop', () => {
    const { watch, log } = fakeStore();
    watch('u1')();
    vi.advanceTimersByTime(GRACE - 1);
    const leave = watch('u1');
    vi.advanceTimersByTime(GRACE);
    expect(log).toEqual(['start u1']);
    leave();
    vi.advanceTimersByTime(GRACE);
    expect(log).toEqual(['start u1', 'stop u1']);
  });

  test('another account stops the previous one at once', () => {
    const { watch, log } = fakeStore();
    watch('u1');
    signIn('u2');
    watch('u2');
    expect(log).toEqual(['start u1', 'stop u1', 'start u2']);
  });

  test('after signing out, the last screen leaving stops the listeners without a grace', () => {
    const { watch, log } = fakeStore();
    const leave = watch('u1');
    session.value = { status: 'signedOut' };
    leave();
    expect(log).toEqual(['start u1', 'stop u1']);
  });

  test('a failed watch starts afresh when a screen comes back', () => {
    const { watch, log, fail } = fakeStore();
    watch('u1')();
    fail();
    watch('u1');
    expect(log).toEqual(['start u1', 'stop u1', 'start u1']);
  });
});
