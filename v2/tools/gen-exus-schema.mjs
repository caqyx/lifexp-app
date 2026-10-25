// Writes functions/src/exus/schema.gen.json from the v2 registry (tools/exus-schema.ts).
// Usage: npm run gen:exus-schema --prefix v2
// Loads the TypeScript through Vite's module runner (already a dev dependency),
// with the same `@/` alias as the app and none of its plugins.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const src = fileURLToPath(new URL('../src', import.meta.url));
const { module } = await runnerImport(fileURLToPath(new URL('./exus-schema.ts', import.meta.url)), {
  configFile: false,
  logLevel: 'error',
  resolve: { alias: { '@': src } },
});
const out = fileURLToPath(new URL(`../${module.SCHEMA_PATH}`, import.meta.url));
writeFileSync(out, module.serializeExusSchema());
console.log(`Wrote ${out}`);
