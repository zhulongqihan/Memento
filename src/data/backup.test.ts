import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { createSeedState } from './seed'
import type { AssetStore } from './asset-store'
import { createEncryptedBackupBlob, createJsonBackupBlob, createZipBackupBlob, parseBackup, parseEncryptedBackup } from './backup'
import backupV1 from './fixtures/legacy/backup-v1.json'
import backupV2 from './fixtures/legacy/backup-v2.json'
import backupV3 from './fixtures/legacy/backup-v3.json'
import backupV4ImportTransaction from './fixtures/legacy/backup-v4-import-transaction.json'
import encryptedBackupV3 from './fixtures/legacy/encrypted-backup-v3-3.1.0.memento?raw'
import type { AppStateV4, PhotoAssetMetadata } from '../domain/types'

function fakeFile(name: string, text: string): File {
  return { name, text: async () => text } as File
}

function persistedSeed(): AppStateV4 {
  const { photos: _runtimePhotos, ...data } = createSeedState()
  return data
}

function encodeBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

async function digest(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function digestText(value: string): Promise<string> {
  return digest(new TextEncoder().encode(value))
}

function assetMetadata(id: string, bytes: Uint8Array, sha256: string): PhotoAssetMetadata {
  const date = '2026-10-11T00:00:00.000Z'
  return { id, name: 'synthetic.png', mimeType: 'image/png', sizeBytes: bytes.byteLength, sha256, width: 1, height: 1, createdAt: date, updatedAt: date }
}

describe('备份安全校验', () => {
  it('读取用于隔离 UI 导入测试的 v4 合成备份和资产', async () => {
    const parsed = await parseBackup(fakeFile('backup-v4-import-transaction.json', JSON.stringify(backupV4ImportTransaction)))

    expect(parsed.schemaVersion).toBe(4)
    expect(parsed.data.moments[0]?.title).toBe('导入事务合成记录')
    expect(parsed.assets[0]?.metadata.id).toBe('incoming_photo_v4')
    expect(parsed.assets[0]?.bytes).toEqual(Uint8Array.from([11, 22, 33]))
  })

  it('将 v1/v2/v3 合成 JSON 与 ZIP 迁移预览为 v4，并提取独立资产字节', async () => {
    const fixtures = [
      { version: 1, json: backupV1 },
      { version: 2, json: backupV2 },
      { version: 3, json: backupV3 },
    ]

    for (const { version, json } of fixtures) {
      const jsonSummary = await parseBackup(fakeFile(`backup-v${version}.json`, JSON.stringify(json)))
      expect(jsonSummary.schemaVersion).toBe(4)
      expect(jsonSummary.momentCount).toBe(1)
      expect(jsonSummary.photoCount).toBe(1)
      expect(jsonSummary.data.moments[0]?.title).toBe(`合成时刻 v${version}`)
      expect(jsonSummary.data).not.toHaveProperty('photos')
      expect(jsonSummary.assets[0]?.metadata.id).toBe(`fixture-photo-v${version}`)
      expect(jsonSummary.assets[0]?.bytes.byteLength).toBeGreaterThan(0)

      const payload = json as { manifest: unknown; data: { photos: Array<{ id: string; dataUrl: string }> } }
      const zip = new JSZip()
      zip.file('manifest.json', JSON.stringify(payload.manifest, null, 2))
      zip.file('data.json', JSON.stringify(payload.data, null, 2))
      payload.data.photos.forEach((photo) => {
        zip.file(`assets/${photo.id}`, photo.dataUrl.split(',')[1], { base64: true })
      })
      const zipInput = await zip.generateAsync({ type: 'arraybuffer' }) as ArrayBuffer & { name?: string }
      Object.defineProperty(zipInput, 'name', { value: `backup-v${version}.zip` })
      const zipSummary = await parseBackup(zipInput as unknown as File)
      expect(zipSummary.schemaVersion).toBe(4)
      expect(zipSummary.photoCount).toBe(1)
      expect(zipSummary.assets[0]?.metadata.id).toBe(`fixture-photo-v${version}`)
    }
  })

  it('读取 v4 JSON 与 ZIP，且状态 JSON 不重复包含照片数据', async () => {
    const data = persistedSeed()
    const bytes = Uint8Array.from([1, 2, 3, 4])
    const metadata = assetMetadata('fixture_asset_v4', bytes, await digest(bytes))
    data.moments[0] = { ...data.moments[0], photoIds: [metadata.id] }
    const assets = [{ metadata, data: encodeBase64(bytes) }]
    const manifest: { schemaVersion: number; appVersion: string; exportedAt: string; timezone: string; momentCount: number; photoCount: number; dailyEntryCount: number; narrationCount: number; assets: PhotoAssetMetadata[]; integritySha256?: string } = { schemaVersion: 4, appVersion: '4.0.0', exportedAt: metadata.createdAt, timezone: 'UTC', momentCount: data.moments.length, photoCount: 1, dailyEntryCount: 0, narrationCount: 0, assets: [metadata] }
    manifest.integritySha256 = await digestText(JSON.stringify({ data, assets }))

    const json = await parseBackup(fakeFile('v4.json', JSON.stringify({ manifest, data, assets })))
    expect(json.data).not.toHaveProperty('photos')
    expect(json.assets[0]?.bytes).toEqual(bytes)

    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify(manifest))
    zip.file('data.json', JSON.stringify(data))
    zip.file(`assets/${metadata.id}`, bytes)
    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' }) as ArrayBuffer & { name?: string }
    Object.defineProperty(zipBuffer, 'name', { value: 'v4.zip' })
    const zipped = await parseBackup(zipBuffer as unknown as File)
    expect(zipped.assets[0]?.metadata.id).toBe(metadata.id)
    expect(zipped.assets[0]?.bytes).toEqual(bytes)
  })

  it('缺少资产或哈希不符时拒绝 v4 备份', async () => {
    const data = persistedSeed()
    const bytes = Uint8Array.from([7, 8, 9])
    const metadata = assetMetadata('missing_asset', bytes, await digest(bytes))
    data.moments[0] = { ...data.moments[0], photoIds: [metadata.id] }
    const manifest = { schemaVersion: 4, appVersion: '4.0.0', exportedAt: metadata.createdAt, timezone: 'UTC', momentCount: 3, photoCount: 1, dailyEntryCount: 0, narrationCount: 0, assets: [metadata] }

    await expect(parseBackup(fakeFile('missing.json', JSON.stringify({ manifest, data, assets: [] })))).rejects.toThrow('缺少照片资产')
    await expect(parseBackup(fakeFile('corrupt.json', JSON.stringify({ manifest, data, assets: [{ metadata, data: encodeBase64(Uint8Array.from([1, 2, 3])) }] })))).rejects.toThrow('完整性校验失败')
  })

  it('加密备份可以用正确密码恢复，并拒绝错误密码', async () => {
    const state = createSeedState()
    state.settings.visualNarrative = 'instrument'
    const blob = await createEncryptedBackupBlob(state, 'memento-pass-2026')
    const file = fakeFile('memento-test.memento', await blob.text())
    const summary = await parseEncryptedBackup(file, 'memento-pass-2026')

    expect(summary.schemaVersion).toBe(4)
    expect(summary.momentCount).toBe(3)
    expect(summary.data.settings.visualNarrative).toBe('instrument')
    await expect(parseEncryptedBackup(file, 'wrong-pass')).rejects.toThrow('密码错误或加密备份已损坏')
  })

  it('读取固定的 3.1.0 v3 加密格式样本并迁移其照片资产', async () => {
    const summary = await parseEncryptedBackup(
      fakeFile('memento-encrypted-v3-3.1.0.memento', encryptedBackupV3),
      'legacy-pass-3.1.0',
    )

    expect(summary.appVersion).toBe('3.1.0')
    expect(summary.schemaVersion).toBe(4)
    expect(summary.momentCount).toBe(1)
    expect(summary.photoCount).toBe(1)
    expect(summary.data.moments[0]?.id).toBe('fixture-moment-v3')
    expect(summary.data.moments[0]?.title).toBe('合成时刻 v3')
    expect(summary.data).not.toHaveProperty('photos')
    expect(summary.assets[0]?.metadata.id).toBe('fixture-photo-v3')
    expect(summary.assets[0]?.bytes).toEqual(
      Uint8Array.from(
        atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC'),
        (character) => character.charCodeAt(0),
      ),
    )
    await expect(parseEncryptedBackup(fakeFile('memento-encrypted-v3-3.1.0.memento', encryptedBackupV3), 'wrong-pass'))
      .rejects.toThrow('密码错误或加密备份已损坏')
  })

  it('加密容器往返保存照片字节，状态 JSON 仍不含照片字段', async () => {
    const state = createSeedState()
    const bytes = Uint8Array.from([3, 1, 4, 1, 5])
    const metadata = assetMetadata('encrypted_photo', bytes, await digest(bytes))
    state.moments[0] = { ...state.moments[0], photoIds: [metadata.id] }
    state.photos = [{ ...metadata, src: 'blob:encrypted-photo' }]
    const photo = new Blob([bytes], { type: metadata.mimeType })
    const store: AssetStore = {
      put: async () => metadata,
      putWithStatus: async () => ({ metadata, created: false }),
      read: async (id) => id === metadata.id ? photo : null,
      remove: async () => undefined,
      list: async () => [metadata],
      verify: async () => ({ missingAssetIds: [], orphanedAssetIds: [], corruptAssetIds: [] }),
    }

    const jsonBlob = await createJsonBackupBlob(state, store)
    const jsonPayload = JSON.parse(await jsonBlob.text()) as { manifest: { assets: Array<Record<string, unknown>> }; assets: Array<{ metadata: Record<string, unknown> }> }
    expect(jsonPayload.assets[0]?.metadata).not.toHaveProperty('src')
    expect(jsonPayload.manifest.assets[0]).not.toHaveProperty('src')

    const zipBlob = await createZipBackupBlob(state, store)
    const zipFile = await JSZip.loadAsync(await zipBlob.arrayBuffer())
    const zipManifest = JSON.parse(await zipFile.file('manifest.json')!.async('string')) as { assets: Array<Record<string, unknown>> }
    expect(zipManifest.assets[0]).not.toHaveProperty('src')

    const blob = await createEncryptedBackupBlob(state, 'memento-pass-2026', store)
    const restored = await parseEncryptedBackup(fakeFile('memento-photo.memento', await blob.text()), 'memento-pass-2026')

    expect(restored.data).not.toHaveProperty('photos')
    expect(restored.assets[0]?.metadata.id).toBe(metadata.id)
    expect(restored.assets[0]?.metadata).not.toHaveProperty('src')
    expect(restored.assets[0]?.bytes).toEqual(bytes)
  })

  it('带完整性摘要的旧备份被改动后会被拒绝', async () => {
    const tampered = { ...(backupV3 as { data: Record<string, unknown>; manifest: Record<string, unknown> }), data: { ...(backupV3 as { data: Record<string, unknown> }).data, moments: [] } }
    await expect(parseBackup(fakeFile('tampered.json', JSON.stringify(tampered)))).rejects.toThrow('备份完整性校验失败')
  })

  it('忽略旧清单中的过期计数，保留每日记录字段', async () => {
    const state = createSeedState()
    state.dailyEntries = [{ id: 'daily-1', date: '2026-08-27', text: '今天的一行', createdAt: '2026-08-27T08:00:00.000Z', updatedAt: '2026-08-27T08:00:00.000Z' }]
    state.narrationUses = [{ id: 'narration-1', quoteId: 'copy-zh-0001', date: '2026-08-27', displayedAt: '2026-08-27T08:00:00.000Z', saved: false }]
    const { photos: _photos, ...data } = state
    const payload = {
      manifest: { schemaVersion: 3, appVersion: '3.1.0', exportedAt: new Date().toISOString(), timezone: 'Asia/Shanghai', momentCount: 0, photoCount: 999 },
      data,
    }
    const summary = await parseBackup(fakeFile('daily-and-narration.json', JSON.stringify(payload)))

    expect(summary.momentCount).toBe(state.moments.length)
    expect(summary.photoCount).toBe(0)
    expect(summary.dailyEntryCount).toBe(1)
    expect(summary.narrationCount).toBe(1)
  })
})
