import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ErrorInfo, PointerEvent as ReactPointerEvent, ReactElement, ReactNode } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Bookmark,
  CalendarDays,
  ClipboardCopy,
  ChevronRight,
  Clock3,
  KeyRound,
  Layers3,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  UserRound,
  Waves,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { exportEncryptedBackup, exportJson, exportZip, parseBackup } from './data/backup'
import { clearRecoverySnapshot, getAssetStore, hasRecoverySnapshot, loadRecoverySnapshot, loadState, saveRecoverySnapshot, saveState } from './data/repository'
import { commitStagedBackupImport, stageBackupImport, type StagedBackupImport } from './data/backup-import'
import { downloadShareCard } from './data/cards'
import { createEmptyState } from './data/seed'
import type {
  AppState,
  BackupSummary,
  DegreeTab,
  DisplayDensity,
  ElapsedCounter,
  ElapsedDisplayMode,
  ElapsedSort,
  Moment,
  NumberFormat,
  PageId,
  RemainingCounter,
  Stage,
  ThemeMode,
  TimelineFilter,
  DailyEntry,
  LibraryCopy,
  NarrationUse,
} from './domain/types'
import { mergeState } from './data/merge'
import type { EditableRecord, RecordDraft, RecorderType } from './features/records/types'
import { resolveMomentPhotoIds } from './features/records/photo-selection'
import { ImportDialog, MomentDetail, RecordDrawer, StageDetail } from './ui/recording-overlays'
import type { RiverDriftItem } from './ui/river-drift-overlay'
import { getDailyEntry, getTodayNarrationUse } from './domain/narration-state'
import { pickPinned } from './domain/preferences'
import {
  formatCounterUnit,
  formatDate,
  formatDateWithWeekday,
  formatDisplayNumber,
  formatRelative,
  getDaysRemainingInYear,
  getElapsedBreakdown,
  getElapsedDisplay,
  getLifeEndDate,
  getMonthLabel,
  getRemainingDates,
  getStageProgress,
  getWeekdayLabel,
  getYearProgress,
  isValidIsoDate,
  shiftIsoDate,
  todayIso,
} from './domain/time'

const NowWorldV29 = lazy(() => import('./ui/worlds/NowWorld').then((module) => ({ default: module.NowWorldV29 })))
const TimelineWorldV29 = lazy(() => import('./ui/worlds/TimelineWorld').then((module) => ({ default: module.TimelineWorldV29 })))
const DegreesWorldV29 = lazy(() => import('./ui/worlds/DegreesWorld').then((module) => ({ default: module.DegreesWorldV29 })))
const SettingsWorldV31 = lazy(() => import('./ui/worlds/SettingsWorld').then((module) => ({ default: module.SettingsWorldV31 })))
const NarrationSourceDialog = lazy(() => import('./ui/narration-source-dialog').then((module) => ({ default: module.NarrationSourceDialog })))
const RiverDriftOverlay = lazy(() => import('./ui/river-drift-overlay').then((module) => ({ default: module.RiverDriftOverlay })))

type PersistenceStatus = 'saving' | 'saved' | 'recovering' | 'error'
type PageTransition = 'now-curtain' | 'timeline-film' | 'degrees-dial' | 'settings-document'





const NAV_ITEMS: Array<{ id: PageId; label: string; icon: LucideIcon }> = [
  { id: 'now', label: '此刻', icon: Clock3 },
  { id: 'timeline', label: '时光', icon: BookOpen },
  { id: 'degrees', label: '几度', icon: Layers3 },
  { id: 'settings', label: '我的', icon: UserRound },
]




function getPageTransition(page: PageId): PageTransition {
  return page === 'now' ? 'now-curtain' : page === 'timeline' ? 'timeline-film' : page === 'degrees' ? 'degrees-dial' : 'settings-document'
}

function makeId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  return `${prefix}-${random}`
}

interface AppErrorBoundaryState {
  hasError: boolean
}

class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Memento rendering error', error, info)
  }

  render(): ReactElement {
    if (this.state.hasError) {
      return <div className="error-screen"><div className="error-symbol">几</div><h1>时间册暂时没有打开</h1><p>本地记录没有被删除。重新打开窗口即可继续。</p><button className="dark-action" onClick={() => window.location.reload()}>重新打开</button></div>
    }
    return <>{this.props.children}</>
  }
}

