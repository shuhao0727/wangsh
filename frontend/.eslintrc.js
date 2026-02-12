module.exports = {
  root: true,
  extends: [
    'react-app',
    'react-app/jest'
  ],
  rules: {
    // 可以在这里添加自定义规则
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parserOptions: {
        project: './tsconfig.json',
      },
    },
  ],
};