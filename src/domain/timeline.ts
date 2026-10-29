import type { Moment, TimelineFilter } from './types'

function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').toLowerCase()
}

export function selectTimelineMoments(
  records: readonly Moment[],
  { filter, currentYear, query = '' }: { filter: TimelineFilter; currentYear: string; query?: string },
): Moment[] {
  const terms = normalizeSearchText(query).trim().split(/\s+/u).filter(Boolean)
  return records.filter((record) => {
    const matchesFilter = filter === 'all' || (filter === 'this_year' ? record.date.slice(0, 4) === currentYear : record.kind === filter)
    if (!matchesFilter) return false
    if (!terms.length) return true
    const text = normalizeSearchText([record.title, record.note ?? '', record.location ?? ''].join('\n'))
    return terms.every((term) => text.includes(term))
  }).sort((a, b) => b.date.localeCompare(a.date))
}

/** Both reading views enter at the first/last record when the container has focus. */
export function getTimelineKeyboardTarget(length: number, activeIndex: number, key: string): number | undefined {
  if (!length) return undefined
  if (key === 'Home') return 0
  if (key === 'End') return length - 1
  const direction = key === 'ArrowDown' || key === 'ArrowRight' ? 1 : key === 'ArrowUp' || key === 'ArrowLeft' ? -1 : 0
  if (!direction) return undefined
  const current = activeIndex >= 0 && activeIndex < length ? activeIndex : direction === 1 ? -1 : length
  return Math.max(0, Math.min(length - 1, current + direction))
}
