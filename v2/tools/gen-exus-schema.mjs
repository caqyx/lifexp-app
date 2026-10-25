// Writes functions/src/exus/schema.gen.json from the v2 registry (tools/exus-schema.ts)
// and functions/src/test/fixtures/exus-context.json (tools/exus-context-fixture.ts).
// Usage: npm run gen:exus-schema --prefix v2
// Loads the TypeScript through Vite's module runner (already a dev dependency),
// with the same `@/` alias as the app and none of its plugins.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const src = fileURLToPath(new URL('../src', import.meta.url));
const load = async (file) =>
  (
    await runnerImport(fileURLToPath(new URL(file, import.meta.url)), {
      configFile: false,
      logLevel: 'error',
      resolve: { alias: { '@': src } },
    })
  ).module;

const write = (path, text) => {
  const out = fileURLToPath(new URL(`../${path}`, import.meta.url));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text);
  console.log(`Wrote ${out}`);
};

const schema = await load('./exus-schema.ts');
write(schema.SCHEMA_PATH, schema.serializeExusSchema());
// The context v2 sends for a typical account: the backend's tests validate it.
const fixture = await load('./exus-context-fixture.ts');
write(fixture.CONTEXT_FIXTURE_PATH, fixture.serializeContextFixture());
