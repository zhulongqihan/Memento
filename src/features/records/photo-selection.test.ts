import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrowserAssetStore } from '../../data/asset-store'
import { createAppRepository, disposePhotoObjectUrls } from '../../data/repository'
import { createEmptyState } from '../../data/seed'
import { resolveMomentPhotoIds } from './photo-selection'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

describe('编辑记录的完整照片引用', () => {
  afterEach(() => { disposePhotoObjectUrls(); vi.unstubAllGlobals() })

  it.each(['healthy', 'missing', 'corrupt'] as const)('%s 照片的文字编辑保存后仍可关联原资产', async (condition) => {
    const storage = new MemoryStorage()
    vi.stubGlobal('localStorage', storage)
    const assets = new BrowserAssetStore()
    const repository = createAppRepository(storage, assets)
    const id = `photo-${condition}`
    await assets.put(new File([new Uint8Array([1, 2, 3])], 'photo.png', { type: 'image/png' }), id)
    const state = createEmptyState()
    state.moments = [{ id: 'moment', kind: 'first', title: '原名', date: '2026-10-23', photoIds: [id], createdAt: '2026-10-23T00:00:00Z', updatedAt: '2026-10-23T00:00:00Z' }]
    await repository.saveState(state)
    if (condition === 'missing') storage.removeItem(`memento:asset-data:v1:${id}`)
    if (condition === 'corrupt') storage.setItem(`memento:asset-data:v1:${id}`, btoa('bad'))
    const loaded = await repository.loadState()
    const existing = loaded.moments[0]
    const photoIds = resolveMomentPhotoIds(existing.photoIds, loaded.photos, [])
    const result = await repository.saveState({ ...loaded, moments: [{ ...existing, title: '文字已修改', photoIds }] })
    expect(result.status).not.toBe('failed')
    expect((await repository.loadState()).moments[0].photoIds).toEqual([id])
  })

  it('仅主动移除的原引用消失，新照片追加且不重复', () => {
    expect(resolveMomentPhotoIds(['unreadable', 'healthy'], [{ id: 'healthy' }, { id: 'new' }], ['unreadable']))
      .toEqual(['healthy', 'new'])
    expect(resolveMomentPhotoIds(['unreadable'], [], [])).toEqual(['unreadable'])
    expect(resolveMomentPhotoIds(['healthy'], [], ['healthy'])).toEqual([])
  })
})
