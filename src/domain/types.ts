export type PageId = 'now' | 'timeline' | 'degrees' | 'settings'

export type MomentKind = 'first' | 'yearly_first' | 'milestone'
export type DegreeTab = 'elapsed' | 'remaining' | 'stage'
export type RemainingUnit = 'friday' | 'saturday' | 'sunday' | 'weekend'
export type TimelineFilter = 'all' | MomentKind | 'this_year'

export interface PhotoAsset {
  id: string
  dataUrl: string
  name: string
  mimeType: string
  width?: number
  height?: number
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
}

export interface AppState {
  schemaVersion: 1
  moments: Moment[]
  elapsed: ElapsedCounter[]
  remaining: RemainingCounter[]
  stages: Stage[]
  photos: PhotoAsset[]
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
