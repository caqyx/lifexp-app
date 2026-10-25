import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { deleteApp, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { ensureDefaultApp } from './admin';

describe('ensureDefaultApp', () => {
  it('creates the default app even when another (named) app already exists, as in a Firestore trigger', async () => {
    const named = initializeApp({ projectId: 'demo-test' }, '__FIREBASE_FUNCTIONS_SDK__');
    try {
      assert.ok(!getApps().some((a) => a.name === '[DEFAULT]'));
      ensureDefaultApp();
      assert.equal(getApp().name, '[DEFAULT]');
      ensureDefaultApp(); // idempotent
    } finally {
      await Promise.all(getApps().map((a) => deleteApp(a)));
      void named;
    }
  });
});
