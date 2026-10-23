import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { publishArtifact } from './release-artifacts.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mode = process.argv[2]
const allowedModes = new Set(['portable', 'installer', 'all'])
if (!allowedModes.has(mode)) throw new Error('用法：node scripts/build-windows-release.mjs <portable|installer|all>')
if (process.platform !== 'win32') throw new Error('Memento 4.0.0 发布产物必须在 Windows x64 环境构建。')

const targetRoot = join(projectRoot, 'output', 'builds', 'memento-4.0.0')
const releaseRoot = join(projectRoot, 'output', 'releases', '4.0.0')
const cli = join(projectRoot, 'node_modules', '@tauri-apps', 'cli', 'tauri.js')
if (!existsSync(cli)) throw new Error(`找不到本地 Tauri CLI：${cli}。请先运行 npm ci。`)

function runTauri(args) {
  mkdirSync(targetRoot, { recursive: true })
  const env = {
    ...process.env,
    CARGO_TARGET_DIR: targetRoot,
    MEMENTO_V4_CARGO_TARGET_DIR: targetRoot,
  }
  const result = spawnSync(process.execPath, [cli, 'build', '--ci', ...args], {
    cwd: projectRoot,
    env,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Tauri 构建失败（exit ${result.status ?? 'unknown'}）。`)
}

function publishCopy(source, target) {
  const { hash } = publishArtifact(source, target)
  console.log(`已生成：${target}`)
  console.log(`SHA-256：${hash}`)
}

function syncPortable() {
  const script = join(projectRoot, 'scripts', 'sync-portable.mjs')
  const env = { ...process.env, MEMENTO_V4_CARGO_TARGET_DIR: targetRoot }
  const result = spawnSync(process.execPath, [script], { cwd: projectRoot, env, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`便携版同步失败（exit ${result.status ?? 'unknown'}）。`)
}

function publishInstaller() {
  const bundleDirectory = join(targetRoot, 'release', 'bundle', 'nsis')
  const installers = existsSync(bundleDirectory)
    ? readdirSync(bundleDirectory).filter((name) => name.toLowerCase().endsWith('-setup.exe')).sort()
    : []
  if (installers.length !== 1) {
    throw new Error(`期望找到一个 NSIS 安装包，实际找到 ${installers.length} 个：${bundleDirectory}`)
  }
  const source = join(bundleDirectory, installers[0])
  const target = join(releaseRoot, 'installer', installers[0])
  publishCopy(source, target)
}

if (mode === 'portable') {
  runTauri(['--no-bundle'])
  syncPortable()
}
if (mode === 'installer' || mode === 'all') {
  runTauri(['--bundles', 'nsis'])
  publishInstaller()
  // Tauri restores the unpatched executable after NSIS packaging. Both outputs
  // share one compilation; the manifest records the exact NSIS marker variant.
  if (mode === 'all') syncPortable()
}

console.log(`Memento 4.0.0 ${mode} 构建已完成。`)
if (mode === 'all') {
  const result = spawnSync(process.execPath, [join(projectRoot, 'scripts', 'release-manifest.mjs'), 'write'], { cwd: projectRoot, stdio: 'inherit' })
  if (result.status !== 0) throw new Error('发布产物对应清单生成失败。')
}
