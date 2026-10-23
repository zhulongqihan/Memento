import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const targetRoot = join(projectRoot, 'output', 'builds', 'memento-isolated-storage-test')
const cli = join(projectRoot, 'node_modules', '@tauri-apps', 'cli', 'tauri.js')
if (process.platform !== 'win32') throw new Error('隔离 Tauri 存储测试需要 Windows x64。')
if (!existsSync(cli)) throw new Error(`找不到本地 Tauri CLI：${cli}。请先运行 npm ci。`)

mkdirSync(targetRoot, { recursive: true })
const result = spawnSync(process.execPath, [cli, 'build', '--ci', '--no-bundle', '--features', 'isolated-storage-test'], {
  cwd: projectRoot,
  env: { ...process.env, CARGO_TARGET_DIR: targetRoot },
  stdio: 'inherit',
})
if (result.error) throw result.error
if (result.status !== 0) throw new Error(`隔离 Tauri 测试构建失败（exit ${result.status ?? 'unknown'}）。`)
console.log(`隔离测试二进制：${join(targetRoot, 'release', 'memento.exe')}`)
