import { describe, expect, it } from 'vitest'
import { createEmptyState, createSeedState, removeDemoData } from './seed'

describe('初始数据与旧记录保留', () => {
  it('新时间册从空白状态开始，不创建模拟记录', () => {
    const state = createEmptyState()

    expect(state.moments).toEqual([])
    expect(state.elapsed).toEqual([])
    expect(state.remaining).toEqual([])
    expect(state.stages).toEqual([])
    expect(state.settings.pinnedMomentId).toBeUndefined()
  })

  it('不会按固定示例 ID 删除用户编辑过的记录、照片或置顶设置', () => {
    const state = createSeedState()
    state.moments[0] = { ...state.moments[0], title: '我编辑过的西瓜记录', photoIds: ['demo-photo'] }
    state.photos = [
      { id: 'demo-photo', name: 'demo.png', mimeType: 'image/png', sizeBytes: 1, sha256: 'a'.repeat(64), createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', src: 'blob:demo-photo' },
    ]

    const cleaned = removeDemoData(state)

    expect(cleaned).toBe(state)
    expect(cleaned.moments[0]?.title).toBe('我编辑过的西瓜记录')
    expect(cleaned.photos.map((photo) => photo.id)).toEqual(['demo-photo'])
    expect(cleaned.settings.pinnedMomentId).toBe('moment-watermelon')
  })
})
