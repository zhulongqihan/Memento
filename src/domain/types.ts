export type PageId = 'now' | 'timeline' | 'degrees' | 'settings'

export type MomentKind = 'first' | 'yearly_first' | 'milestone'
export type DegreeTab = 'elapsed' | 'remaining' | 'stage'
export type RemainingUnit = 'friday' | 'saturday' | 'sunday' | 'weekend' | 'custom'
export type TimelineFilter = 'all' | MomentKind | 'this_year'
export type ElapsedDisplayMode = 'days' | 'weeks' | 'months' | 'years'
export type ElapsedSort = 'recent' | 'oldest' | 'longest'
export type ThemeMode = 'light' | 'dark' | 'high-contrast'
export type DisplayDensity = 'comfortable' | 'compact'
export type NumberFormat = 'plain' | 'grouped'
export type VisualNarrative = 'archive' | 'light' | 'instrument'

export interface PhotoAsset {
  id: string
  dataUrl: string
  name: string
  mimeType: string
  width?: number
  height?: number
}

export interface LibraryCopy {
  id: string
  original: string
  translationZh?: string
  language: string
  author?: string
  work?: string
  sourceName: string
  sourceUrl: string
  license: 'public-domain' | 'cc0' | 'cc-by' | 'cc-by-sa'
  licenseUrl: string
  translationNote?: string
  tags: string[]
}

export interface Moment {
  id: string
  kind: MomentKind
  title: string
  date: string
  note?: string
  location?: string
  photoIds: string[]
  createdAt: string
  updatedAt: string
}

export interface DailyEntry {
  id: string
  date: string
  text: string
  createdAt: string
  updatedAt: string
  sourceNarrationId?: string
}

export interface NarrationUse {
  id: string
  quoteId: string
  date: string
  displayedAt: string
  saved: boolean
}

export interface SavedNarration {
  quoteId: string
  original: string
  translationZh?: string
  author?: string
  sourceUrl: string
  savedAt: string
}

export interface ElapsedCounter {
  id: string
  title: string
  startDate: string
  createdAt: string
  updatedAt: string
}

export interface RemainingCounter {
  id: string
  title: string
  endDate: string
  unit: RemainingUnit
  weekdays?: number[]
  createdAt: string
  updatedAt: string
}

export interface Stage {
  id: string
  kind: 'year' | 'custom' | 'life'
  title: string
  startDate: string
  endDate: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface Settings {
  displayName: string
  displayLifeProgress: boolean
  birthDate?: string
  lifeExpectancyYears?: number
  pinnedMomentId?: string
  pinnedElapsedId?: string
  pinnedRemainingId?: string
  timelineFilter?: TimelineFilter
  elapsedDisplayMode?: ElapsedDisplayMode
  elapsedSort?: ElapsedSort
  theme?: ThemeMode
  displayDensity?: DisplayDensity
  numberFormat?: NumberFormat
  visualNarrative?: VisualNarrative
  dailyNarrationEnabled?: boolean
}

export interface AppState {
  schemaVersion: 3
  moments: Moment[]
  elapsed: ElapsedCounter[]
  remaining: RemainingCounter[]
  stages: Stage[]
  photos: PhotoAsset[]
  dailyEntries: DailyEntry[]
  narrationUses: NarrationUse[]
  savedNarrations: SavedNarration[]
  settings: Settings
}

export interface BackupSummary {
  fileName: string
  schemaVersion: number
  appVersion: string
  exportedAt: string
  timezone: string
  momentCount: number
  photoCount: number
  dailyEntryCount: number
  narrationCount: number
  data: AppState
}

export interface ElapsedBreakdown {
  days: number
  weeks: number
  months: number
  years: number
}

export interface RemainingDate {
  date: string
  label: string
}
