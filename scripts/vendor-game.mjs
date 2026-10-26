#!/usr/bin/env node
/**
 * Kopiuje grę właściciela do v2 (PLAN.md 9.1, etap gier, decyzja 2026-10-26 pkt 3).
 * Gry są kopiami („vendored”): gdy właściciel powie, że jest nowa wersja, uruchamia się
 * ten skrypt jeszcze raz i commituje wynik.
 *
 *   node scripts/vendor-game.mjs <id> <katalog-źródła> [--out <katalog>] [--allow-dirty]
 *
 * Co robi, po kolei:
 *  1. Sprawdza źródło: repozytorium git bez niezapisanych zmian (inaczej VENDORED.json
 *     nie powie prawdy o tym, co skopiowano), z commitem, który trafi do VENDORED.json.
 *  2. Kopiuje tylko pliki gry z listy `include` (bez .git, README, testów, narzędzi)
 *     do v2/public/games/<id>/ — Vite publikuje public/ pod /v2/games/<id>/, a
 *     scripts/build-site.js składa to na stronę. Stara kopia jest najpierw kasowana.
 *  3. Nakłada łatki z listy gry. Każda łatka musi trafić dokładnie raz, więc zmiana
 *     w grze, po której łatka przestaje pasować, zatrzymuje kopiowanie zamiast po cichu
 *     przepuścić np. skrypt reklam.
 *  4. Wpisuje do każdej strony HTML gry Content-Security-Policy, która pozwala tylko na
 *     ten origin: gra nie pobierze ani nie wyśle niczego gdzie indziej (grają dzieci).
 *  5. Odmawia, gdy w skopiowanych plikach zostaje adres zewnętrznego hosta (poza
 *     przestrzeniami nazw XML, np. SVG) albo coś, co sięga poza grę na wspólnym
 *     originie (FORBIDDEN: czyszczenie całego localStorage, kasowanie baz i cache,
 *     własny Service Worker). Gra działa na tym samym originie co LifeXP, więc np.
 *     localStorage.clear() skasowałoby motyw, szkice offline i kopie sesji grania.
 *  6. Zapisuje VENDORED.json: źródło, commit, data, łatki, liczba plików.
 *
 * Bez zależności; Node 18+.
 *
 * Aktualizacja gry (właściciel mówi „jest nowa wersja X”): pobrać najnowszy commit
 * repozytorium gry i uruchomić jedno polecenie, potem `npm run test:v2` i commit:
 *
 *   git -C <klon-Wartime> pull && node scripts/vendor-game.mjs wartime <klon-Wartime>
 *   git -C <klon-gridlock> pull && node scripts/vendor-game.mjs gridlock <klon-gridlock>
 *
 * Gdy łatka przestanie pasować albo pojawi się zewnętrzny host, skrypt się zatrzyma
 * i powie, co poprawić na liście gry niżej.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Polityka strony gry: wszystko z tego originu, nic z zewnątrz. Style inline zostają (gry ich używają). */
export const BASE_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

