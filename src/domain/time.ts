import type { ElapsedBreakdown, RemainingDate, RemainingUnit } from './types'

const WEEKDAY_LABELS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
const MONTH_LABELS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function toIsoDate(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayIso(): string {
  return toIsoDate(new Date())
}

export function shiftIsoDate(value: string, days: number): string {
  const date = parseIsoDate(value)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

export function differenceInCalendarDays(start: string, end: string): number {
  const startDate = parseIsoDate(start)
  const endDate = parseIsoDate(end)
  return Math.round((endDate.getTime() - startDate.getTime()) / 86400000)
}

export function formatDate(value: string, style: 'short' | 'long' = 'long'): string {
  const date = parseIsoDate(value)
  if (style === 'short') {
    return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, '0')}`
  }
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`
}

export function formatDateWithWeekday(value: string): string {
  const date = parseIsoDate(value)
  return `${formatDate(value)} · ${WEEKDAY_LABELS[date.getDay()]}`
}

export function getMonthLabel(value: string): string {
  return MONTH_LABELS[parseIsoDate(value).getMonth()]
}

export function getWeekdayLabel(value: string): string {
  return WEEKDAY_LABELS[parseIsoDate(value).getDay()]
}

export function getYearProgress(value = todayIso()): number {
  const date = parseIsoDate(value)
  const year = date.getFullYear()
  const start = `${year}-01-01`
  const end = `${year + 1}-01-01`
  return Math.min(100, Math.max(0, (differenceInCalendarDays(start, value) + 1) / differenceInCalendarDays(start, end) * 100))
}

export function getDaysRemainingInYear(value = todayIso()): number {
  const date = parseIsoDate(value)
  const end = `${date.getFullYear()}-12-31`
  return differenceInCalendarDays(value, end)
}

export function getElapsedBreakdown(start: string, end = todayIso()): ElapsedBreakdown {
  const days = Math.max(0, differenceInCalendarDays(start, end))
  const years = Math.floor(days / 365)
  const months = Math.floor(days / 30.4375)
  return { days, weeks: Math.floor(days / 7), months, years }
}

function matchesUnit(date: Date, unit: RemainingUnit): boolean {
  if (unit === 'friday') return date.getDay() === 5
  if (unit === 'saturday') return date.getDay() === 6
  if (unit === 'sunday') return date.getDay() === 0
  return date.getDay() === 6
}

export function getRemainingDates(end: string, unit: RemainingUnit, from = todayIso()): RemainingDate[] {
  const dates: RemainingDate[] = []
  const totalDays = differenceInCalendarDays(from, end)
  if (totalDays <= 0) return dates

  const maxDays = Math.min(totalDays, 3660)
  for (let offset = 1; offset <= maxDays; offset += 1) {
    const value = shiftIsoDate(from, offset)
    if (matchesUnit(parseIsoDate(value), unit)) {
      dates.push({ date: value, label: `${getMonthLabel(value)} ${parseIsoDate(value).getDate()}` })
    }
  }
  return dates
}

export function getStageProgress(start: string, end: string, value = todayIso()): number {
  const total = differenceInCalendarDays(start, end)
  if (total <= 0) return value >= end ? 100 : 0
  return Math.min(100, Math.max(0, differenceInCalendarDays(start, value) / total * 100))
}

export function formatCounterUnit(unit: RemainingUnit): string {
  return { friday: '个周五', saturday: '个周六', sunday: '个周日', weekend: '个周末' }[unit]
}

export function formatRelative(value: string, reference = todayIso()): string {
  const days = differenceInCalendarDays(reference, value)
  if (days === 0) return '今天'
  if (days > 0) return `${days} 天后`
  return `${Math.abs(days)} 天前`
}
