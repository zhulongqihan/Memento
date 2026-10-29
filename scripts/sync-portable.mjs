import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { publishArtifact } from './release-artifacts.mjs'
import { appVersion, cargoTargetRoot, releaseRoot } from './release-config.mjs'

const targetRoot = process.env.MEMENTO_V4_CARGO_TARGET_DIR
  ? resolve(process.env.MEMENTO_V4_CARGO_TARGET_DIR)
  : cargoTargetRoot
const source = join(targetRoot, 'release', 'memento.exe')
const outputDirectory = join(releaseRoot, 'portable')
const target = join(outputDirectory, `Memento-${appVersion}-portable.exe`)

if (!existsSync(source)) {
  throw new Error(`找不到隔离构建目录中的 Tauri 可执行文件：${source}。请先运行 npm run tauri:build:portable。`)
}

const { hash, bytes } = publishArtifact(source, target)
console.log(`已生成便携版：${target} (${bytes} bytes)`)
console.log(`SHA-256：${hash}`)
