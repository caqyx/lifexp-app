// Architecture rules from docs/v2/PLAN.md 4.2 and 7.7, enforced instead of
// "by convention". tests/lint-architecture.test.ts checks that each rule fires.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Layers a layer must NOT import (PLAN.md 4.2). Everything else is allowed.
const FORBIDDEN_IMPORTS = {
  lib: ['app', 'features', 'services', 'stores', 'offline', 'data', 'domain', 'ui', 'i18n'],
  domain: ['app', 'features', 'services', 'stores', 'offline', 'data', 'ui', 'i18n'],
  i18n: ['app', 'features', 'services', 'stores', 'offline', 'data', 'domain', 'ui'],
  ui: ['app', 'features', 'services', 'stores', 'offline', 'data', 'domain'],
  data: ['app', 'features', 'services', 'stores', 'offline', 'ui'],
  stores: ['app', 'features', 'ui'],
  services: ['app', 'features', 'ui'],
  offline: ['app', 'features', 'ui'],
  features: ['app', 'data'],
};

const layerRules = Object.entries(FORBIDDEN_IMPORTS).map(([layer, forbidden]) => ({
  files: [`src/${layer}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        // "@/data/x", "../data/x", "../../data/x"
        regex: `^(?:@/|(?:\\.\\./)+)(?:${forbidden.join('|')})(?:/|$)`,
        message: `Warstwa "${layer}" nie może importować: ${forbidden.join(', ')} (PLAN.md 4.2).`,
      }],
    }],
  },
}));

const HTML_INJECTION = 'HTML wstawia wyłącznie komponent Markdown (sanityzowany).';

export default tseslint.config(
  // Vendored games are copies of other repositories (scripts/vendor-game.mjs), not v2 code.
  // LifeXP's own games (Flappy Bird, Szybkie liczenie: GAME.json) are linted like v2 code.
  { ignores: ['dist/**', 'node_modules/**', 'public/games/*', '!public/games/flappy/', '!public/games/quick-math/', '!public/games/wave-rush/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-syntax': ['error',
        { selector: "JSXAttribute[name.name='style'] > Literal", message: 'Style w CSS, nie inline (PLAN.md 7.7).' },
        {
          selector: "JSXAttribute[name.name='style'] > JSXExpressionContainer > :not(ObjectExpression)",
          message: 'Inline style tylko jako literał obiektu ze zmiennymi CSS (PLAN.md 7.7).',
        },
        {
          selector: "JSXAttribute[name.name='style'] Property:not([key.value=/^--/])",
          message: 'Inline style dopuszcza tylko zmienne CSS, np. { "--progress": x } (PLAN.md 7.7).',
        },
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: HTML_INJECTION },
        { selector: 'AssignmentExpression > MemberExpression.left[property.name=/^(inner|outer)HTML$/]', message: HTML_INJECTION },
        { selector: "CallExpression[callee.property.name='insertAdjacentHTML']", message: HTML_INJECTION },
        {
          selector: "AssignmentExpression > MemberExpression.left[object.name='window']",
          message: 'Bez globali na window — importuj moduł.',
        },
      ],
    },
  },
  ...layerRules,
  {
    // LifeXP's own games run in GameHost's frame as plain ES modules (no build step),
    // with their own CSP: no eval, no HTML strings, nothing global.
    files: ['public/games/flappy/**/*.js', 'public/games/quick-math/**/*.js', 'public/games/wave-rush/**/*.js', 'public/games/ship-rush/**/*.js', 'public/games/flip-rush/**/*.js', 'public/games/_engine/**/*.js'],
    languageOptions: { globals: globals.browser, sourceType: 'module' },
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-syntax': ['error',
        { selector: 'AssignmentExpression > MemberExpression.left[property.name=/^(inner|outer)HTML$/]', message: 'Tekst przez textContent.' },
        { selector: "CallExpression[callee.property.name='insertAdjacentHTML']", message: 'Tekst przez textContent.' },
        { selector: "AssignmentExpression > MemberExpression.left[object.name='window']", message: 'Bez globali na window.' },
        { selector: "CallExpression[callee.property.name='clear'][callee.object.name=/^(localStorage|sessionStorage)$/]", message: 'Gra kasuje tylko swoje klucze (lifexp-flappy-*, lifexp-quickmath-*, lifexp-waverush-*, lifexp-shiprush-*, lifexp-fliprush-*).' },
      ],
    },
  },
  {
    files: ['*.{js,ts}', 'tests/**/*.ts', 'tools/**/*.{ts,mjs}'],
    languageOptions: { globals: globals.node },
  },
);
