import {execSync} from 'node:child_process'
import {readFileSync} from 'node:fs'

const run = cmd => execSync(cmd, {stdio: 'inherit'})
const out = cmd => execSync(cmd, {encoding: 'utf8'}).trim()
const fail = msg => {console.error(`release: ${msg}`); process.exit(1)}

const arg = process.argv[2] || 'patch'
const current = JSON.parse(readFileSync('package.json', 'utf8')).version
const [major, minor, patch] = current.split('.').map(Number)
const bumps = {major: `${major + 1}.0.0`, minor: `${major}.${minor + 1}.0`, patch: `${major}.${minor}.${patch + 1}`}
const next = /^\d+\.\d+\.\d+$/.test(arg) ? arg : bumps[arg]
const tag = `v${next}`

if (!next) fail('usage: npm run release -- patch | minor | major | x.y.z')
if (out('git branch --show-current') !== 'main') fail('switch to main first')
if (out('git status --porcelain')) fail('working tree is not clean: commit or stash first')
if (out(`git tag -l ${tag}`)) fail(`tag ${tag} already exists`)
if (!readFileSync('CHANGELOG.md', 'utf8').includes(`## ${next}`)) fail(`CHANGELOG.md has no "## ${next}" section`)

try {
    if (next !== current) run(`npm version ${next} --no-git-tag-version`)
    run('npm run check')
} catch {
    run('git checkout -- package.json package-lock.json')
    fail('check failed, nothing was released')
}

if (next !== current) {
    run('git add package.json package-lock.json')
    run(`git commit --no-verify -m "Release ${tag}"`)
}
run('git checkout --detach')
try {
    run('git add -f dist')
    run(`git commit --no-verify -m "${tag} (with dist)"`)
    run(`git tag ${tag}`)
} finally {
    run('git checkout main')
}
run(`git push --no-verify --atomic origin main ${tag}`)
console.log(`released ${tag}: npm i github:l1nway/collapse#semver:^${next}`)
