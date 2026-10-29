import { describe, expect, it } from 'vitest'
import { getTimelineKeyboardTarget, selectTimelineMoments } from './timeline'
import type { Moment } from './types'

const records: readonly Moment[] = Object.freeze([
  Object.freeze({ id: 'older', title: '第一次出发', kind: 'first', date: '2025-08-12', note: '坐上晚班列车', location: '南京', photoIds: [], createdAt: '2025-08-12T08:00:00Z', updatedAt: '2025-08-12T08:00:00Z' } as Moment),
  Object.freeze({ id: 'conversation', title: '秋天的谈话', kind: 'milestone', date: '2026-09-18', note: '和 HR 聊了新的方向', location: '上海', photoIds: [], createdAt: '2026-09-18T08:00:00Z', updatedAt: '2026-09-18T08:00:00Z' } as Moment),
  Object.freeze({ id: 'latest', title: '重回南京', kind: 'yearly_first', date: '2026-10-22', note: '在车站见到老朋友', photoIds: [], createdAt: '2026-10-22T08:00:00Z', updatedAt: '2026-10-22T08:00:00Z' } as Moment),
])

describe('时光查找', () => {
  it('在标题、笔记、地点中查找，并按发生日期排序', () => {
    expect(selectTimelineMoments(records, { filter: 'all', currentYear: '2026', query: '南京' }).map((item) => item.id)).toEqual(['latest', 'older'])
    expect(selectTimelineMoments(records, { filter: 'all', currentYear: '2026', query: '  ＨＲ　上海 ' }).map((item) => item.id)).toEqual(['conversation'])
  })

  it('关键词与年份、类别筛选一起生效，清空关键词能回到当前分类', () => {
    expect(selectTimelineMoments(records, { filter: 'this_year', currentYear: '2026', query: '南京' }).map((item) => item.id)).toEqual(['latest'])
    expect(selectTimelineMoments(records, { filter: 'first', currentYear: '2026', query: '南京' }).map((item) => item.id)).toEqual(['older'])
    expect(selectTimelineMoments(records, { filter: 'milestone', currentYear: '2026', query: '不存在' })).toEqual([])
    expect(selectTimelineMoments(records, { filter: 'milestone', currentYear: '2026', query: '  ' }).map((item) => item.id)).toEqual(['conversation'])
  })

  it('查找与排序不改动原始记录及顺序', () => {
    const before = JSON.stringify(records)
    expect(selectTimelineMoments(records, { filter: 'all', currentYear: '2026' }).map((item) => item.id)).toEqual(['latest', 'conversation', 'older'])
    expect(JSON.stringify(records)).toBe(before)
  })
})

describe('时光键盘定位', () => {
  it('从容器按向下进入首条，向上进入末条，两种视图共用边界', () => {
    expect(getTimelineKeyboardTarget(83, -1, 'ArrowDown')).toBe(0)
    expect(getTimelineKeyboardTarget(83, -1, 'ArrowRight')).toBe(0)
    expect(getTimelineKeyboardTarget(83, -1, 'ArrowUp')).toBe(82)
    expect(getTimelineKeyboardTarget(83, -1, 'ArrowLeft')).toBe(82)
  })

  it('首尾导航和空结果不会越界，输入等其他按键不被接管', () => {
    expect(getTimelineKeyboardTarget(83, 42, 'Home')).toBe(0)
    expect(getTimelineKeyboardTarget(83, 42, 'End')).toBe(82)
    expect(getTimelineKeyboardTarget(83, 82, 'ArrowDown')).toBe(82)
    expect(getTimelineKeyboardTarget(83, 0, 'ArrowUp')).toBe(0)
    expect(getTimelineKeyboardTarget(0, -1, 'End')).toBeUndefined()
    expect(getTimelineKeyboardTarget(83, 0, 'Enter')).toBeUndefined()
  })
})
