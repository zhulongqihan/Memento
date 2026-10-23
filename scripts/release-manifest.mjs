import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { basename, join, resolve, relative } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
const release = join(root, 'output', 'releases', version)
const manifestPath = join(release, 'manifest.json')
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex').toUpperCase()
const paths = [join(release, 'portable', `Memento-${version}-portable.exe`), ...readdirSync(join(release, 'installer')).filter((name) => name.endsWith('-setup.exe')).map((name) => join(release, 'installer', name))]
assert.equal(paths.length, 2, 'Expected one portable and one installer')
const artifacts = paths.map((file) => {
  const sha256 = hash(file)
  assert.equal(readFileSync(`${file}.sha256`, 'utf8').trim(), `${sha256}  ${basename(file)}`)
  return { path: relative(release, file).replaceAll('\\', '/'), bytes: readFileSync(file).length, sha256 }
})
if (process.argv[2] === 'write') {
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  const sourceDirty = Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=normal', '--', 'src', 'src-tauri', 'scripts', 'public', '.cargo', 'index.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig*.json'], { cwd: root, encoding: 'utf8' }).trim())
  writeFileSync(manifestPath, JSON.stringify({ version, sourceCommit, sourceDirty, builtAt: new Date().toISOString(), artifacts }, null, 2))
} else {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  assert.equal(manifest.version, version)
  assert.deepEqual(manifest.artifacts, artifacts)
}
console.log(JSON.stringify({ status: 'verified', version, artifacts }, null, 2))
