import {defineConfig} from 'vitest/config'
import react from '@vitejs/plugin-react'
import {playwright} from '@vitest/browser-playwright'

export const external = [/^react(\/|$)/, /^react-dom(\/|$)/]

// [DOC: build-jsx]
export const jsx = {jsx: {runtime: 'automatic', development: false}}

export default defineConfig(({command}) => ({
    plugins: command === 'build' ? [] : [react()],
    oxc: command === 'build' ? jsx : undefined,
    build: {
        lib: {entry: 'src/index.js', formats: ['es'], fileName: 'index'},
        rolldownOptions: {external},
        minify: false,
        sourcemap: false,
        emptyOutDir: true,
        copyPublicDir: false
    },
    test: {
        projects: [
            {
                extends: true,
                test: {
                    name: 'browser',
                    include: ['test/**/*.browser.test.{js,jsx}'],
                    browser: {
                        enabled: true,
                        headless: true,
                        connectTimeout: 30000,
                        fileParallelism: false,
                        provider: playwright(),
                        instances: [{browser: 'chromium'}, {browser: 'firefox'}, {browser: 'webkit'}]
                    }
                }
            },
            {
                extends: true,
                test: {name: 'node', include: ['test/**/*.node.test.{js,jsx}'], environment: 'node'}
            }
        ]
    }
}))
