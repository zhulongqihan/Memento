import type { AppState, Settings } from '../domain/types'

const DEFAULT_SETTINGS: Settings = {
  displayName: '我的时间册',
  displayLifeProgress: false,
  lifeExpectancyYears: 80,
  timelineFilter: 'all',
  elapsedDisplayMode: 'days',
  elapsedSort: 'recent',
  theme: 'light',
  displayDensity: 'comfortable',
  numberFormat: 'plain',
}

function normalizeSettings(value: unknown): Settings {
  const source = value && typeof value === 'object' ? value as Partial<Settings> : {}
  return {
    ...DEFAULT_SETTINGS,
    ...source,
    displayName: typeof source.displayName === 'string' && source.displayName.trim() ? source.displayName : DEFAULT_SETTINGS.displayName,
    displayLifeProgress: source.displayLifeProgress === true,
  }
}

export function migrateAppState(value: unknown): AppState | null {
  if (!value || typeof value !== 'object') return null
  const source = value as { schemaVersion?: number; moments?: unknown; elapsed?: unknown; remaining?: unknown; stages?: unknown; photos?: unknown; settings?: unknown }
  if (source.schemaVersion !== 1 && source.schemaVersion !== 2) return null
  if (!Array.isArray(source.moments) || !Array.isArray(source.elapsed) || !Array.isArray(source.remaining)) return null
  return {
    schemaVersion: 2,
    moments: source.moments as AppState['moments'],
    elapsed: source.elapsed as AppState['elapsed'],
    remaining: source.remaining as AppState['remaining'],
    stages: Array.isArray(source.stages) ? source.stages as AppState['stages'] : [],
    photos: Array.isArray(source.photos) ? source.photos as AppState['photos'] : [],
    settings: normalizeSettings(source.settings),
  }
}
