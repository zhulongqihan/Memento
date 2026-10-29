import { describe, expect, it } from 'vitest'
import {
  differenceInCalendarDays,
  getElapsedBreakdown,
  getElapsedDisplay,
  getLifeEndDate,
  getLifeProgress,
  formatDisplayNumber,
  CALENDAR_WEEKDAYS,
  getRemainingDisplay,
  getRemainingDates,
  getStageProgress,
  getYearProgress,
  isValidIsoDate,
  isCalendarDayCounter,
} from './time'

describe('几度时间计算', () => {
  it('按本地日期计算，不受时间部分影响', () => {
    expect(differenceInCalendarDays('2026-08-01', '2026-08-22')).toBe(21)
  })

  it('拒绝不存在的日历日期，避免坏数据进入时间计算', () => {
    expect(isValidIsoDate('2026-02-28')).toBe(true)
    expect(isValidIsoDate('2026-02-29')).toBe(false)
    expect(isValidIsoDate('')).toBe(false)
  })

  it('支持闰年的年度进度', () => {
    expect(getYearProgress('2026-01-01')).toBe(0)
    expect(getYearProgress('2024-12-31')).toBe(100)
    expect(getYearProgress('2026-12-31')).toBe(100)
  })

  it('经年在起始日为 0 天', () => {
    expect(getElapsedBreakdown('2026-08-22', '2026-08-22')).toEqual({ days: 0, weeks: 0, months: 0, years: 0 })
    expect(getElapsedBreakdown('2025-09-29', '2026-08-22').days).toBe(327)
  })

  it('经年显示模式使用同一份边界安全的拆解结果', () => {
    const breakdown = getElapsedBreakdown('2025-09-29', '2026-08-22')
    expect(getElapsedDisplay(breakdown, 'days')).toEqual({ value: 327, unit: '天' })
    expect(getElapsedDisplay(breakdown, 'weeks')).toEqual({ value: 46, unit: '周' })
    expect(getElapsedDisplay(breakdown, 'years')).toEqual({ value: 0, unit: '年' })
  })

  it('余下只统计今天之后且不晚于截止日期的目标星期', () => {
    const dates = getRemainingDates('2026-09-30', 'friday', '2026-08-22')
    expect(dates.map((item) => item.date)).toEqual(['2026-08-28', '2026-09-04', '2026-09-11', '2026-09-18', '2026-09-25'])
  })

  it('今天是截止日期时没有余下日期', () => {
    expect(getRemainingDates('2026-08-22', 'friday', '2026-08-22')).toEqual([])
  })

  it('周末同时包含周六和周日，并且不超过截止日期', () => {
    expect(getRemainingDates('2026-09-01', 'weekend', '2026-08-22').map((item) => item.date)).toEqual(['2026-08-23', '2026-08-29', '2026-08-30'])
  })

  it('截止日当天是目标星期时仍然计入', () => {
    expect(getRemainingDates('2026-08-23', 'sunday', '2026-08-22').map((item) => item.date)).toEqual(['2026-08-23'])
  })

  it('自定义星期只计算用户选择的星期', () => {
    expect(getRemainingDates('2026-09-01', 'custom', '2026-08-22', [1, 3]).map((item) => item.date)).toEqual(['2026-08-24', '2026-08-26', '2026-08-31'])
    expect(getRemainingDates('2026-09-01', 'custom', '2026-08-22', []).length).toBe(0)
  })

  it('远期截止日期不会被十年硬上限截断', () => {
    const dates = getRemainingDates('2037-08-22', 'saturday', '2026-08-22')
    expect(dates[dates.length - 1]?.date).toBe('2037-08-22')
  })

  it('旧自定义全星期数据直接显示自然日，未来、当天、过去各有明确含义', () => {
    const item = { endDate: '2026-10-31', unit: 'custom' as const, weekdays: [...CALENDAR_WEEKDAYS] }
    expect(getRemainingDisplay(item, '2026-10-29')).toMatchObject({ isCalendarDays: true, status: 'future', value: 2, unit: '天', label: '还有 2 天', dateLabel: '日期', dates: [] })
    expect(getRemainingDisplay(item, '2026-10-31')).toMatchObject({ status: 'today', value: 0, label: '今天', dates: [] })
    expect(getRemainingDisplay(item, '2026-11-02')).toMatchObject({ status: 'past', value: 2, label: '已过 2 天', dates: [] })
  })

  it('自然日判断不依赖星期顺序或重复值，也不改写旧数组', () => {
    const weekdays = [6, 2, 0, 5, 3, 1, 4, 4]
    const original = [...weekdays]
    expect(isCalendarDayCounter({ unit: 'custom', weekdays })).toBe(true)
    expect(getRemainingDisplay({ endDate: '2026-11-01', unit: 'custom', weekdays }, '2026-10-30').value).toBe(2)
    expect(weekdays).toEqual(original)
    expect(isCalendarDayCounter({ unit: 'custom', weekdays: [0, 1, 2, 3, 4, 5, 5] })).toBe(false)
    expect(isCalendarDayCounter({ unit: 'custom' })).toBe(false)
    expect(isCalendarDayCounter({ unit: 'friday', weekdays: [...CALENDAR_WEEKDAYS] })).toBe(false)
  })

  it('自然日计数跨闰日和跨年仍按日期差显示', () => {
    const item = { unit: 'custom' as const, weekdays: [...CALENDAR_WEEKDAYS] }
    expect(getRemainingDisplay({ ...item, endDate: '2028-03-01' }, '2028-02-28').value).toBe(2)
    expect(getRemainingDisplay({ ...item, endDate: '2027-01-01' }, '2026-12-31').label).toBe('还有 1 天')
  })

  it('余下摘要沿用数字分组偏好，计算值保持数值', () => {
    const item = { endDate: '2030-01-01', unit: 'custom' as const, weekdays: [...CALENDAR_WEEKDAYS] }
    expect(getRemainingDisplay(item, '2026-01-01', 'grouped')).toMatchObject({ value: 1461, label: '还有 1,461 天' })
    expect(getRemainingDisplay(item, '2026-01-01').label).toBe('还有 1461 天')
  })

  it('周期计数不把未来没有匹配日误报为已经到期', () => {
    const item = { endDate: '2026-11-01', unit: 'friday' as const }
    const display = getRemainingDisplay(item, '2026-10-30')
    expect(display).toMatchObject({ isCalendarDays: false, status: 'future', value: 0, label: '截止前没有符合的日期', dateLabel: '截止日期', dates: [] })
    expect(getRemainingDisplay(item, '2026-11-01')).toMatchObject({ status: 'today', value: 0, label: '今天截止', scopeLabel: '今天是截止日；计数不包含今天。' })
    expect(getRemainingDisplay(item, '2026-11-02')).toMatchObject({ status: 'past', value: 0, label: '已过截止日期', scopeLabel: '截止日期已过，不再计入新的日子。' })
  })

  it('周期显示仍排除今天、包含截止日，并明确周末按两天分别计数', () => {
    const friday = getRemainingDisplay({ endDate: '2026-11-06', unit: 'friday' }, '2026-10-30')
    expect(friday.value).toBe(1)
    expect(friday.dates.map((item) => item.date)).toEqual(['2026-11-06'])
    expect(friday.scopeLabel).toBe('从明天起计数，包含截止日。')
    const weekend = getRemainingDisplay({ endDate: '2026-11-01', unit: 'weekend' }, '2026-10-31')
    expect(weekend).toMatchObject({ value: 1, unit: '个周末日', label: '还有 1 个周末日' })
    expect(weekend.dates.map((item) => item.date)).toEqual(['2026-11-01'])
    expect(weekend.scopeLabel).toContain('周六、周日分别计数')
  })

  it('部分自定义星期只列选定日，空选择保留可理解的零结果', () => {
    const display = getRemainingDisplay({ endDate: '2026-11-05', unit: 'custom', weekdays: [3, 1, 3] }, '2026-10-30')
    expect(display).toMatchObject({ isCalendarDays: false, value: 2, unit: '个选定日', scopeLabel: '统计周一、周三；从明天起，包含截止日。' })
    expect(display.dates.map((item) => item.date)).toEqual(['2026-11-02', '2026-11-04'])
    expect(getRemainingDisplay({ endDate: '2026-11-05', unit: 'custom' }, '2026-10-30')).toMatchObject({ status: 'future', value: 0, label: '截止前没有符合的日期', scopeLabel: '尚未选择计入的星期。' })
  })

  it('阶段进度在范围外时被限制', () => {
    expect(getStageProgress('2026-01-01', '2026-12-31', '2025-12-31')).toBe(0)
    expect(getStageProgress('2026-01-01', '2026-12-31', '2027-01-01')).toBe(100)
  })

  it('人生进度按生日和预期年限计算，并处理闰日生日', () => {
    expect(getLifeEndDate('2000-02-29', 80)).toBe('2080-02-29')
    expect(getLifeEndDate('2000-02-29', 1)).toBe('2001-02-28')
    expect(getLifeProgress('2000-01-01', 100, '2050-01-01')).toBeCloseTo(50, 1)
  })

  it('数字显示偏好只改变展示，不改变数值', () => {
    expect(formatDisplayNumber(1234567, 'plain')).toBe('1234567')
    expect(formatDisplayNumber(1234567, 'grouped')).toBe('1,234,567')
  })
})