function App(): ReactElement {
  const [state, setState] = useState<AppState | null>(null)
  const [page, setPage] = useState<PageId>('now')
  const [transitionNonce, setTransitionNonce] = useState(0)
  const [degreeTab, setDegreeTab] = useState<DegreeTab>('elapsed')
  const [recorder, setRecorder] = useState<RecorderType | null>(null)
  const [editingRecord, setEditingRecord] = useState<EditableRecord | null>(null)
  const [selectedMoment, setSelectedMoment] = useState<Moment | null>(null)
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null)
  const [pendingImport, setPendingImport] = useState<BackupSummary | null>(null)
  const [recoveryAvailable, setRecoveryAvailable] = useState(false)
  const [timelineScrollTop, setTimelineScrollTop] = useState(0)
  const [backupPassword, setBackupPassword] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>('saved')
  const [riverOpen, setRiverOpen] = useState(false)
  const [dailyEditing, setDailyEditing] = useState(false)
  const [dailyDraft, setDailyDraft] = useState('')
  const [narrationSource, setNarrationSource] = useState<LibraryCopy | null>(null)
  const [todayNarration, setTodayNarration] = useState<LibraryCopy | undefined>()
  const navigateTo = useCallback((nextPage: PageId) => {
    if (page === nextPage) return
    setTransitionNonce((nonce) => nonce + 1)
    setPage(nextPage)
  }, [page])

  useEffect(() => {
    void loadState().then(async (loadedState) => {
      setState(loadedState)
      // Legacy migration may create the first recovery snapshot inside loadState.
      setRecoveryAvailable(await hasRecoverySnapshot())
    }).catch((error) => {
      setPersistenceStatus('error')
      setLoadError(error instanceof Error ? error.message : '本地时间册无法读取；原始数据已保留。')
    })
  }, [])

  useEffect(() => {
    if (!state) return
    let active = true
    setPersistenceStatus('saving')
    void saveState(state).then((result) => {
      if (!active) return
      if (result.status === 'saved') setPersistenceStatus('saved')
      else if (result.status === 'recovering') {
        setPersistenceStatus('recovering')
        setNotice(result.message)
      } else {
        setPersistenceStatus('error')
        setNotice(result.message)
      }
    }).catch((error) => {
      console.warn('Unable to persist app state.', error)
      if (active) {
        setPersistenceStatus('error')
        setNotice('这次修改还没有保存成功，请先保留当前窗口并重试。')
      }
    })
    return () => { active = false }
  }, [state])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), 3500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (pendingImport) setPendingImport(null)
      else if (recorder) { setRecorder(null); setEditingRecord(null) }
      else if (selectedMoment) setSelectedMoment(null)
      else if (selectedStage) setSelectedStage(null)
      else if (narrationSource) setNarrationSource(null)
      else if (riverOpen) setRiverOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pendingImport, recorder, selectedMoment, selectedStage, narrationSource, riverOpen])

  useEffect(() => {
    const overlayOpen = Boolean(pendingImport || recorder || selectedMoment || selectedStage || riverOpen || narrationSource)
    if (!overlayOpen) return
    const previousBodyOverflow = document.body.style.overflow
    const previousDocumentOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousDocumentOverflow
    }
  }, [pendingImport, recorder, selectedMoment, selectedStage, riverOpen, narrationSource])

  const updateState = useCallback((updater: (current: AppState) => AppState) => {
    setState((current) => (current ? updater(current) : current))
  }, [])

  useEffect(() => {
    if (!state || state.settings.dailyNarrationEnabled === false) return
    const today = todayIso()
    if (getDailyEntry(state, today) || getTodayNarrationUse(state, today)) return
    let active = true
    void import('./domain/narration').then(({ chooseUnreadCopy }) => {
      if (!active) return
      const copy = chooseUnreadCopy(state)
      if (!copy) return
      updateState((current) => {
        if (getDailyEntry(current, today) || getTodayNarrationUse(current, today)) return current
        return { ...current, narrationUses: [...current.narrationUses, { id: makeId('narration'), quoteId: copy.id, date: today, displayedAt: new Date().toISOString(), saved: false }] }
      })
    }).catch((error) => {
      if (active) console.warn('Unable to load the local narration library.', error)
    })
    return () => { active = false }
  }, [state, updateState])

  const today = todayIso()
  const todayDaily = state ? getDailyEntry(state, today) : undefined
  const todayNarrationUse = state ? getTodayNarrationUse(state, today) : undefined

  useEffect(() => {
    if (!state || !todayNarrationUse) {
      setTodayNarration(undefined)
      return
    }
    let active = true
    void import('./domain/narration').then(({ getNarrationSnapshot }) => {
      if (active) setTodayNarration(getNarrationSnapshot(state, todayNarrationUse))
    }).catch((error) => {
      if (active) console.warn('Unable to resolve the current narration.', error)
    })
    return () => { active = false }
  }, [state, todayNarrationUse?.id])

  const handleRecord = useCallback(async (draft: RecordDraft) => {
    let photos = draft.photos
    if (draft.type === 'moment') {
      try {
        photos = await Promise.all(draft.photos.map(async (photo) => {
          if (!photo.file) return photo
          const metadata = await getAssetStore().put(photo.file, photo.id)
          const blob = await getAssetStore().read(photo.id)
          if (!blob) throw new Error(`照片“${photo.name}”写入后无法读取。`)
          return { ...metadata, src: URL.createObjectURL(blob) }
        }))
      } catch (error) {
        setNotice(error instanceof Error ? error.message : '照片写入失败，记录尚未保存。')
        return
      }
    }
    const readyDraft = { ...draft, photos }
    const timestamp = new Date().toISOString()
    updateState((current) => {
      if (readyDraft.type === 'moment') {
        const existingId = readyDraft.existingId ?? readyDraft.existingMomentId
        const originalIds = current.moments.find((item) => item.id === existingId)?.photoIds ?? []
        const photoIds = resolveMomentPhotoIds(originalIds, readyDraft.photos, readyDraft.removedPhotoIds)
        if (existingId) {
          const existing = current.moments.find((item) => item.id === existingId)
          if (!existing) return current
          const activePhotoIds = new Set(photoIds)
          const retainedPhotos = current.photos.filter((photo) => !existing.photoIds.includes(photo.id) || activePhotoIds.has(photo.id))
          const mergedPhotos = [...retainedPhotos, ...readyDraft.photos.filter((photo) => !retainedPhotos.some((item) => item.id === photo.id))]
          const updated: Moment = {
            ...existing,
            kind: readyDraft.momentKind,
            title: readyDraft.title.trim(),
            date: readyDraft.date,
            note: readyDraft.note.trim() || undefined,
            location: readyDraft.location.trim() || undefined,
            photoIds,
            updatedAt: timestamp,
          }
          return { ...current, moments: current.moments.map((item) => item.id === updated.id ? updated : item), photos: mergedPhotos }
        }
        const moment: Moment = {
          id: makeId('moment'),
          kind: draft.momentKind,
          title: draft.title.trim(),
          date: draft.date,
          note: draft.note.trim() || undefined,
          location: draft.location.trim() || undefined,
          photoIds,
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        return { ...current, moments: [moment, ...current.moments], photos: [...current.photos, ...readyDraft.photos] }
      }

      if (draft.type === 'elapsed') {
        const existing = draft.existingId ? current.elapsed.find((item) => item.id === draft.existingId) : undefined
        if (existing) {
          const updated: ElapsedCounter = { ...existing, title: draft.title.trim(), startDate: draft.date, updatedAt: timestamp }
          return { ...current, elapsed: current.elapsed.map((item) => item.id === updated.id ? updated : item) }
        }
        const elapsed: ElapsedCounter = {
          id: makeId('elapsed'),
          title: draft.title.trim(),
          startDate: draft.date,
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        return { ...current, elapsed: [elapsed, ...current.elapsed] }
      }

      if (draft.type === 'remaining') {
        const existing = draft.existingId ? current.remaining.find((item) => item.id === draft.existingId) : undefined
        if (existing) {
          const updated: RemainingCounter = { ...existing, title: draft.title.trim(), endDate: draft.endDate, unit: draft.unit, weekdays: draft.unit === 'custom' ? [...draft.weekdays] : undefined, updatedAt: timestamp }
          return { ...current, remaining: current.remaining.map((item) => item.id === updated.id ? updated : item) }
        }
        const remaining: RemainingCounter = {
          id: makeId('remaining'),
          title: draft.title.trim(),
          endDate: draft.endDate,
          unit: draft.unit,
          weekdays: draft.unit === 'custom' ? [...draft.weekdays] : undefined,
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        return { ...current, remaining: [remaining, ...current.remaining] }
      }

      const stage: Stage = {
        id: makeId('stage'),
        kind: 'custom',
        title: draft.title.trim(),
        startDate: draft.date,
        endDate: draft.endDate,
        enabled: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      const existing = draft.existingId ? current.stages.find((item) => item.id === draft.existingId) : undefined
      if (existing) {
        const updated: Stage = { ...existing, title: draft.title.trim(), startDate: draft.date, endDate: draft.endDate, updatedAt: timestamp }
        return { ...current, stages: current.stages.map((item) => item.id === updated.id ? updated : item) }
      }
      return { ...current, stages: [stage, ...current.stages] }
    })
    setRecorder(null)
    setEditingRecord(null)
    setNotice('已经记下来了。')
  }, [updateState])

  const deleteMoment = useCallback((momentId: string) => {
    updateState((current) => {
      const moment = current.moments.find((item) => item.id === momentId)
      const photoIds = new Set(moment?.photoIds ?? [])
      return {
        ...current,
        settings: current.settings.pinnedMomentId === momentId ? { ...current.settings, pinnedMomentId: undefined } : current.settings,
        moments: current.moments.filter((item) => item.id !== momentId),
        photos: current.photos.filter((photo) => !photoIds.has(photo.id)),
      }
    })
    setSelectedMoment(null)
    setNotice('这段记录已经移除了。')
  }, [updateState])

  const deleteCounter = useCallback((type: 'elapsed' | 'remaining', id: string) => {
    if (!window.confirm('确定要删除这段时间记录吗？')) return
    updateState((current) => {
      const pinnedKey = type === 'elapsed' ? 'pinnedElapsedId' : 'pinnedRemainingId'
      return { ...current, [type]: current[type].filter((item) => item.id !== id), settings: { ...current.settings, [pinnedKey]: current.settings[pinnedKey] === id ? undefined : current.settings[pinnedKey] } }
    })
    setNotice('这段时间记录已经删除。')
  }, [updateState])

  const importData = useCallback(async (file: File, password: string) => {
    try {
      const imported = await parseBackup(file, password)
      setPendingImport(imported)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '导入失败，请检查备份文件。')
    }
  }, [])

  const exportEncrypted = useCallback(async (password: string) => {
    if (!state) return
    try {
      await exportEncryptedBackup(state, password)
      setNotice('加密备份已经生成，请妥善保管密码。')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '加密备份生成失败。')
    }
  }, [state])

  const finishImport = useCallback(async (mode: 'merge' | 'replace') => {
    if (!pendingImport || !state) return
    let staged: StagedBackupImport | null = null
    try {
      staged = await stageBackupImport(pendingImport, getAssetStore())
      const importedState = staged.state
      let nextState = importedState
      if (mode === 'merge') {
        nextState = mergeState(state, importedState)
      } else {
        await saveRecoverySnapshot(state)
        setRecoveryAvailable(true)
      }
      const result = await commitStagedBackupImport(staged, () => saveState(nextState))
      updateState(() => nextState)
      if (result.status === 'recovering') setPersistenceStatus('recovering')
      setNotice(mode === 'merge' ? `已合并 ${pendingImport.momentCount} 条记录。` : `已恢复 ${pendingImport.momentCount} 条记录；替换前快照已保留。`)
      setPendingImport(null)
    } catch (error) {
      let detail = error instanceof Error ? error.message : '本机时间册没有替换。'
      if (staged) {
        try {
          await staged.rollback()
        } catch (rollbackError) {
          detail += ` 照片回滚也未完成：${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`
        }
      }
      setNotice(`备份导入未完成：${detail}`)
    }
  }, [pendingImport, state, updateState])

  const restoreRecovery = useCallback(async () => {
    try {
      const snapshot = await loadRecoverySnapshot()
      if (!snapshot) {
        setNotice('没有找到可恢复的替换前快照。')
        return
      }
      const saved = await saveState(snapshot.state)
      if (saved.status === 'failed') throw new Error(saved.message)
      updateState(() => snapshot.state)
      await clearRecoverySnapshot()
      setRecoveryAvailable(false)
      setNotice('已恢复替换前的时间册。')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '恢复快照失败。')
    }
  }, [updateState])

  const resetData = useCallback(async () => {
    if (!state) return
    try {
      await saveRecoverySnapshot(state)
      setRecoveryAvailable(true)
      const emptyState = createEmptyState()
      const result = await saveState(emptyState)
      if (result.status === 'failed') throw new Error(result.message)
      updateState(() => emptyState)
      if (result.status === 'recovering') setPersistenceStatus('recovering')
      setSelectedMoment(null)
      setSelectedStage(null)
      setPendingImport(null)
      setEditingRecord(null)
      setRecorder(null)
      setDailyEditing(false)
      setDailyDraft('')
      setNarrationSource(null)
      setRiverOpen(false)
      setNotice('已清空当前时间册；清空前快照可以在这里恢复。')
    } catch (error) {
      setNotice(error instanceof Error ? `清空未完成：${error.message} 当前时间册仍保留。` : '清空未完成；当前时间册仍保留。')
    }
  }, [state, updateState])

  const shareMoment = useCallback(async (moment: Moment) => {
    try {
      await downloadShareCard('moment', { title: moment.title, date: formatDateWithWeekday(moment.date), note: moment.note })
      setNotice('Moment 分享卡已经生成。')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '分享卡生成失败。')
    }
  }, [])

  const shareElapsed = useCallback(async (item: ElapsedCounter) => {
    try {
      const display = getElapsedDisplay(getElapsedBreakdown(item.startDate), state?.settings.elapsedDisplayMode ?? 'days')
      await downloadShareCard('elapsed', { title: item.title, value: display.value, unit: display.unit })
      setNotice('经年分享卡已经生成。')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '分享卡生成失败。')
    }
  }, [state?.settings.elapsedDisplayMode])

  const shareRemaining = useCallback(async (item: RemainingCounter) => {
    try {
      const dates = getRemainingDates(item.endDate, item.unit, todayIso(), item.weekdays)
      await downloadShareCard('remaining', { title: item.title, count: dates.length, unit: formatCounterUnit(item.unit), nextDate: dates[0] ? formatDate(dates[0].date, 'short') : undefined })
      setNotice('余下分享卡已经生成。')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '分享卡生成失败。')
    }
  }, [])

  const openRecordEdit = useCallback((type: RecorderType, record: EditableRecord) => {
    setSelectedMoment(null)
    setSelectedStage(null)
    setEditingRecord(record)
    setRecorder(type)
  }, [])

  const openMomentEdit = useCallback((moment: Moment) => openRecordEdit('moment', moment), [openRecordEdit])

  const changeRecorderType = useCallback((type: RecorderType) => {
    setEditingRecord(null)
    setRecorder(type)
  }, [])

  const setPinned = useCallback((key: 'pinnedMomentId' | 'pinnedElapsedId' | 'pinnedRemainingId', id: string) => {
    updateState((current) => ({
      ...current,
      settings: { ...current.settings, [key]: current.settings[key] === id ? undefined : id },
    }))
  }, [updateState])

  const setElapsedDisplayMode = useCallback((mode: ElapsedDisplayMode) => {
    updateState((current) => ({ ...current, settings: { ...current.settings, elapsedDisplayMode: mode } }))
  }, [updateState])

  const setElapsedSort = useCallback((sort: ElapsedSort) => {
    updateState((current) => ({ ...current, settings: { ...current.settings, elapsedSort: sort } }))
  }, [updateState])

  const updateStage = useCallback((stageId: string, patch: Partial<Stage>) => {
    const updatedAt = new Date().toISOString()
    updateState((current) => ({
      ...current,
      stages: current.stages.map((stage) => stage.id === stageId ? { ...stage, ...patch, updatedAt } : stage),
    }))
    setSelectedStage((current) => current?.id === stageId ? { ...current, ...patch, updatedAt } : current)
  }, [updateState])

  const deleteStage = useCallback((stageId: string) => {
    updateState((current) => ({ ...current, stages: current.stages.filter((stage) => stage.id !== stageId) }))
    setSelectedStage(null)
    setNotice('这段刻度已经移除了。')
  }, [updateState])

  const setLifeProfile = useCallback((patch: { displayLifeProgress?: boolean; birthDate?: string; lifeExpectancyYears?: number }) => {
    updateState((current) => ({ ...current, settings: { ...current.settings, ...patch } }))
  }, [updateState])

  const setAppearance = useCallback((patch: { theme?: ThemeMode; displayDensity?: DisplayDensity; numberFormat?: NumberFormat }) => {
    updateState((current) => ({ ...current, settings: { ...current.settings, ...patch } }))
  }, [updateState])

  const setNarrationEnabled = useCallback((enabled: boolean) => {
    updateState((current) => ({ ...current, settings: { ...current.settings, dailyNarrationEnabled: enabled } }))
  }, [updateState])

  const handleTimelineFilterChange = useCallback((filter: TimelineFilter) => {
    updateState((current) => ({ ...current, settings: { ...current.settings, timelineFilter: filter } }))
    setTimelineScrollTop(0)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [updateState])

  const saveDailyEntry = useCallback((text: string, date = todayIso()) => {
    const cleanText = text.trim()
    const timestamp = new Date().toISOString()
    updateState((current) => {
      const existing = current.dailyEntries.find((entry) => entry.date === date)
      if (!cleanText) return existing ? { ...current, dailyEntries: current.dailyEntries.filter((entry) => entry.date !== date) } : current
      const entry: DailyEntry = existing
        ? { ...existing, text: cleanText, updatedAt: timestamp }
        : { id: makeId('daily'), date, text: cleanText, createdAt: timestamp, updatedAt: timestamp }
      return { ...current, dailyEntries: existing ? current.dailyEntries.map((item) => item.id === existing.id ? entry : item) : [entry, ...current.dailyEntries] }
    })
    if (date === todayIso()) { setDailyEditing(false); setDailyDraft(cleanText) }
    setNotice(cleanText ? '这一行已经保存。' : '这一行已删除。')
  }, [updateState])

  const deleteDailyEntry = useCallback((date: string) => {
    updateState((current) => ({ ...current, dailyEntries: current.dailyEntries.filter((entry) => entry.date !== date) }))
    if (date === todayIso()) { setDailyEditing(false); setDailyDraft('') }
    setNotice('这一行已经删除。')
  }, [updateState])

  const rotateNarration = useCallback(async () => {
    try {
      const { chooseUnreadCopy } = await import('./domain/narration')
      const today = todayIso()
      updateState((current) => {
        const next = chooseUnreadCopy(current)
        if (!next) return current
        return { ...current, narrationUses: [...current.narrationUses, { id: makeId('narration'), quoteId: next.id, date: today, displayedAt: new Date().toISOString(), saved: false }] }
      })
    } catch (error) {
      console.warn('Unable to rotate the local narration.', error)
      setNotice('本地旁白库暂时无法读取。')
    }
  }, [updateState])

  const toggleNarrationSaved = useCallback((copy: LibraryCopy) => {
    const now = new Date().toISOString()
    updateState((current) => {
      const saved = current.savedNarrations.some((item) => item.quoteId === copy.id)
      const savedNarrations = saved ? current.savedNarrations.filter((item) => item.quoteId !== copy.id) : [...current.savedNarrations, { quoteId: copy.id, original: copy.original, translationZh: copy.translationZh, author: copy.author, sourceUrl: copy.sourceUrl, savedAt: now }]
      return { ...current, savedNarrations, narrationUses: current.narrationUses.map((item) => item.quoteId === copy.id ? { ...item, saved: !saved } : item) }
    })
    setNotice('旁白收藏状态已更新。')
  }, [updateState])

  const convertNarrationToDaily = useCallback((copy: LibraryCopy) => {
    const text = copy.translationZh ?? copy.original
    const date = todayIso()
    const now = new Date().toISOString()
    updateState((current) => {
      const existing = current.dailyEntries.find((entry) => entry.date === date)
      const entry: DailyEntry = existing ? { ...existing, text, sourceNarrationId: copy.id, updatedAt: now } : { id: makeId('daily'), date, text, sourceNarrationId: copy.id, createdAt: now, updatedAt: now }
      return { ...current, dailyEntries: existing ? current.dailyEntries.map((item) => item.id === existing.id ? entry : item) : [entry, ...current.dailyEntries] }
    })
    setDailyDraft(text)
    setDailyEditing(false)
    setNotice('已转为今日一行，仍保留旁白来源标记。')
  }, [updateState])

  const copyNarration = useCallback(async (copy: LibraryCopy) => {
    try {
      await navigator.clipboard.writeText(copy.translationZh ?? copy.original)
      setNotice('旁白已经复制。')
    } catch {
      setNotice('当前环境不允许自动复制，请手动选择文字。')
    }
  }, [])

  const riverItems = useMemo<RiverDriftItem[]>(() => {
    if (!state) return []
    const items: RiverDriftItem[] = []
    const orderedMoments = [...state.moments].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
    const primary = pickPinned(state.moments, state.settings.pinnedMomentId) ?? orderedMoments[0]
    const older = orderedMoments.find((moment) => moment.id !== primary?.id && moment.date < today)
    if (primary) items.push({ id: `river-${primary.id}`, kind: 'moment', eyebrow: 'MOMENT / RECENT EVIDENCE', title: primary.title, body: primary.note ?? '一件被你留下来的事，正在时间里保持清晰。', meta: `${formatDate(primary.date, 'long')}${primary.location ? ` · ${primary.location}` : ''}`, actionLabel: '打开记录', onOpen: () => { setRiverOpen(false); setSelectedMoment(primary) } })
    if (older) items.push({ id: `river-${older.id}`, kind: 'moment', eyebrow: 'MOMENT / EARLIER TRACE', title: older.title, body: older.note ?? '更早的一段时间，仍然可以被重新看见。', meta: formatDate(older.date, 'long'), actionLabel: '打开记录', onOpen: () => { setRiverOpen(false); setSelectedMoment(older) } })
    if (todayDaily) items.push({ id: `river-${todayDaily.id}`, kind: 'daily', eyebrow: 'DAILY LINE / TODAY', title: '今天的一行', body: todayDaily.text, meta: formatDate(todayDaily.date, 'long'), actionLabel: '编辑这一行', onOpen: () => { setRiverOpen(false); setDailyDraft(todayDaily.text); setDailyEditing(true) } })
    if (todayNarration) items.push({ id: `river-${todayNarration.id}`, kind: 'narration', eyebrow: 'NARRATION / LOCAL LIBRARY', title: todayNarration.translationZh ?? todayNarration.original, body: todayNarration.translationZh ? todayNarration.original : '今天的旁白来自随软件打包的本地文案库。', meta: `${todayNarration.author ?? '佚名'} · ${todayNarration.work ?? todayNarration.sourceName}`, actionLabel: '查看出处', onOpen: () => { setRiverOpen(false); setNarrationSource(todayNarration) }, onSource: () => { setRiverOpen(false); setNarrationSource(todayNarration) } })
    const elapsed = pickPinned(state.elapsed, state.settings.pinnedElapsedId)
    const remaining = pickPinned(state.remaining, state.settings.pinnedRemainingId)
    const stage = state.stages.find((item) => item.enabled) ?? state.stages[0]
    if (elapsed) items.push({ id: `river-${elapsed.id}`, kind: 'measure', eyebrow: 'MEASURE / PAST', title: `${getElapsedBreakdown(elapsed.startDate).days} 天`, body: `${elapsed.title}，从 ${formatDate(elapsed.startDate, 'long')} 起，时间正在累计。`, meta: '真实经年摘要', actionLabel: '前往几度', onOpen: () => { setRiverOpen(false); navigateTo('degrees') } })
    else if (remaining) items.push({ id: `river-${remaining.id}`, kind: 'measure', eyebrow: 'MEASURE / NEXT', title: `${getRemainingDates(remaining.endDate, remaining.unit, today, remaining.weekdays).length} ${formatCounterUnit(remaining.unit)}`, body: `${remaining.title}，距离 ${formatDate(remaining.endDate, 'long')} 的余下摘要。`, meta: '真实余下摘要', actionLabel: '前往几度', onOpen: () => { setRiverOpen(false); navigateTo('degrees') } })
    else if (stage) items.push({ id: `river-${stage.id}`, kind: 'measure', eyebrow: 'MEASURE / PASSAGE', title: `${getStageProgress(stage.startDate, stage.endDate).toFixed(1)}%`, body: `${stage.title}，从 ${formatDate(stage.startDate, 'long')} 走向 ${formatDate(stage.endDate, 'long')}。`, meta: '真实刻度摘要', actionLabel: '前往几度', onOpen: () => { setRiverOpen(false); navigateTo('degrees') } })
    return items.slice(0, 5)
  }, [navigateTo, state, today, todayDaily, todayNarration])

  if (!state) {
    if (loadError) return <main className="error-screen" role="alert"><div className="error-symbol">几</div><h1>时间册没有升级</h1><p>{loadError}</p><button className="dark-action" onClick={() => window.location.reload()}>重试打开</button></main>
    return <div className="loading-screen">正在打开你的时间册<span>。</span><span>。</span><span>。</span></div>
  }

  const assetIssueCount = state.assetIssues
    ? new Set([...state.assetIssues.missingAssetIds, ...state.assetIssues.corruptAssetIds, ...state.assetIssues.orphanedAssetIds]).size
    : 0

  return (
    <div className="app-shell" data-page={page} data-world={page} data-theme={state.settings.theme ?? 'light'} data-density={state.settings.displayDensity ?? 'comfortable'}>
      <a className="skip-link" href="#main-content">跳到主内容</a>
      <ModernSidebar page={page} onNavigate={navigateTo} onRecord={() => setRecorder('moment')} name={state.settings.displayName} persistenceStatus={persistenceStatus} />
      <main id="main-content" className="main-column" tabIndex={-1}>
        {assetIssueCount > 0 && <aside className="asset-integrity-notice" role="alert"><strong>照片需要检查</strong><span>启动时发现 {assetIssueCount} 项缺失、损坏或未登记的照片资产。记录和可恢复文件没有自动删除；处理前请避免删除引用这些照片的记录。</span></aside>}
        <div className={`content-frame world-route world-route--${page} world-transition--${getPageTransition(page)}`} data-layout={`layout-${page}`} key={`${page}-${transitionNonce}`}>
          <Suspense fallback={<div className="world-loading" role="status" aria-live="polite">正在打开这个时间页…</div>}>
            {page === 'now' && <NowWorldV29 state={state} onRecord={() => setRecorder('moment')} onOpenMoment={setSelectedMoment} dailyEntry={todayDaily} narration={todayNarration} narrationSaved={Boolean(todayNarrationUse?.saved || todayNarration && state.savedNarrations.some((item) => item.quoteId === todayNarration.id))} dailyEditing={dailyEditing} dailyDraft={dailyDraft} onDailyDraftChange={setDailyDraft} onDailyEdit={() => { setDailyDraft(todayDaily?.text ?? ''); setDailyEditing(true) }} onDailyCancel={() => { setDailyDraft(todayDaily?.text ?? ''); setDailyEditing(false) }} onDailySave={saveDailyEntry} onDailyDelete={() => deleteDailyEntry(today)} onNarrationSave={() => todayNarration && toggleNarrationSaved(todayNarration)} onNarrationCopy={() => todayNarration && void copyNarration(todayNarration)} onNarrationConvert={() => todayNarration && convertNarrationToDaily(todayNarration)} onNarrationSource={() => todayNarration && setNarrationSource(todayNarration)} onNarrationNext={rotateNarration} onOpenRiver={() => setRiverOpen(true)} />}
            {page === 'timeline' && <TimelineWorldV29 onSaveDaily={(entry, text) => saveDailyEntry(text, entry.date)} onDeleteDaily={(entry) => { if (window.confirm(`确定要删除 ${entry.date} 的这一行吗？`)) deleteDailyEntry(entry.date) }} state={state} filter={state.settings.timelineFilter ?? 'all'} scrollTop={timelineScrollTop} onFilterChange={handleTimelineFilterChange} onScrollPositionChange={setTimelineScrollTop} onOpenMoment={setSelectedMoment} onRecord={() => setRecorder('moment')} onOpenRiver={() => setRiverOpen(true)} narration={todayNarration} onNarrationSource={() => todayNarration && setNarrationSource(todayNarration)} />}
            {page === 'degrees' && <DegreesWorldV29 state={state} tab={degreeTab} onTabChange={setDegreeTab} onPinElapsed={(id) => setPinned('pinnedElapsedId', id)} onPinRemaining={(id) => setPinned('pinnedRemainingId', id)} onElapsedDisplayMode={setElapsedDisplayMode} onElapsedSort={setElapsedSort} onShareElapsed={shareElapsed} onShareRemaining={shareRemaining} onEditElapsed={(item) => openRecordEdit('elapsed', item)} onEditRemaining={(item) => openRecordEdit('remaining', item)} onDeleteElapsed={(id) => deleteCounter('elapsed', id)} onDeleteRemaining={(id) => deleteCounter('remaining', id)} onOpenStage={setSelectedStage} onRecord={setRecorder} />}
            {page === 'settings' && <SettingsWorldV31 state={state} recoveryAvailable={recoveryAvailable} backupPassword={backupPassword} onBackupPasswordChange={setBackupPassword} onExportJson={() => void exportJson(state, getAssetStore())} onExportZip={() => void exportZip(state, getAssetStore())} onExportEncrypted={exportEncrypted} onImport={importData} onRestoreSnapshot={restoreRecovery} onResetData={resetData} onLifeProfileChange={setLifeProfile} onAppearanceChange={setAppearance} onNarrationEnabledChange={setNarrationEnabled} />}
          </Suspense>
        </div>
      </main>
      {recorder && <RecordDrawer type={recorder} existingRecord={editingRecord ?? undefined} availablePhotos={state.photos} onClose={() => { setRecorder(null); setEditingRecord(null) }} onChangeType={changeRecorderType} onSave={handleRecord} />}
      {selectedMoment && <MomentDetail moment={selectedMoment} photos={state.photos} isPinned={state.settings.pinnedMomentId === selectedMoment.id} onPin={() => setPinned('pinnedMomentId', selectedMoment.id)} onShare={() => void shareMoment(selectedMoment)} onClose={() => setSelectedMoment(null)} onEdit={() => openMomentEdit(selectedMoment)} onDelete={() => { if (window.confirm('确定要移除这段记录吗？')) deleteMoment(selectedMoment.id) }} />}
      {selectedStage && <StageDetail stage={selectedStage} onClose={() => setSelectedStage(null)} onEdit={() => openRecordEdit('stage', selectedStage)} onToggle={() => updateStage(selectedStage.id, { enabled: !selectedStage.enabled })} onDelete={() => { if (window.confirm('确定要移除这段刻度吗？')) deleteStage(selectedStage.id) }} />}
      {pendingImport && <ImportDialog summary={pendingImport} onCancel={() => setPendingImport(null)} onChoose={finishImport} />}
      {riverOpen && <RiverDriftOverlay items={riverItems} onClose={() => setRiverOpen(false)} />}
      {narrationSource && <NarrationSourceDialog copy={narrationSource} onClose={() => setNarrationSource(null)} />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  )
}

function Sidebar({ page, onNavigate, onRecord, name }: { page: PageId; onNavigate: (page: PageId) => void; onRecord: () => void; name: string }): ReactElement {
  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <div className="brand-mark">几</div>
        <div>
          <div className="brand-name">几度</div>
          <div className="brand-subtitle">Memento</div>
        </div>
      </div>

      <nav className="primary-nav" aria-label="主导航">
        <span className="nav-label">我的时间</span>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`nav-item ${page === id ? 'is-active' : ''}`} aria-label={label} aria-current={page === id ? 'page' : undefined} onClick={() => onNavigate(id)}>
            <Icon size={17} strokeWidth={1.8} />
            <span>{label}</span>
            {page === id && <span className="active-dot" aria-hidden="true" />}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <button className="record-button" aria-label="记一笔" onClick={onRecord}>
          <Plus size={17} strokeWidth={2} />
          <span>记录此刻</span>
        </button>
        <div className="profile-row">
          <div className="profile-avatar">{name.slice(0, 1)}</div>
          <div className="profile-copy">
            <strong>{name}</strong>
            <span>本地时间册</span>
          </div>
          <Settings2 size={16} className="profile-setting" />
        </div>
      </div>
    </aside>
  )
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }): ReactElement {
  return (
    <header className="page-intro">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  )
}

















