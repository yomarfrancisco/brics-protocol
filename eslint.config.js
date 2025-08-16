const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        require: 'readonly',
        module: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        before: 'readonly',
        after: 'readonly',
        expect: 'readonly',
        assert: 'readonly',
        hre: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    ignores: [
      'node_modules/**',
      'artifacts/**',
      'cache/**',
      'typechain/**',
      'coverage/**',
      'dist/**',
      'build/**',
      'services/**',
      'frontend/**',
      '.next/**',
      '*.js',
      'package-issue61-*.js',
    ],
  },
];
