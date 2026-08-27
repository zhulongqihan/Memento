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
    schemaVersion: 3,
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

const DEMO_IDS = {
  moments: new Set(['moment-watermelon', 'moment-travel', 'moment-city']),
  elapsed: new Set(['elapsed-city']),
  remaining: new Set(['remaining-graduation']),
  stages: new Set(['stage-year']),
}

export function removeDemoData(state: AppState): AppState {
  const moments = state.moments.filter((item) => !DEMO_IDS.moments.has(item.id))
  const elapsed = state.elapsed.filter((item) => !DEMO_IDS.elapsed.has(item.id))
  const remaining = state.remaining.filter((item) => !DEMO_IDS.remaining.has(item.id))
  const stages = state.stages.filter((item) => !DEMO_IDS.stages.has(item.id))
  const removedPhotoIds = new Set(state.moments.filter((item) => DEMO_IDS.moments.has(item.id)).flatMap((item) => item.photoIds))
  const referencedPhotoIds = new Set(moments.flatMap((item) => item.photoIds))
  const photos = state.photos.filter((photo) => !removedPhotoIds.has(photo.id) || referencedPhotoIds.has(photo.id))
  const settings = { ...state.settings }
  if (settings.pinnedMomentId && DEMO_IDS.moments.has(settings.pinnedMomentId)) settings.pinnedMomentId = undefined
  if (settings.pinnedElapsedId && DEMO_IDS.elapsed.has(settings.pinnedElapsedId)) settings.pinnedElapsedId = undefined
  if (settings.pinnedRemainingId && DEMO_IDS.remaining.has(settings.pinnedRemainingId)) settings.pinnedRemainingId = undefined

  return { ...state, moments, elapsed, remaining, stages, photos, settings }
}

export function createSeedState(): AppState {
  const today = todayIso()
  const year = today.slice(0, 4)
  return {
    schemaVersion: 3,
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
