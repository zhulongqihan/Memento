import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { publishArtifact } from './release-artifacts.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const targetRoot = process.env.MEMENTO_V4_CARGO_TARGET_DIR
  ? resolve(process.env.MEMENTO_V4_CARGO_TARGET_DIR)
  : join(projectRoot, 'output', 'builds', 'memento-4.0.0')
const source = join(targetRoot, 'release', 'memento.exe')
const outputDirectory = join(projectRoot, 'output', 'releases', '4.0.0', 'portable')
const target = join(outputDirectory, 'Memento-4.0.0-portable.exe')

if (!existsSync(source)) {
  throw new Error(`找不到隔离构建目录中的 Tauri 可执行文件：${source}。请先运行 npm run tauri:build:portable。`)
}

const { hash, bytes } = publishArtifact(source, target)
console.log(`已生成便携版：${target} (${bytes} bytes)`)
console.log(`SHA-256：${hash}`)
