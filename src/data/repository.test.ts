import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrowserAssetStore, type AssetStore } from './asset-store'
import { createAppRepository, createAppRepositoryWithBackend, disposePhotoObjectUrls, type StateBackend } from './repository'
import { createEmptyState } from './seed'
import localV1 from './fixtures/legacy/local-v1.json'
import localV2 from './fixtures/legacy/local-v2.json'
import localV3 from './fixtures/legacy/local-v3.json'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length(): number { return this.values.size }
  clear(): void { this.values.clear() }
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null }
  removeItem(key: string): void { this.values.delete(key) }
  setItem(key: string, value: string): void { this.values.set(key, value) }
}

class FailingAssetStore extends BrowserAssetStore {
  override async put(): Promise<never> {
    throw new Error('synthetic asset write failure')
  }
}

class WriteThenFailAssetStore extends BrowserAssetStore {
  private failOnce = true
  override async put(file: File, assetId?: string) {
    const metadata = await super.put(file, assetId)
    if (this.failOnce) {
      this.failOnce = false
      throw new Error('synthetic process interruption after asset stage')
    }
    return metadata
  }
}

class FailingStateStorage extends MemoryStorage {
  override setItem(key: string, value: string): void {
    if (key === 'memento:app-state:v4') throw new DOMException('Quota exceeded', 'QuotaExceededError')
    super.setItem(key, value)
  }
}

class FailSecondCurrentWriteStorage extends MemoryStorage {
  currentWrites = 0

  override setItem(key: string, value: string): void {
    if (key === 'memento:app-state:v4') {
      this.currentWrites += 1
      if (this.currentWrites > 1) throw new DOMException('synthetic duplicate write failure', 'QuotaExceededError')
    }
    super.setItem(key, value)
  }
}

class MemoryStateBackend implements StateBackend {
  values = new Map<'current' | 'recovery', string>()
  failCurrentWrite = false
  logs: Array<{ id: string; sourceSchema: number; status: string; phase: string }> = []

  async read(id: 'current' | 'recovery'): Promise<string | null> { return this.values.get(id) ?? null }
  async write(id: 'current' | 'recovery', payload: string): Promise<void> {
    if (id === 'current' && this.failCurrentWrite) {
      this.failCurrentWrite = false
      throw new Error('synthetic SQLite current-row commit failure')
    }
    this.values.set(id, payload)
  }
  async remove(id: 'current' | 'recovery'): Promise<void> { this.values.delete(id) }
  async writeMigrationLog(id: string, sourceSchema: number, phase: string, status: string): Promise<void> { this.logs.push({ id, sourceSchema, phase, status }) }
}

