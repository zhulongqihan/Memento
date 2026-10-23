import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrowserAssetStore, type AssetStore } from './asset-store'
import { commitStagedBackupImport, stageBackupImport } from './backup-import'
import { disposePhotoObjectUrls } from './repository'
import { createEmptyState } from './seed'
import type { BackupAssetPayload, BackupSummary, PhotoAssetMetadata } from '../domain/types'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length(): number { return this.values.size }
  clear(): void { this.values.clear() }
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null }
  removeItem(key: string): void { this.values.delete(key) }
  setItem(key: string, value: string): void { this.values.set(key, value) }
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function makeAsset(id: string, values: number[]): Promise<BackupAssetPayload> {
  const bytes = Uint8Array.from(values)
  const date = '2026-10-11T00:00:00.000Z'
  const metadata: PhotoAssetMetadata = { id, name: `${id}.png`, mimeType: 'image/png', sizeBytes: bytes.length, sha256: await sha256(bytes), createdAt: date, updatedAt: date }
  return { metadata, bytes }
}

function summary(assets: BackupAssetPayload[]): BackupSummary {
  const { photos: _photos, ...data } = createEmptyState()
  data.moments = [{ id: 'incoming-moment', kind: 'first', title: '带照片的时刻', date: '2026-10-11', photoIds: assets.map((asset) => asset.metadata.id), createdAt: '2026-10-11T00:00:00.000Z', updatedAt: '2026-10-11T00:00:00.000Z' }]
  return { fileName: 'incoming.json', schemaVersion: 4, appVersion: '4.0.0', exportedAt: '2026-10-11T00:00:00.000Z', timezone: 'UTC', momentCount: 1, photoCount: assets.length, dailyEntryCount: 0, narrationCount: 0, data, assets }
}

describe('备份导入暂存', () => {
  afterEach(() => {
    disposePhotoObjectUrls()
    vi.unstubAllGlobals()
  })

  it('遇到同 ID 不同内容时改分配 ID，且保留原照片字节', async () => {
    const storage = new MemoryStorage()
    vi.stubGlobal('localStorage', storage)
    const store = new BrowserAssetStore()
    await store.put(new File([Uint8Array.from([1, 1, 1])], 'original.png', { type: 'image/png' }), 'shared_photo')
    const imported = await makeAsset('shared_photo', [9, 9, 9])
    const staged = await stageBackupImport(summary([imported]), store)

    const newId = staged.state.moments[0].photoIds[0]
    expect(newId).not.toBe('shared_photo')
    expect(newId).toMatch(/^photo_/)
    expect(new Uint8Array(await (await store.read('shared_photo'))!.arrayBuffer())).toEqual(Uint8Array.from([1, 1, 1]))
    expect(new Uint8Array(await (await store.read(newId))!.arrayBuffer())).toEqual(imported.bytes)
    expect(staged.state.photos.some((photo) => photo.id === newId)).toBe(true)
    staged.commit()
  })

  it('发现同 ID 资产文件损坏时保留原文件，并把备份照片写到新 ID', async () => {
    const storage = new MemoryStorage()
    vi.stubGlobal('localStorage', storage)
    const store = new BrowserAssetStore()
    await store.put(new File([Uint8Array.from([1, 1, 1])], 'original.png', { type: 'image/png' }), 'damaged_photo')
    storage.setItem('memento:asset-data:v1:damaged_photo', btoa(String.fromCharCode(0, 0, 0)))
    const imported = await makeAsset('damaged_photo', [1, 1, 1])

    const staged = await stageBackupImport(summary([imported]), store)
    const newId = staged.state.moments[0].photoIds[0]
    expect(newId).not.toBe('damaged_photo')
    expect(storage.getItem('memento:asset-data:v1:damaged_photo')).toBe(btoa(String.fromCharCode(0, 0, 0)))
    expect(new Uint8Array(await (await store.read(newId))!.arrayBuffer())).toEqual(imported.bytes)
    staged.commit()
  })

  it('写入前先验证全部资产，哈希错误不会创建任何资产', async () => {
    const storage = new MemoryStorage()
    vi.stubGlobal('localStorage', storage)
    const store = new BrowserAssetStore()
    const wrong = await makeAsset('bad_asset', [2, 3, 4])
    wrong.metadata.sha256 = '0'.repeat(64)

    await expect(stageBackupImport(summary([wrong]), store)).rejects.toThrow('校验失败')
    expect(await store.list()).toEqual([])
  })

  it('任一照片写入失败时回滚此前暂存的所有新资产', async () => {
    const storage = new MemoryStorage()
    vi.stubGlobal('localStorage', storage)
    const browserStore = new BrowserAssetStore()
    const failingStore: AssetStore = {
      put: async (file, assetId) => {
        if (assetId === 'second_asset') throw new Error('synthetic write failure')
        return browserStore.put(file, assetId)
      },
      putWithStatus: async (file, assetId) => {
        if (assetId === 'second_asset') throw new Error('synthetic write failure')
        return browserStore.putWithStatus(file, assetId)
      },
      read: (id) => browserStore.read(id),
      remove: (id) => browserStore.remove(id),
      list: () => browserStore.list(),
      verify: () => browserStore.verify(),
    }
    const first = await makeAsset('first_asset', [1, 2, 3])
    const second = await makeAsset('second_asset', [4, 5, 6])

    await expect(stageBackupImport(summary([first, second]), failingStore)).rejects.toThrow('synthetic write failure')
    expect(await browserStore.list()).toEqual([])
  })

  it('状态提交失败时回滚新资产，但保留已存在的本机资产', async () => {
    const storage = new MemoryStorage()
    vi.stubGlobal('localStorage', storage)
    const store = new BrowserAssetStore()
    await store.put(new File([Uint8Array.from([7, 7, 7])], 'local.png', { type: 'image/png' }), 'local_asset')
    const incoming = await makeAsset('incoming_asset', [4, 5, 6])
    const staged = await stageBackupImport(summary([incoming]), store)

    await expect(commitStagedBackupImport(staged, async () => ({ status: 'failed', message: 'synthetic state commit failure' })))
      .rejects.toThrow('synthetic state commit failure')
    expect((await store.list()).map((asset) => asset.id)).toEqual(['local_asset'])
    expect(await store.read('incoming_asset')).toBeNull()
    expect(new Uint8Array(await (await store.read('local_asset'))!.arrayBuffer())).toEqual(Uint8Array.from([7, 7, 7]))
  })

  it('取消导入时只回滚新增照片，不移除与本机相同的已存在照片', async () => {
    const storage = new MemoryStorage()
    vi.stubGlobal('localStorage', storage)
    const store = new BrowserAssetStore()
    const file = new File([Uint8Array.from([8, 8, 8])], 'shared.png', { type: 'image/png' })
    await store.put(file, 'shared_asset')
    const incoming = await makeAsset('shared_asset', [8, 8, 8])
    const staged = await stageBackupImport(summary([incoming]), store)

    await staged.rollback()
    expect((await store.list()).map((asset) => asset.id)).toEqual(['shared_asset'])
    expect(new Uint8Array(await (await store.read('shared_asset'))!.arrayBuffer())).toEqual(Uint8Array.from([8, 8, 8]))
  })
})
