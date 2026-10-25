// Copies the v2 domain the Cloud Functions use into functions/src/v2 (tools/shared-domain.ts).
// Usage: npm run gen:shared-domain --prefix v2
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const { module: shared } = await runnerImport(fileURLToPath(new URL('./shared-domain.ts', import.meta.url)), {
  configFile: false,
  logLevel: 'error',
});
const root = shared.sharedDirPath();
rmSync(root, { recursive: true, force: true });
for (const [path, text] of shared.sharedFiles()) {
  const out = join(root, path);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text);
}
console.log(`Wrote ${shared.sharedFiles().size} files to ${root}`);
