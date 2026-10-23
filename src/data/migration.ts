import { isValidIsoDate } from '../domain/time'
import type { AppStateV4, DailyEntry, ElapsedCounter, LegacyAppState, LegacyPhotoAsset, Moment, NarrationUse, RemainingCounter, SavedNarration, Settings, Stage } from '../domain/types'
import { normalizeVisualNarrative } from '../domain/preferences'

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
  visualNarrative: 'archive',
  dailyNarrationEnabled: true,
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
    visualNarrative: normalizeVisualNarrative(source.visualNarrative),
    dailyNarrationEnabled: source.dailyNarrationEnabled !== false,
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

function isPhotoAsset(value: unknown): value is LegacyPhotoAsset {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && value.id.length > 0
    && typeof value.dataUrl === 'string' && value.dataUrl.length > 0
    && typeof value.name === 'string'
    && typeof value.mimeType === 'string'
    && (value.width === undefined || (typeof value.width === 'number' && Number.isFinite(value.width)))
    && (value.height === undefined || (typeof value.height === 'number' && Number.isFinite(value.height)))
}

function isDailyEntry(value: unknown): value is DailyEntry {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && value.id.length > 0
    && isValidIsoDate(value.date)
    && typeof value.text === 'string' && value.text.trim().length > 0
    && isTimestamp(value.createdAt)
    && isTimestamp(value.updatedAt)
    && (value.sourceNarrationId === undefined || typeof value.sourceNarrationId === 'string')
}

function isNarrationUse(value: unknown): value is NarrationUse {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && value.id.length > 0
    && typeof value.quoteId === 'string' && value.quoteId.length > 0
    && isValidIsoDate(value.date)
    && isTimestamp(value.displayedAt)
    && typeof value.saved === 'boolean'
}

function isSavedNarration(value: unknown): value is SavedNarration {
  if (!isRecord(value)) return false
  return typeof value.quoteId === 'string' && value.quoteId.length > 0
    && typeof value.original === 'string' && value.original.length > 0
    && (value.translationZh === undefined || typeof value.translationZh === 'string')
    && (value.author === undefined || typeof value.author === 'string')
    && typeof value.sourceUrl === 'string' && value.sourceUrl.length > 0
    && isTimestamp(value.savedAt)
}

/** Parse and normalize historic v1-v3 state without changing or dropping its image bytes. */
export function migrateAppState(value: unknown): LegacyAppState | null {
  if (!value || typeof value !== 'object') return null
  const source = value as { schemaVersion?: number; moments?: unknown; elapsed?: unknown; remaining?: unknown; stages?: unknown; photos?: unknown; dailyEntries?: unknown; narrationUses?: unknown; savedNarrations?: unknown; settings?: unknown }
  if (source.schemaVersion !== 1 && source.schemaVersion !== 2 && source.schemaVersion !== 3) return null
  const stages = source.stages === undefined ? [] : source.stages
  const photos = source.photos === undefined ? [] : source.photos
  const dailyEntries = source.dailyEntries === undefined ? [] : source.dailyEntries
  const narrationUses = source.narrationUses === undefined ? [] : source.narrationUses
  const savedNarrations = source.savedNarrations === undefined ? [] : source.savedNarrations
  if (!Array.isArray(source.moments) || !Array.isArray(source.elapsed) || !Array.isArray(source.remaining) || !Array.isArray(stages) || !Array.isArray(photos) || !Array.isArray(dailyEntries) || !Array.isArray(narrationUses) || !Array.isArray(savedNarrations)) return null
  if (!source.moments.every(isMoment) || !source.elapsed.every(isElapsedCounter) || !source.remaining.every(isRemainingCounter) || !stages.every(isStage) || !photos.every(isPhotoAsset) || !dailyEntries.every(isDailyEntry) || !narrationUses.every(isNarrationUse) || !savedNarrations.every(isSavedNarration)) return null
  return {
    schemaVersion: 3,
    moments: source.moments as LegacyAppState['moments'],
    elapsed: source.elapsed as LegacyAppState['elapsed'],
    remaining: source.remaining as LegacyAppState['remaining'],
    stages: stages as LegacyAppState['stages'],
    photos: photos as LegacyAppState['photos'],
    dailyEntries: dailyEntries as LegacyAppState['dailyEntries'],
    narrationUses: narrationUses as LegacyAppState['narrationUses'],
    savedNarrations: savedNarrations as LegacyAppState['savedNarrations'],
    settings: normalizeSettings(source.settings),
  }
}

/** Validate the persisted v4 payload. Photos are stored in AssetStore, never here. */
export function validatePersistedAppState(value: unknown): AppStateV4 | null {
  if (!isRecord(value) || value.schemaVersion !== 4 || 'photos' in value) return null
  const source = value
  const stages = source.stages === undefined ? [] : source.stages
  const dailyEntries = source.dailyEntries === undefined ? [] : source.dailyEntries
  const narrationUses = source.narrationUses === undefined ? [] : source.narrationUses
  const savedNarrations = source.savedNarrations === undefined ? [] : source.savedNarrations
  if (!Array.isArray(source.moments) || !Array.isArray(source.elapsed) || !Array.isArray(source.remaining)
    || !Array.isArray(stages) || !Array.isArray(dailyEntries) || !Array.isArray(narrationUses) || !Array.isArray(savedNarrations)) return null
  if (!source.moments.every(isMoment) || !source.elapsed.every(isElapsedCounter) || !source.remaining.every(isRemainingCounter)
    || !stages.every(isStage) || !dailyEntries.every(isDailyEntry) || !narrationUses.every(isNarrationUse) || !savedNarrations.every(isSavedNarration)) return null
  return {
    schemaVersion: 4,
    moments: source.moments as AppStateV4['moments'],
    elapsed: source.elapsed as AppStateV4['elapsed'],
    remaining: source.remaining as AppStateV4['remaining'],
    stages: stages as AppStateV4['stages'],
    dailyEntries: dailyEntries as AppStateV4['dailyEntries'],
    narrationUses: narrationUses as AppStateV4['narrationUses'],
    savedNarrations: savedNarrations as AppStateV4['savedNarrations'],
    settings: normalizeSettings(source.settings),
  }
}