/** Rzeczy, które sięgają poza grę na wspólnym originie; każda wymaga łatki. */
export const FORBIDDEN = [
  { pattern: /\b(?:localStorage|sessionStorage)\.clear\s*\(/, why: 'czyści cały magazyn originu, także dane LifeXP' },
  { pattern: /\bindexedDB\.deleteDatabase\s*\(/, why: 'kasuje bazę IndexedDB (Firestore i logowanie LifeXP są w IndexedDB)' },
  { pattern: /\bcaches\.(?:delete|keys)\s*\(/, why: 'sięga do cache Service Workerów LifeXP' },
  { pattern: /\bserviceWorker\.register\s*\(/, why: 'własny Service Worker gry pod zakresem v2' },
  { pattern: /\bdocument\.cookie\b/, why: 'ciasteczka są wspólne dla originu' },
];

/** Adresy, które nie są żądaniami: przestrzenie nazw XML (SVG, XHTML, XLink). */
const ALLOWED_URL = /^https?:\/\/www\.w3\.org\//;

/**
 * Gry do skopiowania. `patches`: { file, why, find, replace } zastępuje dokładnie jedno
 * trafienie `find`; { file, why, expect } tylko sprawdza, że tekst jest (np. że reklamy
 * są wyłączone w stałej gry).
 */
export const GAMES = {
  wartime: {
    source: 'https://github.com/szymonrogalski098-collab/Wartime',
    include: ['index.html', 'css', 'data', 'js'],
    patches: [],
  },
  gridlock: {
    source: 'https://github.com/szymonrogalski098-collab/gridlock',
    include: ['index.html', 'cube_master.css', 'js'],
    patches: [
      {
        file: 'index.html',
        why: 'Bez CrazyGames SDK: zewnętrzny skrypt platformy z reklamami. Bez niego js/sdk.js działa „standalone”, a reklamy i nagrody za reklamy się nie pokazują.',
        find: /<!-- \[2\.0-sdk\] CrazyGames SDK\.[\s\S]*?-->\s*<script src="https:\/\/sdk\.crazygames\.com\/crazygames-sdk-v3\.js"><\/script>\n?/,
        replace: '',
      },
      {
        file: 'js/main.js',
        why: '„Reset” gry kasuje tylko jej klucze (cm_*), nie cały localStorage wspólny z LifeXP.',
        find: /localStorage\.clear\(\);/,
        replace:
          "Object.keys(localStorage).filter((k) => k.startsWith('cm_')).forEach((k) => localStorage.removeItem(k));",
      },
      {
        file: 'js/constants.js',
        why: 'Reklamy i nagrody za reklamy wyłączone w samej grze (ADS_ENABLED = false).',
        expect: /\bconst ADS_ENABLED = false;/,
      },
    ],
  },
};

function fail(message) {
  console.error(`vendor-game: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { positional: [], out: null, allowDirty: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--allow-dirty') args.allowDirty = true;
    else args.positional.push(argv[i]);
  }
  return args;
}

function git(dir, ...args) {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.')) return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

const TEXT = new Set(['.html', '.htm', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.xml', '.webmanifest']);

/** Wstawia CSP zaraz po <meta charset>, albo na początku <head>. */
export function withCsp(html, csp = BASE_CSP) {
  if (/http-equiv=["']Content-Security-Policy["']/i.test(html)) {
    throw new Error('strona ma już własną Content-Security-Policy; połącz ją ręcznie z BASE_CSP');
  }
  // Bez <link rel="icon"> przeglądarka pyta o /favicon.ico, którego strona nie ma (404 w konsoli).
  const icon = /<link[^>]+rel=["'](?:shortcut )?icon["']/i.test(html) ? '' : '\n<link rel="icon" href="data:,">';
  const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}">${icon}`;
  const charset = html.match(/<meta charset=[^>]*>/i);
  if (charset) return html.replace(charset[0], `${charset[0]}\n${meta}`);
  const head = html.match(/<head[^>]*>/i);
  if (!head) throw new Error('brak <head>, nie ma gdzie wpisać CSP');
  return html.replace(head[0], `${head[0]}\n${meta}`);
}

/** Adresy hostów spoza originu w tekście pliku. */
export function externalUrls(text) {
  return [...text.matchAll(/\b(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"'`)<>]*/gi)]
    .map((m) => m[0])
    .filter((url) => /^https?:/i.test(url) || /^\/\/[a-z0-9-]+\.[a-z]/i.test(url))
    .filter((url) => !ALLOWED_URL.test(url));
}

function applyPatches(outDir, patches) {
  for (const patch of patches) {
    const file = path.join(outDir, patch.file);
    if (!fs.existsSync(file)) fail(`łatka „${patch.why}”: brak pliku ${patch.file}`);
    const text = fs.readFileSync(file, 'utf8');
    const global = new RegExp(patch.find?.source ?? patch.expect.source, 'g');
    const hits = [...text.matchAll(global)].length;
    if (hits !== 1) fail(`łatka „${patch.why}”: ${hits} trafień w ${patch.file} zamiast 1 — gra się zmieniła, popraw łatkę`);
    if (patch.find) fs.writeFileSync(file, text.replace(patch.find, patch.replace));
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const [id, sourceArg] = args.positional;
  const game = GAMES[id];
  if (!id || !sourceArg) fail(`użycie: node scripts/vendor-game.mjs <${Object.keys(GAMES).join('|')}> <katalog-źródła>`);
  if (!game) fail(`nieznana gra „${id}”; znane: ${Object.keys(GAMES).join(', ')}`);
  const source = path.resolve(sourceArg);
  if (!fs.existsSync(path.join(source, 'index.html'))) fail(`${source} nie ma index.html`);

  let commit;
  try {
    commit = git(source, 'rev-parse', 'HEAD');
  } catch {
    fail(`${source} nie jest repozytorium git`);
  }
  if (git(source, 'status', '--porcelain') && !args.allowDirty) {
    fail(`${source} ma niezapisane zmiany; VENDORED.json musi wskazywać commit, który skopiowano (--allow-dirty tylko do prób)`);
  }

  const outDir = path.resolve(args.out ?? path.join(ROOT, 'v2', 'public', 'games', id));
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  for (const entry of game.include) {
    const from = path.join(source, entry);
    if (!fs.existsSync(from)) fail(`w źródle nie ma „${entry}” z listy include`);
    fs.cpSync(from, path.join(outDir, entry), { recursive: true, filter: (p) => !path.basename(p).startsWith('.') });
  }

  applyPatches(outDir, game.patches);

  const files = listFiles(outDir);
  const external = [];
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!TEXT.has(ext)) continue;
    let text = fs.readFileSync(file, 'utf8');
    if (ext === '.html' || ext === '.htm') {
      text = withCsp(text, game.csp ?? BASE_CSP);
      fs.writeFileSync(file, text);
    }
    for (const url of externalUrls(text)) external.push(`${path.relative(outDir, file)}: ${url}`);
    for (const { pattern, why } of FORBIDDEN) {
      if (pattern.test(text)) external.push(`${path.relative(outDir, file)}: ${pattern.source} — ${why}`);
    }
  }
  if (external.length) {
    fs.rmSync(outDir, { recursive: true, force: true });
    fail(`gra odwołuje się do zewnętrznych hostów albo sięga poza siebie (dodaj łatkę):\n  ${[...new Set(external)].join('\n  ')}`);
  }

  const vendored = {
    game: id,
    source: game.source,
    commit,
    vendoredAt: new Date().toISOString(),
    dirty: Boolean(args.allowDirty && git(source, 'status', '--porcelain')),
    include: game.include,
    patches: game.patches.map((p) => `${p.file}: ${p.why}`),
    csp: game.csp ?? BASE_CSP,
    files: files.length,
  };
  fs.writeFileSync(path.join(outDir, 'VENDORED.json'), JSON.stringify(vendored, null, 2) + '\n');
  const bytes = files.reduce((sum, f) => sum + fs.statSync(f).size, 0);
  console.log(`${id}: ${files.length} plików (${(bytes / 1024 / 1024).toFixed(1)} MB) z ${commit.slice(0, 7)} → ${path.relative(ROOT, outDir) || outDir}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
