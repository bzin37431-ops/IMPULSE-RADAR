import tseslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';

export default [{ ignores: ['dist/**', 'node_modules/**'] }, { files: ['src/**/*.ts', 'tests/**/*.ts', 'prisma/**/*.ts', 'web/**/*.ts', 'web/**/*.tsx'], languageOptions: { parser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } } }, plugins: { '@typescript-eslint': tseslint }, rules: { 'no-console': 'warn', '@typescript-eslint/no-explicit-any': 'off' } }];
