import { describe, expect, it } from 'vitest'
import { chooseUnreadCopy, COPY_LIBRARY, getDailyEntry, getNarrationSnapshot, getTodayNarrationUse } from './narration'
import { createEmptyState } from '../data/seed'

describe('本地旁白库', () => {
  it('包含 1000 条唯一原文，外文条目都有中文译文', () => {
    expect(COPY_LIBRARY).toHaveLength(1000)
    expect(new Set(COPY_LIBRARY.map((item) => item.original)).size).toBe(1000)
    expect(COPY_LIBRARY.filter((item) => item.language !== 'zh').every((item) => Boolean(item.translationZh))).toBe(true)
  })

  it('只从未展示过的条目中选择旁白，并在用尽后停止', () => {
    const state = createEmptyState()
    const first = chooseUnreadCopy(state, 0)
    expect(first?.id).toBe(COPY_LIBRARY[0].id)
    state.narrationUses = COPY_LIBRARY.map((copy, index) => ({ id: `use-${index}`, quoteId: copy.id, date: '2026-08-27', displayedAt: new Date().toISOString(), saved: false }))
    expect(chooseUnreadCopy(state)).toBeUndefined()
  })

  it('能按本地日期读取每日一行和当前旁白快照', () => {
    const state = createEmptyState()
    state.dailyEntries = [{ id: 'daily-1', date: '2026-08-27', text: '今天留下一行。', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]
    state.narrationUses = [{ id: 'use-1', quoteId: COPY_LIBRARY[0].id, date: '2026-08-27', displayedAt: new Date().toISOString(), saved: false }]
    expect(getDailyEntry(state, '2026-08-27')?.text).toBe('今天留下一行。')
    expect(getTodayNarrationUse(state, '2026-08-27')?.quoteId).toBe(COPY_LIBRARY[0].id)
    expect(getNarrationSnapshot(state, state.narrationUses[0])?.original).toBe(COPY_LIBRARY[0].original)
  })
})
