module.exports = {
  env: {
    es6: true,
    node: true,
    mocha: true
  },
  extends: [
    'standard',
    'plugin:chai-friendly/recommended'
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly'
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2018
  },
  plugins: [
    '@typescript-eslint',
    'mocha',
    'chai-friendly'
  ],
  rules: {
    'no-process-env': 'error',
    'no-console': 'error',
    'no-unused-vars': 'off',
    'no-unused-expression': 'off',
    'no-inner-declarations': 'off',
    'no-useless-constructor': 'off',
    'mocha/no-exclusive-tests': 'error',
    'import/export': 'off',
    'no-redeclare': 'off',
  }
}
