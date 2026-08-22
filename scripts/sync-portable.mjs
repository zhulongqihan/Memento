import { copyFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(projectRoot, 'src-tauri', 'target', 'release', 'memento.exe')
const target = join(projectRoot, 'Memento.exe')

if (!existsSync(source)) {
  throw new Error(`找不到 Tauri 可执行文件：${source}。请先完成 tauri:build。`)
}

try {
  copyFileSync(source, target)
} catch (error) {
  if (error?.code === 'EBUSY' || error?.code === 'EPERM') {
    throw new Error(`无法更新 ${target}：便携版程序仍在运行。请先关闭 Memento.exe，再重新执行 tauri:build。`)
  }
  throw error
}

console.log(`已同步便携版：${target} (${statSync(target).size} bytes)`)
