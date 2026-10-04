import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import stylistic from '@stylistic/eslint-plugin'
import globals from 'globals'

export default [
    {ignores: ['dist/', 'node_modules/']},
    js.configs.recommended,
    reactHooks.configs.flat['recommended-latest'],
    {
        files: ['**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: {ecmaFeatures: {jsx: true}},
            globals: {...globals.browser, ...globals.node}
        },
        plugins: {'@stylistic': stylistic},
        rules: {
            '@stylistic/indent': ['error', 4],
            '@stylistic/jsx-indent-props': ['error', 4],
            '@stylistic/semi': ['error', 'never'],
            '@stylistic/quotes': ['error', 'single', {avoidEscape: true}],
            '@stylistic/jsx-quotes': ['error', 'prefer-single'],
            '@stylistic/object-curly-spacing': ['error', 'never'],
            '@stylistic/jsx-curly-spacing': ['error', {when: 'never', children: true}],
            '@stylistic/jsx-tag-spacing': ['error', {beforeSelfClosing: 'never'}],
            '@stylistic/comma-dangle': ['error', 'never'],
            '@stylistic/no-multi-spaces': 'error',
            '@stylistic/eol-last': 'error',
            '@stylistic/no-trailing-spaces': 'error',
            '@stylistic/max-len': ['error', {
                code: 130, ignoreStrings: true, ignoreUrls: true, ignoreTemplateLiterals: true, ignoreRegExpLiterals: true
            }]
        }
    }
]
