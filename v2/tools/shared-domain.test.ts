import { describe, expect, it } from 'vitest';
import { REGEN_COMMAND, committedFiles, sharedFiles } from './shared-domain';

describe('the v2 domain copied for the Cloud Functions (functions/src/v2)', () => {
  it('is up to date: the same files, the same code', () => {
    // On failure: run `npm run gen:shared-domain --prefix v2` and commit functions/src/v2.
    const fresh = sharedFiles();
    const committed = committedFiles();
    expect([...committed.keys()], `functions/src/v2 is stale: run ${REGEN_COMMAND}`).toEqual([...fresh.keys()]);
    for (const [path, text] of fresh) expect(committed.get(path), `${path} is stale: run ${REGEN_COMMAND}`).toBe(text);
  });

  it('holds the weekly report and only what it needs, with relative imports', () => {
    const files = sharedFiles();
    expect(files.has('domain/parent.ts')).toBe(true);
    expect([...files.keys()].every((p) => p.startsWith('domain/') || p.startsWith('lib/'))).toBe(true);
    for (const text of files.values()) expect(text).not.toMatch(/from\s+['"]@\//);
  });
});
