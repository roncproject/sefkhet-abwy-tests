/**
 * ESLint: the core rules, Playwright's rules and SonarQube's JavaScript rules
 * (eslint-plugin-sonarjs), run locally and in CI. `npm run lint`.
 * See issue #79 in the app's repository.
 */
import js from '@eslint/js';
import globals from 'globals';
import playwright from 'eslint-plugin-playwright';
import sonarjs from 'eslint-plugin-sonarjs';

export default [
  { ignores: ['test-results/', 'playwright-report/'] },
  js.configs.recommended,
  sonarjs.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      // Node for the tests themselves; browser for the code they run in the
      // page through page.evaluate() and addInitScript().
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  { files: ['tests/**'], ...playwright.configs['flat/recommended'] },
];
