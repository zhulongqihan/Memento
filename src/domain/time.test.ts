import { describe, expect, it } from 'vitest'
import {
  differenceInCalendarDays,
  getElapsedBreakdown,
  getElapsedDisplay,
  getLifeEndDate,
  getLifeProgress,
  formatDisplayNumber,
  getRemainingDates,
  getStageProgress,
  getYearProgress,
} from './time'

describe('几度时间计算', () => {
  it('按本地日期计算，不受时间部分影响', () => {
    expect(differenceInCalendarDays('2026-08-01', '2026-08-22')).toBe(21)
  })

  it('支持闰年的年度进度', () => {
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

  it('阶段进度在范围外时被限制', () => {
    expect(getStageProgress('2026-01-01', '2026-12-31', '2025-12-31')).toBe(0)
    expect(getStageProgress('2026-01-01', '2026-12-31', '2027-01-01')).toBe(100)
  })

  it('人生进度按生日和预期年限计算，并处理闰日生日', () => {
    expect(getLifeEndDate('2000-02-29', 80)).toBe('2080-02-29')
    expect(getLifeProgress('2000-01-01', 100, '2050-01-01')).toBeCloseTo(50, 1)
  })

  it('数字显示偏好只改变展示，不改变数值', () => {
    expect(formatDisplayNumber(1234567, 'plain')).toBe('1234567')
    expect(formatDisplayNumber(1234567, 'grouped')).toBe('1,234,567')
  })
})
