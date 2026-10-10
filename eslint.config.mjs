import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const reactFiles = [
  'apps/web/**/*.{ts,tsx,js,jsx,mjs}',
  'apps/crm/**/*.{ts,tsx,js,jsx,mjs}',
  'packages/ui/**/*.{ts,tsx}',
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/next-env.d.ts',
      '.local/**',
      '**/.venv/**',
      '**/.pytest_cache/**',
      '**/.ruff_cache/**',
      '.lighthouse/**',
      'packages/db/src/database.types.ts',
      'apps/crm/netlify/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['info', 'warn', 'error'] }],
    },
  },
  {
    // CLI scripts and tests may print freely.
    files: ['**/scripts/**', '**/test/**', '**/e2e/**', '*.config.*'],
    rules: { 'no-console': 'off' },
  },
  ...nextVitals.map((config) => ({ ...config, files: reactFiles })),
  {
    files: reactFiles,
    settings: { next: { rootDir: ['apps/web', 'apps/crm'] }, react: { version: 'detect' } },
    languageOptions: { globals: { ...globals.browser } },
  },
);
