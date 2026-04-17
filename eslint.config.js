import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const publicApiImportPatterns = [
  {
    group: ['@/pages/*/*', '@/widgets/*/*', '@/features/*/*', '@/entities/*/*'],
    message:
      'slice 외부에서는 내부 구현 경로를 직접 import하지 말고 각 slice의 index.ts public API를 우선 사용한다.',
  },
]

function withRestrictedImports(patterns) {
  return [
    'error',
    {
      patterns: [...publicApiImportPatterns, ...patterns],
    },
  ]
}

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'no-restricted-imports': withRestrictedImports([]),
    },
  },
  {
    files: ['src/pages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': withRestrictedImports([
        {
          group: ['@/app/**'],
          message: 'pages 계층은 app 계층을 참조하지 않는다.',
        },
      ]),
    },
  },
  {
    files: ['src/widgets/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': withRestrictedImports([
        {
          group: ['@/app/**', '@/pages/**'],
          message: 'widgets 계층은 app/pages 계층을 참조하지 않는다.',
        },
      ]),
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': withRestrictedImports([
        {
          group: ['@/app/**', '@/pages/**', '@/widgets/**'],
          message: 'features 계층은 app/pages/widgets 계층을 참조하지 않는다.',
        },
      ]),
    },
  },
  {
    files: ['src/entities/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': withRestrictedImports([
        {
          group: ['@/app/**', '@/pages/**', '@/widgets/**', '@/features/**'],
          message: 'entities 계층은 app/pages/widgets/features 계층을 참조하지 않는다.',
        },
      ]),
    },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': withRestrictedImports([
        {
          group: [
            '@/app/**',
            '@/pages/**',
            '@/widgets/**',
            '@/features/**',
            '@/entities/**',
            '@/content/**',
          ],
          message:
            'shared 계층은 도메인 및 상위 계층에 의존하지 않는다. 공용 구현만 남긴다.',
        },
      ]),
    },
  },
  {
    files: ['src/content/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': withRestrictedImports([
        {
          group: [
            '@/app/**',
            '@/pages/**',
            '@/widgets/**',
            '@/features/**',
            '@/entities/**',
            '@/shared/**',
          ],
          message:
            'content 계층은 텍스트/카탈로그 데이터만 둔다. 로직 계층을 참조하지 않는다.',
        },
      ]),
    },
  },
])
