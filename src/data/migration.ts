import { isValidIsoDate } from '../domain/time'
import type { AppState, ElapsedCounter, Moment, PhotoAsset, RemainingCounter, Settings, Stage } from '../domain/types'

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
  const timelineFilters = ['all', 'first', 'yearly_first', 'milestone', 'this_year'] as const
  const elapsedModes = ['days', 'weeks', 'months', 'years'] as const
  const elapsedSorts = ['recent', 'oldest', 'longest'] as const
  const themes = ['light', 'dark', 'high-contrast'] as const
  const densities = ['comfortable', 'compact'] as const
  const numberFormats = ['plain', 'grouped'] as const
  const lifeExpectancyYears = typeof source.lifeExpectancyYears === 'number' && Number.isFinite(source.lifeExpectancyYears)
    ? Math.min(150, Math.max(1, Math.trunc(source.lifeExpectancyYears)))
    : DEFAULT_SETTINGS.lifeExpectancyYears
  return {
    ...DEFAULT_SETTINGS,
    displayName: typeof source.displayName === 'string' && source.displayName.trim() ? source.displayName : DEFAULT_SETTINGS.displayName,
    displayLifeProgress: source.displayLifeProgress === true,
    birthDate: isValidIsoDate(source.birthDate) ? source.birthDate : undefined,
    lifeExpectancyYears,
    pinnedMomentId: typeof source.pinnedMomentId === 'string' ? source.pinnedMomentId : undefined,
    pinnedElapsedId: typeof source.pinnedElapsedId === 'string' ? source.pinnedElapsedId : undefined,
    pinnedRemainingId: typeof source.pinnedRemainingId === 'string' ? source.pinnedRemainingId : undefined,
    timelineFilter: timelineFilters.includes(source.timelineFilter as typeof timelineFilters[number]) ? source.timelineFilter as Settings['timelineFilter'] : DEFAULT_SETTINGS.timelineFilter,
    elapsedDisplayMode: elapsedModes.includes(source.elapsedDisplayMode as typeof elapsedModes[number]) ? source.elapsedDisplayMode as Settings['elapsedDisplayMode'] : DEFAULT_SETTINGS.elapsedDisplayMode,
    elapsedSort: elapsedSorts.includes(source.elapsedSort as typeof elapsedSorts[number]) ? source.elapsedSort as Settings['elapsedSort'] : DEFAULT_SETTINGS.elapsedSort,
    theme: themes.includes(source.theme as typeof themes[number]) ? source.theme as Settings['theme'] : DEFAULT_SETTINGS.theme,
    displayDensity: densities.includes(source.displayDensity as typeof densities[number]) ? source.displayDensity as Settings['displayDensity'] : DEFAULT_SETTINGS.displayDensity,
    numberFormat: numberFormats.includes(source.numberFormat as typeof numberFormats[number]) ? source.numberFormat as Settings['numberFormat'] : DEFAULT_SETTINGS.numberFormat,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0)
}

function isMoment(value: unknown): value is Moment {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && value.id.length > 0
    && ['first', 'yearly_first', 'milestone'].includes(value.kind as string)
    && typeof value.title === 'string'
    && isValidIsoDate(value.date)
    && isStringArray(value.photoIds)
    && isTimestamp(value.createdAt)
    && isTimestamp(value.updatedAt)
    && (value.note === undefined || typeof value.note === 'string')
    && (value.location === undefined || typeof value.location === 'string')
}

function isElapsedCounter(value: unknown): value is ElapsedCounter {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && value.id.length > 0
    && typeof value.title === 'string'
    && isValidIsoDate(value.startDate)
    && isTimestamp(value.createdAt)
    && isTimestamp(value.updatedAt)
}

function isRemainingCounter(value: unknown): value is RemainingCounter {
  if (!isRecord(value)) return false
  const weekdays = value.weekdays
  return typeof value.id === 'string' && value.id.length > 0
    && typeof value.title === 'string'
    && isValidIsoDate(value.endDate)
    && ['friday', 'saturday', 'sunday', 'weekend', 'custom'].includes(value.unit as string)
    && (weekdays === undefined || (Array.isArray(weekdays) && weekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)))
    && isTimestamp(value.createdAt)
    && isTimestamp(value.updatedAt)
}

function isStage(value: unknown): value is Stage {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && value.id.length > 0
    && ['year', 'custom', 'life'].includes(value.kind as string)
    && typeof value.title === 'string'
    && isValidIsoDate(value.startDate)
    && isValidIsoDate(value.endDate)
    && typeof value.enabled === 'boolean'
    && isTimestamp(value.createdAt)
    && isTimestamp(value.updatedAt)
}

function isPhotoAsset(value: unknown): value is PhotoAsset {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && value.id.length > 0
    && typeof value.dataUrl === 'string' && value.dataUrl.length > 0
    && typeof value.name === 'string'
    && typeof value.mimeType === 'string'
    && (value.width === undefined || (typeof value.width === 'number' && Number.isFinite(value.width)))
    && (value.height === undefined || (typeof value.height === 'number' && Number.isFinite(value.height)))
}

export function migrateAppState(value: unknown): AppState | null {
  if (!value || typeof value !== 'object') return null
  const source = value as { schemaVersion?: number; moments?: unknown; elapsed?: unknown; remaining?: unknown; stages?: unknown; photos?: unknown; settings?: unknown }
  if (source.schemaVersion !== 1 && source.schemaVersion !== 2) return null
  const stages = source.stages === undefined ? [] : source.stages
  const photos = source.photos === undefined ? [] : source.photos
  if (!Array.isArray(source.moments) || !Array.isArray(source.elapsed) || !Array.isArray(source.remaining) || !Array.isArray(stages) || !Array.isArray(photos)) return null
  if (!source.moments.every(isMoment) || !source.elapsed.every(isElapsedCounter) || !source.remaining.every(isRemainingCounter) || !stages.every(isStage) || !photos.every(isPhotoAsset)) return null
  return {
    schemaVersion: 2,
    moments: source.moments as AppState['moments'],
    elapsed: source.elapsed as AppState['elapsed'],
    remaining: source.remaining as AppState['remaining'],
    stages: stages as AppState['stages'],
    photos: photos as AppState['photos'],
    settings: normalizeSettings(source.settings),
  }
}
