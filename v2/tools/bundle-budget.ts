// Start-up bundle budget (docs/v2/PERF.md). `npm run build` fails when the code every
// start downloads and parses before the first screen grows past the budget, or when
// something that should load later lands in it (Firebase, the English dictionary,
// Markdown, the reader's libraries). Raise a budget only on purpose, with a line in PERF.md.
import type { Plugin } from 'vite';

/** The entry chunk and the chunks it imports statically (index.html modulepreloads them). */
export const INITIAL_JS_BUDGET = 240 * 1024;
/** The stylesheet of the entry (tokens, base, shell): render-blocking. */
export const INITIAL_CSS_BUDGET = 56 * 1024;

/** Modules that must stay out of the start: each is loaded when something needs it. */
export const LATER_MODULES: readonly { pattern: RegExp; why: string }[] = [
  { pattern: /node_modules\/(?:firebase|@firebase)\//, why: 'Firebase loads lazily (data/firebase.ts), after the first paint' },
  { pattern: /\/src\/i18n\/en\.json$/, why: 'English is its own chunk (i18n/index.ts loadLanguage)' },
  { pattern: /node_modules\/(?:marked|dompurify)\//, why: 'Markdown loads with the first note (dynamic import)' },
  { pattern: /node_modules\/(?:pdfjs-dist|jszip)\//, why: "the opt-in reader's libraries load with the reader" },
  { pattern: /\/src\/ui\/glass\/(?:lens\.tsx|map\.ts)$/, why: 'the liquid glass lens loads only in refract mode (ui/glass/registry.ts)' },
];

export interface BuiltChunk {
  fileName: string;
  isEntry: boolean;
  /** Bytes of the chunk's code. */
  size: number;
  /** Chunks it imports statically. */
  imports: readonly string[];
  moduleIds: readonly string[];
  /** CSS files that load with it. */
  css: readonly string[];
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

/** What is wrong with the build's start; empty = within budget. */
export function budgetProblems(chunks: readonly BuiltChunk[], cssSize: (fileName: string) => number): string[] {
  const byName = new Map(chunks.map((c) => [c.fileName, c]));
  const entries = chunks.filter((c) => c.isEntry);
  if (entries.length !== 1) return [`expected one entry chunk, found ${entries.length}`];
  const initial = new Set<BuiltChunk>();
  const visit = (chunk: BuiltChunk) => {
    if (initial.has(chunk)) return;
    initial.add(chunk);
    for (const name of chunk.imports) {
      const next = byName.get(name);
      if (next) visit(next);
    }
  };
  visit(entries[0]!);

  const problems: string[] = [];
  const js = [...initial].reduce((sum, c) => sum + c.size, 0);
  if (js > INITIAL_JS_BUDGET) {
    const list = [...initial].map((c) => `${c.fileName} ${kb(c.size)}`).join(', ');
    problems.push(`start-up JS ${kb(js)} is over the budget of ${kb(INITIAL_JS_BUDGET)} (${list})`);
  }
  const cssFiles = new Set([...initial].flatMap((c) => c.css));
  const css = [...cssFiles].reduce((sum, f) => sum + cssSize(f), 0);
  if (css > INITIAL_CSS_BUDGET) problems.push(`start-up CSS ${kb(css)} is over the budget of ${kb(INITIAL_CSS_BUDGET)}`);
  for (const chunk of initial) {
    for (const id of chunk.moduleIds) {
      const rule = LATER_MODULES.find((r) => r.pattern.test(id.replaceAll('\\', '/')));
      if (rule) problems.push(`${id} is in the start-up chunk ${chunk.fileName}, but ${rule.why}`);
    }
  }
  return problems;
}

/** Vite plugin: checks the client build (not the Service Worker's) against the budget. */
export function bundleBudget(): Plugin {
  return {
    name: 'lifexp-bundle-budget',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.values(bundle);
      const chunks: BuiltChunk[] = [];
      for (const file of files) {
        if (file.type !== 'chunk') continue;
        chunks.push({
          fileName: file.fileName,
          isEntry: file.isEntry,
          size: Buffer.byteLength(file.code),
          imports: file.imports,
          moduleIds: file.moduleIds,
          css: [...(file.viteMetadata?.importedCss ?? [])],
        });
      }
      // The Service Worker is built on its own (vite-plugin-pwa), as a single iife chunk.
      if (!chunks.some((c) => c.isEntry && /^assets\//.test(c.fileName))) return;
      const cssSize = (name: string) => {
        const asset = bundle[name];
        if (!asset || asset.type !== 'asset') return 0;
        return typeof asset.source === 'string' ? Buffer.byteLength(asset.source) : asset.source.byteLength;
      };
      const problems = budgetProblems(chunks, cssSize);
      if (problems.length > 0) this.error(`Bundle budget (docs/v2/PERF.md):\n- ${problems.join('\n- ')}`);
    },
  };
}
