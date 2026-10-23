import { afterEach, describe, expect, it, vi } from 'vitest'
import { AssetStoreError, BrowserAssetStore } from './asset-store'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length(): number { return this.values.size }
  clear(): void { this.values.clear() }
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null }
  removeItem(key: string): void { this.values.delete(key) }
  setItem(key: string, value: string): void { this.values.set(key, value) }
}

class QuotaStorage extends MemoryStorage {
  setItem(key: string, value: string): void {
    if (key.startsWith('memento:asset-data:')) throw new DOMException('Quota exceeded', 'QuotaExceededError')
    super.setItem(key, value)
  }
}

function imageFile(name = 'synthetic.png', content = [1, 2, 3]): File {
  return new File([Uint8Array.from(content)], name, { type: 'image/png' })
}

describe('独立照片资产存储', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('保存照片字节与元数据分开，并能按资产 ID 读取', async () => {
    vi.stubGlobal('localStorage', new MemoryStorage())
    const store = new BrowserAssetStore()
    const metadata = await store.put(imageFile(), 'fixture_asset_1')
    const blob = await store.read(metadata.id)

    expect(metadata.sizeBytes).toBe(3)
    expect(metadata.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(await blob?.arrayBuffer()).toEqual(Uint8Array.from([1, 2, 3]).buffer)
    expect((await store.list()).map((asset) => asset.id)).toEqual(['fixture_asset_1'])
  })

  it('拒绝覆盖同 ID 的不同内容，并报告丢失、损坏和孤儿文件', async () => {
    const storage = new MemoryStorage()
    vi.stubGlobal('localStorage', storage)
    const store = new BrowserAssetStore()
    await store.put(imageFile(), 'fixture_asset_2')
    await expect(store.put(imageFile('other.png', [9, 8, 7]), 'fixture_asset_2')).rejects.toMatchObject({ code: 'asset_id_conflict' })

    storage.removeItem('memento:asset-data:v1:fixture_asset_2')
    storage.setItem('memento:asset-data:v1:orphan_asset', btoa('orphan'))
    await store.put(imageFile('corrupt.png', [4, 5, 6]), 'fixture_asset_3')
    storage.setItem('memento:asset-data:v1:fixture_asset_3', btoa('changed'))

    const report = await store.verify()
    expect(report.missingAssetIds).toEqual(['fixture_asset_2'])
    expect(report.corruptAssetIds).toEqual(['fixture_asset_3'])
    expect(report.orphanedAssetIds).toEqual(['orphan_asset'])
  })

  it('并发写入同 ID 的不同照片时只保留一个结果，失败操作不会删除获胜照片', async () => {
    vi.stubGlobal('localStorage', new MemoryStorage())
    const store = new BrowserAssetStore()
    const writes = await Promise.allSettled([
      store.putWithStatus(imageFile('first.png', [1, 2, 3]), 'shared_asset'),
      store.putWithStatus(imageFile('second.png', [9, 8, 7]), 'shared_asset'),
    ])
    const successful = writes.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof store.putWithStatus>>> => result.status === 'fulfilled')
    const failed = writes.filter((result) => result.status === 'rejected')

    expect(successful).toHaveLength(1)
    expect(successful[0]?.value.created).toBe(true)
    expect(failed).toHaveLength(1)
    expect(failed[0]).toMatchObject({ status: 'rejected', reason: { code: 'asset_id_conflict' } })
    expect((await store.list()).map((asset) => asset.id)).toEqual(['shared_asset'])
    expect(await (await store.read('shared_asset'))?.arrayBuffer()).toEqual(Uint8Array.from([1, 2, 3]).buffer)
  })

  it('浏览器容量写入失败会明确报告，不返回已保存资产', async () => {
    vi.stubGlobal('localStorage', new QuotaStorage())
    const store = new BrowserAssetStore()

    await expect(store.put(imageFile(), 'fixture_asset_quota')).rejects.toMatchObject({ code: 'local_storage' })
    expect(await store.list()).toEqual([])
  })

  it('不同 ID 的照片同时完成字节读取时保留全部索引', async () => {
    vi.stubGlobal('localStorage', new MemoryStorage())
    let arrived = 0
    let release!: () => void
    const barrier = new Promise<void>((resolve) => { release = resolve })
    class ConcurrentFile extends File {
      private reads = 0
      async arrayBuffer(): Promise<ArrayBuffer> {
        if (++this.reads === 2) {
          if (++arrived === 3) release()
          await barrier
        }
        return super.arrayBuffer()
      }
    }
    const store = new BrowserAssetStore()
    await Promise.all(['one', 'two', 'three'].map((id) => store.put(new ConcurrentFile([id], `${id}.png`, { type: 'image/png' }), id)))
    expect((await store.list()).map((asset) => asset.id).sort()).toEqual(['one', 'three', 'two'])
    expect((await store.verify()).orphanedAssetIds).toEqual([])
  })
})
