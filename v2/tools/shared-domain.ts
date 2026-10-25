// The v2 domain the Cloud Functions run (docs/v2/PLAN.md 9.1, rows 6-5/6-6): the
// weekly report is built by the same `weeklyReport` the v2 tests check, not a copy
// of its logic. The files reachable from ROOTS are copied verbatim into
// functions/src/v2/ (the functions deploy only their own folder), with the `@/`
// imports made relative and a "generated" header; a v2 test fails while the copy
// is stale, and the functions' strict tsc type-checks it.
//
// Regenerate:   npm run gen:shared-domain --prefix v2
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SHARED_DIR = '../functions/src/v2';
export const REGEN_COMMAND = 'npm run gen:shared-domain --prefix v2';
/** What the functions import; everything they import is copied too. */
export const ROOTS = ['domain/parent.ts', 'lib/money.ts'] as const;

const SRC = fileURLToPath(new URL('../src', import.meta.url));
const IMPORT = /((?:import|export)\b[^'"]*?\bfrom\s+)(['"])([^'"]+)\2/g;

const header = (path: string) =>
  `// GENERATED from v2/src/${path} by \`${REGEN_COMMAND}\`. Do not edit here:\n// change v2/src/${path} and regenerate (a v2 test fails while this copy is stale).\n`;

function resolve(from: string, spec: string): string {
  const base = spec.startsWith('@/') ? spec.slice(2) : posix.normalize(posix.join(posix.dirname(from), spec));
  const file = `${base}.ts`;
  if (!existsSync(join(SRC, file))) throw new Error(`${from}: cannot share ${spec} (only .ts files of v2/src without packages)`);
  return file;
}

/** Relative path (in functions/src/v2) → file content. */
export function sharedFiles(): Map<string, string> {
  const out = new Map<string, string>();
  const queue: string[] = [...ROOTS];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (out.has(file)) continue;
    const source = readFileSync(join(SRC, file), 'utf8');
    const rewritten = source.replace(IMPORT, (_all, head: string, quote: string, spec: string) => {
      if (!spec.startsWith('@/') && !spec.startsWith('.')) throw new Error(`${file}: imports the package ${spec}`);
      const target = resolve(file, spec);
      queue.push(target);
      let rel = posix.relative(posix.dirname(file), target.replace(/\.ts$/, ''));
      if (!rel.startsWith('.')) rel = `./${rel}`;
      return `${head}${quote}${rel}${quote}`;
    });
    out.set(file, header(file) + rewritten);
  }
  return new Map([...out].sort(([a], [b]) => a.localeCompare(b)));
}

/** What is in functions/src/v2 now (relative paths, sorted). */
export function committedFiles(): Map<string, string> {
  const root = fileURLToPath(new URL(`../${SHARED_DIR}`, import.meta.url));
  const out = new Map<string, string>();
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else out.set(relative(root, path).split('\\').join('/'), readFileSync(path, 'utf8'));
    }
  };
  walk(root);
  return new Map([...out].sort(([a], [b]) => a.localeCompare(b)));
}

export const sharedDirPath = () => fileURLToPath(new URL(`../${SHARED_DIR}`, import.meta.url));
