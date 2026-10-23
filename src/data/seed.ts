import type { AppState } from '../domain/types'
import { shiftIsoDate, todayIso } from '../domain/time'

const now = new Date().toISOString()

const DEFAULT_SETTINGS = {
  displayName: '我的时间册',
  displayLifeProgress: false,
  lifeExpectancyYears: 80,
  timelineFilter: 'all' as const,
  elapsedDisplayMode: 'days' as const,
  elapsedSort: 'recent' as const,
  theme: 'light' as const,
  displayDensity: 'comfortable' as const,
  numberFormat: 'plain' as const,
  visualNarrative: 'archive' as const,
  dailyNarrationEnabled: true,
}

export function createEmptyState(): AppState {
  return {
    schemaVersion: 4,
    settings: { ...DEFAULT_SETTINGS },
    photos: [],
    moments: [],
    elapsed: [],
    remaining: [],
    stages: [],
    dailyEntries: [],
    narrationUses: [],
    savedNarrations: [],
  }
}

export function removeDemoData(state: AppState): AppState {
  // Historic records have no durable provenance marker. A fixed ID cannot
  // distinguish an untouched seed from a user's edit or an imported record.
  // Preserve all of them; cleanup must be an explicit user action.
  return state
}

export function createSeedState(): AppState {
  const today = todayIso()
  const year = today.slice(0, 4)
  return {
    schemaVersion: 4,
    settings: {
      ...DEFAULT_SETTINGS,
      pinnedMomentId: 'moment-watermelon',
      pinnedElapsedId: 'elapsed-city',
      pinnedRemainingId: 'remaining-graduation',
    },
    photos: [],
    moments: [
      {
        id: 'moment-watermelon',
        kind: 'yearly_first',
        title: '今年第一次吃西瓜',
        date: shiftIsoDate(today, -42),
        note: '有些日子后来才知道，值得记住。',
        photoIds: [],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'moment-travel',
        kind: 'first',
        title: '第一次一个人旅行',
        date: shiftIsoDate(today, -180),
        location: '北海道',
        note: '那天下午天气很好。',
        photoIds: [],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'moment-city',
        kind: 'milestone',
        title: '来到这座城市',
        date: shiftIsoDate(today, -327),
        location: '东京',
        photoIds: [],
        createdAt: now,
        updatedAt: now,
      },
    ],
    elapsed: [
      {
        id: 'elapsed-city',
        title: '来到这座城市',
        startDate: shiftIsoDate(today, -327),
        createdAt: now,
        updatedAt: now,
      },
    ],
    remaining: [
      {
        id: 'remaining-graduation',
        title: '毕业以前',
        endDate: `${Number(year) + 1}-06-20`,
        unit: 'friday',
        createdAt: now,
        updatedAt: now,
      },
    ],
    stages: [
      {
        id: 'stage-year',
        kind: 'year',
        title: year,
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    dailyEntries: [],
    narrationUses: [],
    savedNarrations: [],
  }
}
