import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const projectRoot = resolve(import.meta.dirname, '..')
const readJson = (file) => JSON.parse(readFileSync(join(projectRoot, file), 'utf8'))
export const appVersion = readJson('package.json').version
assert.match(appVersion, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/, 'Application version must be a valid release path segment')

// Fail before producing files if the UI, native metadata and lockfiles disagree.
const lock = readJson('package-lock.json')
const cargoVersion = readFileSync(join(projectRoot, 'src-tauri/Cargo.toml'), 'utf8').match(/^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m)?.[1]
const uiVersion = readFileSync(join(projectRoot, 'src/version.ts'), 'utf8').match(/export const APP_VERSION = ['"]([^'"]+)['"]/)?.[1]
for (const [source, version] of Object.entries({ 'package-lock.json': lock.version, 'package-lock.json root': lock.packages[''].version, 'tauri.conf.json': readJson('src-tauri/tauri.conf.json').version, 'Cargo.toml': cargoVersion, 'src/version.ts': uiVersion })) {
  assert.equal(version, appVersion, `${source} must match package.json`)
}

export const cargoTargetRoot = join(projectRoot, 'output', 'builds', `memento-${appVersion}`)
export const releaseRoot = join(projectRoot, 'output', 'releases', appVersion)
export const browserEvidenceRoot = join(projectRoot, 'output', 'playwright', `release-${appVersion}`)
