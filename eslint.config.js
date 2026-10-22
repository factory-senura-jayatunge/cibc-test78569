// @ts-check
import js from '@eslint/js';
import globals from 'globals';

// Module boundaries (see AGENTS.md "Rules"). The import strings are relative, so the
// patterns match on the specifier as written in each file.
const PLATFORM_IMPORTS_LOB = {
  regex: String.raw`^\.\./lob/`,
  message: 'The shared platform must not import a line of business. Add a per-LOB hook instead (see OBR-2231).',
};
const LOB_IMPORTS_OTHER_LOB = {
  regex: String.raw`^\.\./(?!\.\./)[^/]+/`,
  message: 'A line of business must not import another line of business. Go through src/platform/ or an API.',
};

export default [
  {
    ignores: ['.baseline/**', 'out/**', 'coverage/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      // Complexity and size budgets. Split a function or module rather than raising these.
      complexity: ['error', { max: 15 }],
      'max-depth': ['error', 4],
      'max-params': ['error', 4],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true }],

      // Naming conventions (documented in CONTRIBUTING.md "Naming").
      camelcase: ['error', { properties: 'always', ignoreImports: false }],
      'new-cap': ['error', { newIsCap: true, capIsNew: false }],
      'id-denylist': ['error', 'data', 'obj', 'tmp', 'foo', 'bar'],

      // Correctness.
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-shadow': 'error',
      'no-param-reassign': ['error', { props: false }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'all', caughtErrorsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  {
    files: ['src/**/*.js'],
    rules: {
      // Runtime code logs through src/logger.js so output stays structured and scrubbed.
      'no-console': 'error',
    },
  },
  {
    // Known gap in SECURITY.md: AUDIT_STDOUT=1 mirrors audit entries to stdout.
    files: ['src/platform/audit.js'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['src/platform/**/*.js'],
    rules: { 'no-restricted-imports': ['error', { patterns: [PLATFORM_IMPORTS_LOB] }] },
  },
  {
    // Known debt OBR-2231: statements.js imports the Wood Gundy advisory fee. Only that import is allowed.
    files: ['src/platform/statements.js'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ ...PLATFORM_IMPORTS_LOB, regex: String.raw`^\.\./lob/(?!wood-gundy/advisory\.js$)` }] }],
    },
  },
  {
    files: ['src/lob/**/*.js'],
    rules: { 'no-restricted-imports': ['error', { patterns: [LOB_IMPORTS_OTHER_LOB] }] },
  },
  {
    // Known debt: Private Banking reads collateral value through Investor's Edge trading. Only that import is allowed.
    files: ['src/lob/private-banking/credit.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ ...LOB_IMPORTS_OTHER_LOB, regex: String.raw`^\.\./(?!\.\./|investors-edge/trading\.js$)[^/]+/` }] },
      ],
    },
  },
  {
    files: ['public/**/*.js'],
    languageOptions: { sourceType: 'module', globals: globals.browser },
  },
  {
    files: ['tests/**/*.js'],
    rules: {
      // node:test files group many cases in one top-level callback.
      'max-lines-per-function': 'off',
    },
  },
];
