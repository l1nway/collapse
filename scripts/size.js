import {build} from 'vite'
import {gzipSync} from 'node:zlib'
import {fileURLToPath} from 'node:url'
import {external, jsx} from '../vite.config.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const entry = fileURLToPath(new URL('../src/index.js', import.meta.url)).replaceAll('\\', '/')
const EXPORTS = [['Collapse'], ['Presence'], ['clamp'], ['Collapse', 'Presence'], ['Collapse', 'clamp']]
const ID = '\0size-entry'

const measure = async names => {
    const virtual = {name: 'size-entry', resolveId: id => id === ID ? id : null, load: id => id === ID ? `export {${names}} from '${entry}'` : null}
    const [{output}] = [await build({
        root, configFile: false, logLevel: 'silent', plugins: [virtual], oxc: jsx,
        build: {write: false, minify: true, rolldownOptions: {input: ID, external, preserveEntrySignatures: 'strict'}}
    })].flat()
    const code = output.filter(chunk => chunk.type === 'chunk').map(chunk => chunk.code).join('')
    return {export: names.join(' + '), min: Buffer.byteLength(code), gzip: gzipSync(code, {level: 9}).length}
}

const rows = []
for (const names of EXPORTS) rows.push(await measure(names))
const pad = (value, width, right) => right ? String(value).padStart(width) : String(value).padEnd(width)
const line = row => `${pad(row.export, 20)}${pad(row.min, 10, true)}${pad(row.gzip, 10, true)}`
console.log(line({export: 'export', min: 'min B', gzip: 'gzip B'}))
rows.forEach(row => console.log(line(row)))
