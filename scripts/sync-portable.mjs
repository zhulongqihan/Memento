import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(projectRoot, 'src-tauri', 'target', 'release', 'memento.exe')
const target = join(projectRoot, 'Memento.exe')
const checksumTarget = join(projectRoot, 'Memento.exe.sha256')

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

const checksum = createHash('sha256').update(readFileSync(target)).digest('hex').toUpperCase()
writeFileSync(checksumTarget, `${checksum}  Memento.exe\n`, 'utf8')

console.log(`已同步便携版：${target} (${statSync(target).size} bytes)`)
console.log(`已写入校验值：${checksumTarget}`)
