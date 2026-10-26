// scripts/vendor-game.mjs (PLAN.md 9.1, etap gier): kopia gry z repozytorium git
// z łatkami, CSP i VENDORED.json; odmowa, gdy łatka nie pasuje albo zostaje zewnętrzny host.
// Bez przeglądarki: źródła to tymczasowe repozytoria git.
const { test, expect } = require('@playwright/test');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'vendor-game.mjs');

/** A git repo shaped like Gridlock, with `files` overriding its pages. */
function fakeRepo(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vendor-src-'));
  const all = {
    'index.html':
      '<!DOCTYPE html>\n<html><head>\n<meta charset="UTF-8">\n<!-- [2.0-sdk] CrazyGames SDK. Loaded first. -->\n' +
      '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>\n<script src="js/main.js"></script>\n</head><body>' +
      '<svg xmlns="http://www.w3.org/2000/svg"></svg></body></html>\n',
    'cube_master.css': 'body { margin: 0; }\n',
    'js/constants.js': 'const ADS_ENABLED = false;\n',
    'js/main.js': 'console.log("game");\nfunction reset() { localStorage.clear(); location.reload(); }\n',
    'README.md': 'not copied\n',
    ...files,
  };
  for (const [name, text] of Object.entries(all)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), text);
  }
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { stdio: 'pipe' });
  git('init', '-q');
  git('add', '.');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-qm', 'init');
  return { dir, commit: git('rev-parse', 'HEAD').toString().trim() };
}

function vendor(source, out) {
  return spawnSync(process.execPath, [SCRIPT, 'gridlock', source, '--out', out], { encoding: 'utf8' });
}

const outDir = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vendor-out-')), 'gridlock');

test('copies the game, drops the CrazyGames SDK, adds the CSP and VENDORED.json', () => {
  const { dir, commit } = fakeRepo();
  const out = outDir();
  const run = vendor(dir, out);
  expect(run.status, run.stderr).toBe(0);

  expect(fs.existsSync(path.join(out, 'README.md'))).toBe(false);
  expect(fs.existsSync(path.join(out, '.git'))).toBe(false);
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  expect(html).not.toContain('crazygames');
  expect(html).toContain('<script src="js/main.js"></script>');
  expect(html).toMatch(/<meta charset="UTF-8">\n<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self';/);
  expect(html).toContain("connect-src 'self'");
  // No favicon request (404) from the game page.
  expect(html).toContain('<link rel="icon" href="data:,">');
  // Its reset clears only the game's own keys, not LifeXP's.
  const main = fs.readFileSync(path.join(out, 'js', 'main.js'), 'utf8');
  expect(main).not.toContain('localStorage.clear');
  expect(main).toContain("k.startsWith('cm_')");

  const vendored = JSON.parse(fs.readFileSync(path.join(out, 'VENDORED.json'), 'utf8'));
  expect(vendored).toMatchObject({
    game: 'gridlock',
    source: 'https://github.com/szymonrogalski098-collab/gridlock',
    commit,
    dirty: false,
    files: 4,
  });
  expect(vendored.patches).toHaveLength(3);
  expect(Date.parse(vendored.vendoredAt)).not.toBeNaN();
});

test('a patch that no longer matches stops the copy', () => {
  const { dir } = fakeRepo({ 'js/constants.js': 'const ADS_ENABLED = true;\n' });
  const run = vendor(dir, outDir());
  expect(run.status).toBe(1);
  expect(run.stderr).toContain('0 trafień w js/constants.js');
});

test('an external host left in the game stops the copy and leaves nothing behind', () => {
  const { dir } = fakeRepo({ 'js/extra.js': 'fetch("https://tracker.example.com/hit");\n' });
  const out = outDir();
  const run = vendor(dir, out);
  expect(run.status).toBe(1);
  expect(run.stderr).toContain('js/extra.js: https://tracker.example.com/hit');
  expect(fs.existsSync(out)).toBe(false);
});

test('a game that reaches beyond itself on the shared origin is refused', () => {
  const { dir } = fakeRepo({ 'js/extra.js': 'indexedDB.deleteDatabase("x");\n' });
  const run = vendor(dir, outDir());
  expect(run.status).toBe(1);
  expect(run.stderr).toContain('js/extra.js');
  expect(run.stderr).toContain('IndexedDB');
});

test('uncommitted changes in the source are refused', () => {
  const { dir } = fakeRepo();
  fs.writeFileSync(path.join(dir, 'js', 'main.js'), 'changed\n');
  const run = vendor(dir, outDir());
  expect(run.status).toBe(1);
  expect(run.stderr).toContain('niezapisane zmiany');
});

// LifeXP's own games (Flappy Bird g-3, Szybkie liczenie g-4) are written in this repo
// rather than copied, so the script never sees them: the same rules are checked here.
const OWN_GAMES = [
  { id: 'flappy', prefix: 'lifexp-flappy-', storageArgs: ['BEST_KEY'] },
  // (the argument is read up to its first parenthesis: recordKey(level) → "recordKey(level")
  { id: 'quick-math', prefix: 'lifexp-quickmath-', storageArgs: ['MODE_KEY', 'recordKey(level'] },
];

for (const game of OWN_GAMES) {
  test(`LifeXP's own game ${game.id}: a CSP no looser than the vendored games', no external host, nothing beyond itself`, async () => {
    const { BASE_CSP, FORBIDDEN, externalUrls } = await import(SCRIPT);
    const dir = path.join(__dirname, '..', 'v2', 'public', 'games', game.id);
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'GAME.json'), 'utf8')).source).toBe('lifexp');
    expect(fs.existsSync(path.join(dir, 'VENDORED.json'))).toBe(false);

    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
    // The base policy, with styles tightened to files only (no inline styles).
    expect(csp).toBe(BASE_CSP.replace("style-src 'self' 'unsafe-inline'", "style-src 'self'"));
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/); // no inline scripts
    expect(html).not.toMatch(/\sstyle=/); // no inline styles (the CSP would block them)
    expect(html).toContain('<link rel="icon" href="data:,">');

    const files = fs.readdirSync(dir, { recursive: true }).map((f) => path.join(dir, f)).filter((f) => fs.statSync(f).isFile());
    const problems = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      for (const url of externalUrls(text)) problems.push(`${path.basename(file)}: ${url}`);
      for (const { pattern, why } of FORBIDDEN) if (pattern.test(text)) problems.push(`${path.basename(file)}: ${why}`);
      if (/\beval\s*\(|new Function\s*\(/.test(text)) problems.push(`${path.basename(file)}: eval`);
      // Every storage key it names is its own.
      for (const [, key] of text.matchAll(/['"`](lifexp-[a-z-]*)/g)) {
        if (!key.startsWith(game.prefix)) problems.push(`${path.basename(file)}: key ${key}`);
      }
    }
    expect(problems).toEqual([]);
    // Storage is reached only through those keys.
    const args = files.flatMap((f) =>
      [...fs.readFileSync(f, 'utf8').matchAll(/(?:localStorage|storage\??)\.(?:getItem|setItem|removeItem)\(([^,)]+)/g)].map((m) => m[1].trim()),
    );
    expect([...new Set(args)].sort()).toEqual([...game.storageArgs].sort());
  });
}