describe('v4 AppRepository', () => {
  afterEach(() => {
    disposePhotoObjectUrls()
    vi.unstubAllGlobals()
  })

  it('迁移 v1/v2/v3 旧状态前保留源数据，逐项校验照片后才写入 v4 状态', async () => {
    const fixtures = [{ version: 1, value: localV1 }, { version: 2, value: localV2 }, { version: 3, value: localV3 }]
    for (const { version, value } of fixtures) {
      const storage = new MemoryStorage()
      vi.stubGlobal('localStorage', storage)
      const legacyPayload = JSON.stringify(value)
      storage.setItem('memento:app-state:v2', legacyPayload)
      const assets = new BrowserAssetStore()
      const repository = createAppRepository(storage, assets)

      const loaded = await repository.loadState()
      const persisted = storage.getItem('memento:app-state:v4')
      const persistedValue = JSON.parse(persisted ?? 'null') as Record<string, unknown>

      expect(loaded.schemaVersion).toBe(4)
      expect(loaded.moments[0]?.title).toBe(`合成时刻 v${version}`)
      expect(loaded.photos[0]?.src).toMatch(/^blob:/)
      expect(persistedValue.schemaVersion).toBe(4)
      expect(persistedValue).not.toHaveProperty('photos')
      expect(persisted).not.toContain('data:image')
      expect(storage.getItem('memento:app-state:v2')).toBeNull()
      expect((await assets.list()).map((photo) => photo.id)).toEqual([`fixture-photo-v${version}`])
      expect(storage.getItem('memento:asset-migration-log:v1')).toContain('committed')
      const migrationLog = JSON.parse(storage.getItem('memento:asset-migration-log:v1') ?? '[]') as Array<{ sourceSchema: number }>
      expect(migrationLog.at(-1)?.sourceSchema).toBe(version)
      expect((await repository.restoreRecoverySnapshot())?.schemaVersion).toBe(4)
    }
  })

  it('照片暂存失败时不覆盖旧状态，也不写入半成品 v4 状态', async () => {
    const storage = new MemoryStorage()
    vi.stubGlobal('localStorage', storage)
    const legacyPayload = JSON.stringify(localV3)
    storage.setItem('memento:app-state:v2', legacyPayload)
    const repository = createAppRepository(storage, new FailingAssetStore())

    await expect(repository.loadState()).rejects.toThrow('旧时间册仍然保留')
    expect(storage.getItem('memento:app-state:v2')).toBe(legacyPayload)
    expect(storage.getItem('memento:app-state:v4')).toBeNull()
    expect(storage.getItem('memento:asset-migration-log:v1')).toContain('failed')
  })

  it('照片已暂存但流程中断时保留旧状态，并能幂等续跑迁移', async () => {
    const storage = new MemoryStorage()
    vi.stubGlobal('localStorage', storage)
    const legacyPayload = JSON.stringify(localV3)
    storage.setItem('memento:app-state:v2', legacyPayload)
    const interrupted = createAppRepository(storage, new WriteThenFailAssetStore())

    await expect(interrupted.loadState()).rejects.toThrow('旧时间册仍然保留')
    expect(storage.getItem('memento:app-state:v2')).toBe(legacyPayload)
    expect(storage.getItem('memento:app-state:v4')).toBeNull()

    const resumed = createAppRepository(storage, new BrowserAssetStore())
    const loaded = await resumed.loadState()
    expect(loaded.schemaVersion).toBe(4)
    expect(loaded.moments[0]?.photoIds).toEqual(['fixture-photo-v3'])
    expect(storage.getItem('memento:app-state:v2')).toBeNull()
  })

  it('状态表提交失败时保留 SQLite 旧行和已校验资产，重试后完成 v4 提交', async () => {
    const storage = new MemoryStorage()
    vi.stubGlobal('localStorage', storage)
    const backend = new MemoryStateBackend()
    const legacyPayload = JSON.stringify(localV3)
    backend.values.set('current', legacyPayload)
    backend.failCurrentWrite = true
    const assets = new BrowserAssetStore()
    const repository = createAppRepositoryWithBackend(backend, assets)

    await expect(repository.loadState()).rejects.toThrow('旧时间册仍然保留')
    expect(await backend.read('current')).toBe(legacyPayload)
    expect((await assets.list()).map((asset) => asset.id)).toEqual(['fixture-photo-v3'])
    expect(backend.logs.at(-1)).toMatchObject({ status: 'failed', phase: 'committing_state' })
    expect(JSON.parse((await backend.read('recovery')) ?? 'null')).toMatchObject({ state: { schemaVersion: 4 } })

    const loaded = await repository.loadState()
    expect(loaded.schemaVersion).toBe(4)
    expect(JSON.parse((await backend.read('current')) ?? 'null')).toMatchObject({ schemaVersion: 4 })
  })

  it('迁移与首次保存完整保留固定旧示例 ID 上的用户编辑、照片和恢复快照', async () => {
    const storage = new MemoryStorage()
    vi.stubGlobal('localStorage', storage)
    const legacy = structuredClone(localV3)
    legacy.moments[0] = { ...legacy.moments[0], id: 'moment-watermelon', title: '编辑过的用户记录', photoIds: ['fixture-photo-v3'] }
    const original = JSON.stringify(legacy)
    storage.setItem('memento:app-state:v2', original)
    const assets = new BrowserAssetStore()
    const repository = createAppRepository(storage, assets)

    const loaded = await repository.loadState()
    expect(loaded.moments[0]).toMatchObject({ id: 'moment-watermelon', title: '编辑过的用户记录', photoIds: ['fixture-photo-v3'] })
    expect(loaded.photos.map((photo) => photo.id)).toContain('fixture-photo-v3')
    expect((await repository.restoreRecoverySnapshot())?.moments[0]).toMatchObject({ title: '编辑过的用户记录', photoIds: ['fixture-photo-v3'] })

    expect((await repository.saveState(loaded)).status).toBe('saved')
    expect(await assets.read('fixture-photo-v3')).not.toBeNull()
    expect((await repository.restoreRecoverySnapshot())?.moments[0]?.title).toBe('编辑过的用户记录')
  })

  it('将缺失或损坏照片作为可见运行时问题保留，并阻止普通保存清理相关索引', async () => {
    const storage = new MemoryStorage()
    vi.stubGlobal('localStorage', storage)
    const assets = new BrowserAssetStore()
    const repository = createAppRepository(storage, assets)
    const fileA = new File([Uint8Array.from([1, 2, 3])], 'corrupt.png', { type: 'image/png' })
    const fileB = new File([Uint8Array.from([4, 5, 6])], 'missing.png', { type: 'image/png' })
    const corrupt = await assets.put(fileA, 'corrupt-photo')
    const missing = await assets.put(fileB, 'missing-photo')
    const state = createEmptyState()
    state.moments = [{ id: 'photo-record', kind: 'first', title: '含照片记录', date: '2026-10-15', photoIds: [corrupt.id, missing.id], createdAt: '2026-10-15T00:00:00.000Z', updatedAt: '2026-10-15T00:00:00.000Z' }]
    state.photos = [
      { ...corrupt, src: URL.createObjectURL(fileA) },
      { ...missing, src: URL.createObjectURL(fileB) },
    ]
    expect((await repository.saveState(state)).status).toBe('saved')
    storage.setItem('memento:asset-data:v1:corrupt-photo', btoa(String.fromCharCode(9, 9, 9)))
    storage.removeItem('memento:asset-data:v1:missing-photo')

    const loaded = await repository.loadState()
    expect(loaded.assetIssues?.corruptAssetIds).toContain('corrupt-photo')
    expect(loaded.assetIssues?.missingAssetIds).toContain('missing-photo')
    expect(loaded.photos).toEqual([])
    const result = await repository.saveState({ ...loaded, moments: [] })
    expect(result.status).toBe('recovering')
    expect(storage.getItem('memento:asset-data:v1:corrupt-photo')).not.toBeNull()
    expect((await assets.list()).map((item) => item.id)).toEqual(['corrupt-photo', 'missing-photo'])
  })

  it('状态保存失败会返回失败，不把 localStorage 配额错误显示成成功', async () => {
    const storage = new FailingStateStorage()
    vi.stubGlobal('localStorage', storage)
    const repository = createAppRepository(storage, new BrowserAssetStore())

    const result = await repository.saveState(createEmptyState())
    expect(result.status).toBe('failed')
    expect(result.status === 'failed' && result.message).toContain('Quota exceeded')
    expect(storage.getItem('memento:app-state:v4')).toBeNull()
  })

  it('浏览器仓储只提交一次 localStorage 状态，避免二次镜像失败造成假失败', async () => {
    const storage = new FailSecondCurrentWriteStorage()
    vi.stubGlobal('localStorage', storage)
    const repository = createAppRepository(storage, new BrowserAssetStore())

    expect((await repository.saveState(createEmptyState())).status).toBe('saved')
    expect(storage.currentWrites).toBe(1)
    expect(JSON.parse(storage.getItem('memento:app-state:v4') ?? 'null')).toMatchObject({ schemaVersion: 4 })
  })

  it('照片仍被恢复快照引用时，保存删除操作不会清理文件', async () => {
    const storage = new MemoryStorage()
    vi.stubGlobal('localStorage', storage)
    const assets = new BrowserAssetStore()
    const repository = createAppRepository(storage, assets)
    const file = new File([Uint8Array.from([1, 2, 3])], 'synthetic.png', { type: 'image/png' })
    const photo = await assets.put(file, 'recovery_photo')
    const state = createEmptyState()
    state.moments = [{ id: 'moment-1', kind: 'first', title: '保留照片', date: '2026-10-11', photoIds: [photo.id], createdAt: '2026-10-11T00:00:00.000Z', updatedAt: '2026-10-11T00:00:00.000Z' }]
    state.photos = [{ ...photo, src: URL.createObjectURL(file) }]

    expect((await repository.saveState(state)).status).toBe('saved')
    await repository.createRecoverySnapshot(state)
    const deleted = createEmptyState()
    expect((await repository.saveState(deleted)).status).toBe('saved')
    expect(await assets.read(photo.id)).not.toBeNull()
    expect((await repository.restoreRecoverySnapshot())?.moments[0]?.photoIds).toEqual([photo.id])
  })
})
