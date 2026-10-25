export default [
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        document: 'readonly', window: 'readonly', localStorage: 'readonly', FormData: 'readonly', Blob: 'readonly',
        URL: 'readonly', Intl: 'readonly', fetch: 'readonly', AbortController: 'readonly', AbortSignal: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly', console: 'readonly', process: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'error',
      'no-undef': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-param-reassign': 'error',
      'no-shadow': 'error',
      curly: ['error', 'multi-line'],
    },
  },
];