function ModernSidebar({ page, onNavigate, onRecord, name, persistenceStatus }: { page: PageId; onNavigate: (page: PageId) => void; onRecord: () => void; name: string; persistenceStatus: PersistenceStatus }): ReactElement {
  const persistenceLabel = persistenceStatus === 'saving' ? '正在保存' : persistenceStatus === 'recovering' ? '正在修复' : persistenceStatus === 'error' ? '保存失败' : '已保存'
  return (
    <aside className={`sidebar modern-sidebar sidebar--${page}`} data-nav-world={page} data-sidebar-world={page}>
      <div className="rail-header">
        <div className="brand-mark" aria-hidden="true">几</div>
        <span className="brand-word">MEMENTO</span>
      </div>
      <nav className="primary-nav" aria-label="主导航">
        {NAV_ITEMS.map(({ id, label, icon: Icon }, index) => (
          <button key={id} className={`nav-item ${page === id ? 'is-active' : ''}`} aria-label={label} aria-current={page === id ? 'page' : undefined} onClick={() => onNavigate(id)}>
            <span className="nav-index">0{index + 1}</span>
            <Icon size={17} strokeWidth={1.6} />
            <span>{label}</span>
            {page === id && <span className="active-dot" aria-hidden="true" />}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button className="record-button" aria-label="记一笔" onClick={onRecord}>
          <Plus size={18} strokeWidth={1.8} />
          <span>记一笔</span>
        </button>
        <div className="profile-row">
          <div className="profile-avatar">{name.slice(0, 1) || '我'}</div>
          <span className="profile-caption">LOCAL<br />ARCHIVE</span>
          <span className={`persistence-dot persistence-dot--${persistenceStatus}`} role="status" aria-label={persistenceLabel} title={persistenceLabel} />
          <Settings2 size={14} className="profile-setting" aria-hidden="true" />
        </div>
      </div>
    </aside>
  )
}













function PanelHeading({ label, icon }: { label: string; icon: ReactNode }): ReactElement { return <div className="panel-heading"><span>{icon}{label}</span><MoreHorizontal size={17} /></div> }
function EmptyInline({ text }: { text: string }): ReactElement { return <div className="empty-inline"><span>{text}</span><Plus size={16} /></div> }

function Stat({ value, label }: { value: number | string; label: string }): ReactElement { return <div className="stat"><strong>{value}</strong><span>{label}</span></div> }















type PointerEffect = 'darkroom' | 'film' | 'instrument' | 'ledger'

function PointerField({ effect, children }: { effect: PointerEffect; children: ReactNode }): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number | null>(null)
  const targetRef = useRef({ x: 0.5, y: 0.5 })
  const currentRef = useRef({ x: 0.5, y: 0.5 })

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
  }, [])

  const renderPointer = () => {
    const root = rootRef.current
    if (!root) {
      frameRef.current = null
      return
    }
    const target = targetRef.current
    const current = currentRef.current
    current.x += (target.x - current.x) * 0.12
    current.y += (target.y - current.y) * 0.12
    root.style.setProperty('--pointer-x', `${current.x * root.clientWidth}px`)
    root.style.setProperty('--pointer-y', `${current.y * root.clientHeight}px`)
    if (Math.abs(target.x - current.x) > 0.001 || Math.abs(target.y - current.y) > 0.001) {
      frameRef.current = window.requestAnimationFrame(renderPointer)
    } else {
      frameRef.current = null
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const rect = event.currentTarget.getBoundingClientRect()
    targetRef.current = { x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)), y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)) }
    if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(renderPointer)
  }

  const handlePointerLeave = () => {
    targetRef.current = { x: 0.5, y: 0.5 }
    if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(renderPointer)
  }

  return <div ref={rootRef} className={`pointer-field pointer-field--${effect}`} onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave} style={{ '--pointer-x': '50%', '--pointer-y': '50%' } as CSSProperties}>
    <span className="pointer-field-glow" aria-hidden="true" />
    <span className="pointer-field-contour" aria-hidden="true" />
    <span className="pointer-field-scan" aria-hidden="true" />
    <div className="pointer-field-content">{children}</div>
  </div>
}

























export default function AppRoot(): ReactElement {
  return <AppErrorBoundary><App /></AppErrorBoundary>
}
