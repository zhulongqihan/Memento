import { describe, expect, it } from 'vitest'
import { createEmptyState, createSeedState, removeDemoData } from './seed'

describe('初始数据与示例数据清理', () => {
  it('新时间册从空白状态开始，不创建模拟记录', () => {
    const state = createEmptyState()

    expect(state.moments).toEqual([])
    expect(state.elapsed).toEqual([])
    expect(state.remaining).toEqual([])
    expect(state.stages).toEqual([])
    expect(state.settings.pinnedMomentId).toBeUndefined()
  })

  it('只移除旧示例记录，保留用户后来填写的记录和照片', () => {
    const state = createSeedState()
    const realMoment = { ...state.moments[0], id: 'real-moment', title: '我的真实记录', photoIds: ['real-photo'] }
    state.moments.push(realMoment)
    state.moments[0] = { ...state.moments[0], photoIds: ['demo-photo'] }
    state.photos = [
      { id: 'demo-photo', dataUrl: 'data:image/png;base64,ZA==', name: 'demo.png', mimeType: 'image/png' },
      { id: 'real-photo', dataUrl: 'data:image/png;base64,ZA==', name: 'real.png', mimeType: 'image/png' },
    ]

    const cleaned = removeDemoData(state)

    expect(cleaned.moments.map((item) => item.id)).toEqual(['real-moment'])
    expect(cleaned.elapsed).toEqual([])
    expect(cleaned.remaining).toEqual([])
    expect(cleaned.stages).toEqual([])
    expect(cleaned.photos.map((photo) => photo.id)).toEqual(['real-photo'])
    expect(cleaned.settings.pinnedMomentId).toBeUndefined()
    expect(cleaned.settings.pinnedElapsedId).toBeUndefined()
    expect(cleaned.settings.pinnedRemainingId).toBeUndefined()
  })
})
