import type {
  ElapsedCounter,
  Moment,
  MomentKind,
  PhotoAsset,
  RemainingCounter,
  RemainingUnit,
  Stage,
} from '../../domain/types'

export type RecorderType = 'moment' | 'elapsed' | 'remaining' | 'stage'

export interface RecordDraft {
  type: RecorderType
  existingId?: string
  existingMomentId?: string
  momentKind: MomentKind
  title: string
  date: string
  note: string
  location: string
  endDate: string
  unit: RemainingUnit
  weekdays: number[]
  photos: DraftPhoto[]
  removedPhotoIds: string[]
}

export type DraftPhoto = PhotoAsset & { file?: File }

export type EditableRecord = Moment | ElapsedCounter | RemainingCounter | Stage
