import { describe, expect, test } from 'vitest';
import { DEFAULT_TITLE, clickUrl, parsePushData, readPush } from './swPush';

const SCOPE = 'https://caqyx.github.io/lifexp-app/v2/';

describe('readPush', () => {
  test('the payload pushReminders sends (notification + webpush.fcmOptions.link)', () => {
    expect(
      readPush({
        notification: { title: '🔥 Seria: 2 dni', body: 'Dziś jeszcze nic nie ma.' },
        webpush: { fcmOptions: { link: 'https://caqyx.github.io/lifexp-app/app.html' } },
      }),
    ).toEqual({ title: '🔥 Seria: 2 dni', body: 'Dziś jeszcze nic nie ma.', link: 'https://caqyx.github.io/lifexp-app/app.html' });
  });

  test('as FCM delivers it to a worker (fcmOptions at the top) and as a data-only message', () => {
    expect(readPush({ notification: { title: 'A', body: 'B' }, fcmOptions: { link: '#/today' } }).link).toBe('#/today');
    expect(readPush({ data: { title: 'T', body: 'X', link: '#/chores' } })).toEqual({ title: 'T', body: 'X', link: '#/chores' });
    expect(readPush({ notification: { title: 'T', click_action: '#/x' } }).link).toBe('#/x');
  });

  test.each([[undefined], [null], ['text'], [[]], [{}], [{ notification: { title: '  ' } }]])('no usable title (%j): "LifeXP", empty body, no link', (raw) => {
    expect(readPush(raw)).toEqual({ title: DEFAULT_TITLE, body: '', link: null });
  });

  test('the notification wins over data', () => {
    expect(readPush({ notification: { title: 'N' }, data: { title: 'D', body: 'from data' } })).toEqual({ title: 'N', body: 'from data', link: null });
  });
});

describe('parsePushData', () => {
  test('JSON, plain text, nothing', () => {
    expect(parsePushData(() => ({ a: 1 }), () => '')).toEqual({ a: 1 });
    const bad = () => {
      throw new SyntaxError('not json');
    };
    expect(parsePushData(bad, () => 'Hej')).toEqual({ notification: { body: 'Hej' } });
    expect(parsePushData(bad, () => '')).toEqual({});
  });
});

describe('clickUrl', () => {
  test('no link: v2 start', () => {
    expect(clickUrl(null, SCOPE)).toBe(SCOPE);
  });

  test('a relative link resolves against the scope', () => {
    expect(clickUrl('#/today', SCOPE)).toBe(`${SCOPE}#/today`);
    expect(clickUrl('../app.html', SCOPE)).toBe('https://caqyx.github.io/lifexp-app/app.html');
  });

  test('an absolute link on our origin is kept, also outside the scope (v1 until the cutover)', () => {
    const v1 = 'https://caqyx.github.io/lifexp-app/app.html';
    expect(clickUrl(v1, SCOPE)).toBe(v1);
  });

  test.each(['https://evil.example/phish', 'http://caqyx.github.io/lifexp-app/', 'javascript:alert(1)', 'data:text/html,hi', '//evil.example/x'])(
    'a foreign origin or scheme (%s) falls back to the start',
    (link) => {
      expect(clickUrl(link, SCOPE)).toBe(SCOPE);
    },
  );
});
