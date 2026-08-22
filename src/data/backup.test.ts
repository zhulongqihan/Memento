import { describe, expect, it } from 'vitest'
import { createSeedState } from './seed'
import { createEncryptedBackupBlob, parseBackup, parseEncryptedBackup } from './backup'

function fakeFile(name: string, text: string): File {
  return { name, text: async () => text } as File
}

describe('备份安全校验', () => {
  it('加密备份可以用正确密码恢复，并拒绝错误密码', async () => {
    const blob = await createEncryptedBackupBlob(createSeedState(), 'memento-pass-2026')
    const file = fakeFile('memento-test.memento', await blob.text())
    const summary = await parseEncryptedBackup(file, 'memento-pass-2026')

    expect(summary.schemaVersion).toBe(2)
    expect(summary.momentCount).toBe(3)
    await expect(parseEncryptedBackup(file, 'wrong-pass')).rejects.toThrow('密码错误或加密备份已损坏')
  })

  it('带完整性摘要的普通备份被改动后会被拒绝', async () => {
    const state = createSeedState()
    const payload = {
      manifest: {
        schemaVersion: 2,
        appVersion: '2.5.0',
        exportedAt: new Date().toISOString(),
        timezone: 'Asia/Shanghai',
        momentCount: state.moments.length,
        photoCount: state.photos.length,
        integritySha256: 'not-the-real-digest',
      },
      data: state,
    }
    await expect(parseBackup(fakeFile('tampered.json', JSON.stringify(payload)))).rejects.toThrow('备份完整性校验失败')
  })

  it('备份预览的数量以实际迁移后的数据为准', async () => {
    const state = createSeedState()
    const payload = {
      manifest: {
        schemaVersion: 2,
        appVersion: '2.5.0',
        exportedAt: new Date().toISOString(),
        timezone: 'Asia/Shanghai',
        momentCount: 0,
        photoCount: 999,
      },
      data: state,
    }
    const summary = await parseBackup(fakeFile('stale-manifest.json', JSON.stringify(payload)))

    expect(summary.momentCount).toBe(state.moments.length)
    expect(summary.photoCount).toBe(state.photos.length)
  })
})
