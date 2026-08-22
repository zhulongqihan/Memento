import { describe, expect, it } from 'vitest'
import { pickPinned } from './preferences'

describe('置顶展示选择', () => {
  const items = [{ id: 'first', title: '第一段' }, { id: 'second', title: '第二段' }]

  it('优先展示有效的置顶项', () => {
    expect(pickPinned(items, 'second')?.id).toBe('second')
  })

  it('置顶项被删除后回退到第一项', () => {
    expect(pickPinned(items, 'missing')?.id).toBe('first')
    expect(pickPinned([], 'missing')).toBeUndefined()
  })
})
