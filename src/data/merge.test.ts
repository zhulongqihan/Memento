import { describe, expect, it } from 'vitest'
import { createSeedState } from './seed'
import { mergeState } from './merge'

describe('备份合并', () => {
  it('保留本地和备份中的不同记录', () => {
    const current = createSeedState()
    const incoming = createSeedState()
    incoming.moments[0] = { ...incoming.moments[0], id: 'imported-moment', title: '另一台电脑上的时刻', updatedAt: '2027-01-01T00:00:00.000Z' }
    const merged = mergeState(current, incoming)
    expect(merged.moments.some((moment) => moment.id === 'imported-moment')).toBe(true)
    expect(merged.moments.some((moment) => moment.id === 'moment-watermelon')).toBe(true)
  })

  it('相同 ID 只接受更新的记录', () => {
    const current = createSeedState()
    const incoming = createSeedState()
    incoming.moments[0] = { ...incoming.moments[0], title: '新的标题', updatedAt: '2027-01-01T00:00:00.000Z' }
    const merged = mergeState(current, incoming)
    expect(merged.moments.find((moment) => moment.id === 'moment-watermelon')?.title).toBe('新的标题')
  })
})

