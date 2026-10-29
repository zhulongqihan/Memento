import type { ElapsedBreakdown, ElapsedDisplayMode, NumberFormat, RemainingCounter, RemainingDate, RemainingUnit } from './types'

const WEEKDAY_LABELS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
const MONTH_LABELS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

export const CALENDAR_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const

export interface RemainingDisplay {
  isCalendarDays: boolean
  status: 'future' | 'today' | 'past'
  /** Natural dates use elapsed days after the target; weekday counters stay at zero. */
  value: number
  unit: string
  label: string
  dateLabel: '日期' | '截止日期'
  scopeLabel: string
  /** Matching weekdays only. Natural dates never enumerate intermediate days. */
  dates: RemainingDate[]
}

export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

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
  const totalDays = differenceInCalendarDays(start, end)
  return Math.min(100, Math.max(0, differenceInCalendarDays(start, value) / (totalDays - 1) * 100))
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

export function getElapsedDisplay(breakdown: ElapsedBreakdown, mode: ElapsedDisplayMode): { value: number; unit: string } {
  const labels: Record<ElapsedDisplayMode, string> = { days: '天', weeks: '周', months: '个月', years: '年' }
  return { value: breakdown[mode], unit: labels[mode] }
}

function matchesUnit(date: Date, unit: RemainingUnit, customWeekdays: number[]): boolean {
  if (unit === 'friday') return date.getDay() === 5
  if (unit === 'saturday') return date.getDay() === 6
  if (unit === 'sunday') return date.getDay() === 0
  if (unit === 'custom') return customWeekdays.includes(date.getDay())
  return date.getDay() === 0 || date.getDay() === 6
}

export function getRemainingDates(end: string, unit: RemainingUnit, from = todayIso(), customWeekdays: number[] = []): RemainingDate[] {
  const dates: RemainingDate[] = []
  const totalDays = differenceInCalendarDays(from, end)
  if (totalDays <= 0) return dates

  for (let offset = 1; offset <= totalDays; offset += 1) {
    const value = shiftIsoDate(from, offset)
    if (matchesUnit(parseIsoDate(value), unit, customWeekdays)) {
      dates.push({ date: value, label: `${getMonthLabel(value)} ${parseIsoDate(value).getDate()}` })
    }
  }
  return dates
}

export function isCalendarDayCounter(item: Pick<RemainingCounter, 'unit' | 'weekdays'>): boolean {
  return item.unit === 'custom' && CALENDAR_WEEKDAYS.every((day) => item.weekdays?.includes(day))
}

export function getRemainingDisplay(item: Pick<RemainingCounter, 'endDate' | 'unit' | 'weekdays'>, from = todayIso(), numberFormat: NumberFormat = 'plain'): RemainingDisplay {
  const delta = differenceInCalendarDays(from, item.endDate)
  const status = delta > 0 ? 'future' : delta === 0 ? 'today' : 'past'
  if (isCalendarDayCounter(item)) {
    const value = Math.abs(delta)
    return {
      isCalendarDays: true,
      status,
      value,
      unit: '天',
      label: status === 'today' ? '今天' : `${status === 'future' ? '还有' : '已过'} ${formatDisplayNumber(value, numberFormat)} 天`,
      dateLabel: '日期',
      scopeLabel: '按日历日期计算。',
      dates: [],
    }
  }

  const dates = getRemainingDates(item.endDate, item.unit, from, item.weekdays)
  const unit = formatCounterUnit(item.unit)
  const selectedDays = item.unit === 'custom'
    ? [1, 2, 3, 4, 5, 6, 0].filter((day) => item.weekdays?.includes(day)).map((day) => WEEKDAY_LABELS[day].replace('星期', '周')).join('、')
    : ''
  const weekdayRule = item.unit === 'weekend'
    ? '周六、周日分别计数；从明天起，包含截止日。'
    : item.unit === 'custom'
      ? selectedDays ? `统计${selectedDays}；从明天起，包含截止日。` : '尚未选择计入的星期。'
      : '从明天起计数，包含截止日。'
  return {
    isCalendarDays: false,
    status,
    value: dates.length,
    unit,
    label: status === 'today' ? '今天截止' : status === 'past' ? '已过截止日期' : dates.length ? `还有 ${formatDisplayNumber(dates.length, numberFormat)} ${unit}` : '截止前没有符合的日期',
    dateLabel: '截止日期',
    scopeLabel: status === 'past' ? '截止日期已过，不再计入新的日子。' : status === 'today' ? '今天是截止日；计数不包含今天。' : weekdayRule,
    dates,
  }
}

export function getStageProgress(start: string, end: string, value = todayIso()): number {
  const total = differenceInCalendarDays(start, end)
  if (total <= 0) return value >= end ? 100 : 0
  return Math.min(100, Math.max(0, differenceInCalendarDays(start, value) / total * 100))
}

export function getLifeEndDate(birthDate: string, lifeExpectancyYears: number): string {
  const date = parseIsoDate(birthDate)
  const originalMonth = date.getMonth()
  const originalDay = date.getDate()
  date.setFullYear(date.getFullYear() + Math.max(1, lifeExpectancyYears))
  if (originalMonth === 1 && originalDay === 29 && date.getMonth() === 2) {
    date.setMonth(1, 28)
  }
  return toIsoDate(date)
}

export function getLifeProgress(birthDate: string, lifeExpectancyYears: number, value = todayIso()): number {
  return getStageProgress(birthDate, getLifeEndDate(birthDate, lifeExpectancyYears), value)
}

export function formatDisplayNumber(value: number, format: NumberFormat = 'plain'): string {
  return format === 'grouped' ? new Intl.NumberFormat('en-US').format(value) : String(value)
}

export function formatCounterUnit(unit: RemainingUnit): string {
  return { friday: '个周五', saturday: '个周六', sunday: '个周日', weekend: '个周末日', custom: '个选定日' }[unit]
}

export function formatRelative(value: string, reference = todayIso()): string {
  const days = differenceInCalendarDays(reference, value)
  if (days === 0) return '今天'
  if (days > 0) return `${days} 天后`
  return `${Math.abs(days)} 天前`
}
