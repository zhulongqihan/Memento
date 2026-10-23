import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

if (process.env.GITHUB_ACTIONS !== 'true' || process.env.RUNNER_ENVIRONMENT !== 'github-hosted') throw new Error('Legacy baseline requires a GitHub hosted Windows runner')
const root = resolve(import.meta.dirname, '..')
const destination = join(root, 'output', 'baseline-3.1.0')
if (existsSync(destination)) throw new Error('Refusing to overwrite an existing baseline directory')
mkdirSync(destination, { recursive: true })
const archive = join(destination, 'source.tar')
execFileSync('git', ['archive', '--format=tar', '--output', archive, '6d4bf8a35c99ceaf459a0851dc4fc10cf89940f4'], { cwd: root, stdio: 'inherit' })
execFileSync('tar', ['-xf', archive, '-C', destination], { stdio: 'inherit' })
execFileSync('npm.cmd', ['ci'], { cwd: destination, stdio: 'inherit', shell: true })
const target = join(root, 'output', 'builds', 'memento-4.0.0')
execFileSync(process.execPath, [join(destination, 'node_modules', '@tauri-apps', 'cli', 'tauri.js'), 'build', '--ci', '--no-bundle'], { cwd: destination, env: { ...process.env, CARGO_TARGET_DIR: target }, stdio: 'inherit' })
copyFileSync(join(target, 'release', 'memento.exe'), join(destination, 'Memento-3.1.0.exe'))
