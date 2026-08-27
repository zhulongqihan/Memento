import { describe, expect, it } from 'vitest'
import { createSeedState } from '../data/seed'
import { normalizeVisualNarrative, pickPinned, updateVisualNarrative } from './preferences'

describe('置顶展示选择', () => {
  const items = [{ id: 'first', title: '第一段' }, { id: 'second', title: '第二段' }]

  it('优先展示有效的置顶项', () => {
    expect(pickPinned(items, 'second')?.id).toBe('second')
  })

  it('置顶项被删除后回退到第一项', () => {
    expect(pickPinned(items, 'missing')?.id).toBe('first')
    expect(pickPinned([], 'missing')).toBeUndefined()
  })

  it('未知叙事回退到典藏，切换叙事不改变记录与照片', () => {
    const state = createSeedState()
    const next = updateVisualNarrative(state, 'instrument')

    expect(normalizeVisualNarrative('unknown')).toBe('archive')
    expect(normalizeVisualNarrative('light')).toBe('light')
    expect(next.settings.visualNarrative).toBe('instrument')
    expect(next.moments).toEqual(state.moments)
    expect(next.photos).toEqual(state.photos)
    expect(next.elapsed).toEqual(state.elapsed)
    expect(next.remaining).toEqual(state.remaining)
    expect(next.stages).toEqual(state.stages)
  })
})
