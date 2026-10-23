import { createHash } from 'node:crypto'
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname } from 'node:path'

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase()
}

function temporaryPath(target) {
  return `${target}.tmp-${process.pid}-${Date.now()}`
}

function replaceFile(source, target) {
  const temporary = temporaryPath(target)
  try {
    copyFileSync(source, temporary, constants.COPYFILE_EXCL)
    renameSync(temporary, target)
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary)
  }
}

function replaceText(contents, target) {
  const temporary = temporaryPath(target)
  try {
    writeFileSync(temporary, contents, { encoding: 'utf8', flag: 'wx' })
    renameSync(temporary, target)
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary)
  }
}

/**
 * Publishes a release file and adjacent checksum. A prior file is replaced only
 * when its current bytes match the existing checksum generated beside it.
 */
export function publishArtifact(source, target) {
  if (!existsSync(source)) throw new Error(`构建产物不存在：${source}`)
  mkdirSync(dirname(target), { recursive: true })

  const sourceHash = sha256(source)
  const checksumPath = `${target}.sha256`
  const expectedChecksum = `${sourceHash}  ${basename(target)}\n`
  let verifiedReplacement = false

  if (existsSync(target)) {
    const currentHash = sha256(target)
    if (currentHash !== sourceHash) {
      const currentChecksum = existsSync(checksumPath) ? readFileSync(checksumPath, 'utf8') : ''
      const expectedCurrentChecksum = `${currentHash}  ${basename(target)}\n`
      if (currentChecksum !== expectedCurrentChecksum) {
        throw new Error(`发布文件已存在且不能通过旁置校验值验证，拒绝覆盖：${target}`)
      }
      replaceFile(source, target)
      verifiedReplacement = true
    }
  } else {
    copyFileSync(source, target, constants.COPYFILE_EXCL)
  }

  if (existsSync(checksumPath)) {
    const currentChecksum = readFileSync(checksumPath, 'utf8')
    if (currentChecksum !== expectedChecksum) {
      if (!verifiedReplacement) {
        throw new Error(`校验文件与当前发布文件不符，拒绝覆盖：${checksumPath}`)
      }
      replaceText(expectedChecksum, checksumPath)
    }
  } else {
    writeFileSync(checksumPath, expectedChecksum, { encoding: 'utf8', flag: 'wx' })
  }

  return { hash: sourceHash, bytes: readFileSync(target).byteLength }
}
