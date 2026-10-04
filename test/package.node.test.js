import {beforeAll, describe, expect, test} from 'vitest'
import {execSync} from 'node:child_process'
import {existsSync, readFileSync} from 'node:fs'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {build} from 'vite'
import react from '@vitejs/plugin-react'
import {external} from '../vite.config.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const at = path => fileURLToPath(new URL(`../${path}`, import.meta.url))
const text = path => readFileSync(at(path), 'utf8')
const pkg = JSON.parse(text('package.json'))
const entry = at('src/index.js').replaceAll('\\', '/')
const ALLOWED = ['react', 'react/jsx-runtime']
const ID = '\0shake-entry'

const specifiers = code => [...code.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g)].map(match => match[1])

// mirrors scripts/size.js
const bundle = async source => {
    const virtual = {name: 'shake-entry', resolveId: id => id === ID ? id : null, load: id => id === ID ? source : null}
    const [{output}] = [await build({
        root, configFile: false, logLevel: 'silent', plugins: [react(), virtual],
        build: {write: false, minify: true, rolldownOptions: {input: ID, external, preserveEntrySignatures: 'strict'}}
    })].flat()
    return output.filter(chunk => chunk.type === 'chunk').map(chunk => chunk.code).join('')
}

describe('package.json', () => {
    test('is an ESM-only, side-effect-free package', () => {
        expect(pkg.type).toBe('module')
        expect(pkg.sideEffects).toBe(false)
        expect(pkg).not.toHaveProperty('main')
        expect(pkg).not.toHaveProperty('require')
        expect(JSON.stringify(pkg.exports)).not.toContain('require')
    })

    test('exports . has only types and import', () => {
        expect(Object.keys(pkg.exports)).toEqual(['.'])
        expect(pkg.exports['.']).toEqual({types: './index.d.ts', import: './dist/index.js'})
        expect(existsSync(at(pkg.exports['.'].types))).toBe(true)
    })

    test('files ships only dist, index.d.ts and README.md', () => {
        expect([...pkg.files].sort()).toEqual(['README.md', 'dist', 'index.d.ts'])
        expect(existsSync(at('README.md'))).toBe(true)
    })

    test('peer depends only on react >=19.2 and has no runtime dependencies', () => {
        expect(pkg.peerDependencies).toEqual({react: '>=19.2'})
        expect(Object.keys(pkg.dependencies ?? {})).toEqual([])
        expect(pkg).not.toHaveProperty('optionalDependencies')
        expect(pkg).not.toHaveProperty('bundleDependencies')
    })
})

describe('index.d.ts', () => {
    const types = text('index.d.ts')

    test('declares exactly the exports and their prop types', () => {
        const names = [...types.matchAll(/^export\s+(?:declare\s+)?(?:function|type|interface|const|class)\s+(\w+)/gm)]
        expect(names.map(match => match[1]).sort()).toEqual([
            'ClampOptions', 'Collapse', 'CollapseProps', 'Plugin', 'Presence', 'PresenceProps', 'clamp', 'createClamp'
        ])
        expect(types).not.toMatch(/^export\s+(default|\{|\*)/m)
    })

    test('imports types from react only', () => {
        expect(specifiers(types)).toEqual(['react'])
    })
})

describe('build output', () => {
    let code

    beforeAll(() => {
        // [DOC: build-jsx]
        execSync('npm run build', {cwd: root, stdio: 'pipe', env: {...process.env, NODE_ENV: 'test'}})
        code = text('dist/index.js')
    }, 120_000)

    test('dist/index.js exports exactly Collapse, Presence, clamp and createClamp', async () => {
        const dist = await import(/* @vite-ignore */ `${pathToFileURL(at('dist/index.js')).href}?t=${Date.now()}`)
        expect(Object.keys(dist).sort()).toEqual(['Collapse', 'Presence', 'clamp', 'createClamp'])
        expect(typeof dist.Collapse).toBe('function')
        expect(typeof dist.Presence).toBe('function')
        expect(typeof dist.createClamp).toBe('function')
        expect(typeof dist.clamp.closed).toBe('function')
    })

    test('imports nothing but react and react/jsx-runtime', () => {
        const used = specifiers(code)
        expect(used.length).toBeGreaterThan(0)
        used.forEach(name => expect(ALLOWED).toContain(name))
    })

    test('keeps /* @__PURE__ */ before createContext', () => {
        expect(code).toMatch(/\/\*\s*@__PURE__\s*\*\/\s*(?:\(\s*0\s*,\s*)?[\w$.]*createContext\b/)
    })

    test('npm pack ships only the declared files', () => {
        const [{files}] = JSON.parse(execSync('npm pack --dry-run --json --ignore-scripts', {cwd: root, stdio: 'pipe'}).toString())
        const paths = files.map(file => file.path).sort()
        expect(paths).toContain('dist/index.js')
        expect(paths).toContain('index.d.ts')
        expect(paths).toContain('package.json')
        paths.forEach(path => expect(path).toMatch(/^(dist\/|index\.d\.ts$|README\.md$|package\.json$|LICENSE)/))
    }, 60_000)
})

describe('tree shaking', () => {
    const only = name => bundle(`import {${name}} from '${entry}'; console.log(${name})`)

    test('a Presence-only bundle drops the Collapse animation code', async () => {
        const code = await only('Presence')
        expect(code).toContain('toArray')
        expect(code).not.toContain('prefers-reduced-motion')
        expect(code).not.toContain('getComputedStyle')
        expect(code).not.toContain('borderTopWidth')
    }, 60_000)

    test('a Collapse-only bundle drops the Presence and clamp code', async () => {
        const code = await only('Collapse')
        expect(code).toContain('prefers-reduced-motion')
        expect(code).not.toContain('toArray')
        expect(code).not.toContain('isValidElement')
        expect(code).not.toContain('ResizeObserver')
        expect(code).not.toContain('data-overflow')
    }, 60_000)

    test('a clamp-only bundle drops the Collapse animation code', async () => {
        const code = await only('clamp')
        expect(code).toContain('ResizeObserver')
        expect(code).not.toContain('prefers-reduced-motion')
        expect(code).not.toContain('getComputedStyle')
    }, 60_000)
})
