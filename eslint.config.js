// @ts-check
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js', '*.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // Non-null assertions are allowed only with an eslint-disable comment explaining why.
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // TypeScript standard: what a module exports says what it returns.
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      // Coding standard: camelCase values, PascalCase types and components, UPPER_SNAKE_CASE
      // constants. Object keys are left alone (JSON, CSS variables, HTTP headers).
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'] },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        { selector: 'parameter', format: ['camelCase', 'PascalCase'], leadingUnderscore: 'allow' },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['PascalCase', 'UPPER_CASE'] },
        { selector: 'import', format: null },
        {
          selector: ['objectLiteralProperty', 'objectLiteralMethod', 'typeProperty', 'typeMethod'],
          format: null,
        },
        { selector: ['classProperty', 'classMethod', 'accessor'], format: ['camelCase', 'UPPER_CASE'] },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: globals.browser },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['apps/server/**/*.ts', 'apps/desktop/**/*.{ts,cts}', 'scripts/**/*.{js,ts}', '*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
