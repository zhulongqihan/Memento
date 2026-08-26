import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ErrorInfo, FormEvent, ReactElement, ReactNode } from 'react'
import {
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  CalendarDays,
  CircleHelp,
  ChevronRight,
  Clock3,
  ImagePlus,
  KeyRound,
  Layers3,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Settings2,
  Share2,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { exportEncryptedBackup, exportJson, exportZip, parseBackup } from './data/backup'
import { clearRecoverySnapshot, loadRecoverySnapshot, loadState, saveRecoverySnapshot, saveState } from './data/repository'
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
  MomentKind,
  NumberFormat,
  PageId,
  PhotoAsset,
  RemainingCounter,
  RemainingUnit,
  Stage,
  ThemeMode,
  TimelineFilter,
  VisualNarrative,
} from './domain/types'
import { mergeState } from './data/merge'
import { pickPinned } from './domain/preferences'
import springSample from '../docs/design/assets/seasonal-samples/spring-rain-window.png'
import summerSample from '../docs/design/assets/seasonal-samples/summer-courtyard-table.png'
import autumnSample from '../docs/design/assets/seasonal-samples/autumn-riverside-shadow.png'
import winterSample from '../docs/design/assets/seasonal-samples/winter-night-lane.png'
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
  getLifeProgress,
  getMonthLabel,
  getRemainingDates,
  getStageProgress,
  getWeekdayLabel,
  getYearProgress,
  isValidIsoDate,
  shiftIsoDate,
  todayIso,
} from './domain/time'

type RecorderType = 'moment' | 'elapsed' | 'remaining' | 'stage'
type PageTransition = 'now-curtain' | 'timeline-film' | 'degrees-dial' | 'settings-document'
type SettingsSectionId = 'data' | 'life' | 'appearance' | 'about'

interface RecordDraft {
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
  photos: PhotoAsset[]
}

type EditableRecord = Moment | ElapsedCounter | RemainingCounter | Stage

const NAV_ITEMS: Array<{ id: PageId; label: string; icon: LucideIcon }> = [
  { id: 'now', label: '此刻', icon: Clock3 },
  { id: 'timeline', label: '时光', icon: BookOpen },
  { id: 'degrees', label: '几度', icon: Layers3 },
  { id: 'settings', label: '我的', icon: UserRound },
]

const KIND_LABELS: Record<MomentKind, string> = {
  first: '初见',
  yearly_first: '今年第一次',
  milestone: '人生节点',
}

// 旧备份与未迁移的历史组件仍需要这些类型映射完成编译；新路由不读取它们来决定页面布局。
const VISUAL_NARRATIVE_OPTIONS: Array<{ id: VisualNarrative; label: string; description: string; season: string }> = [
  { id: 'archive', label: '典藏', description: '把时间装订成一册安静的档案。', season: '常规' },
  { id: 'light', label: '光影', description: '让记录在光线里慢慢显影。', season: '春夏' },
  { id: 'instrument', label: '刻度', description: '用清晰的结构测量时间。', season: '秋冬' },
]
const SEASON_SAMPLES = [
  { name: '春', page: '此刻', src: springSample },
  { name: '夏', page: '时光', src: summerSample },
  { name: '秋', page: '几度', src: autumnSample },
  { name: '冬', page: '我的', src: winterSample },
]

const UNIT_LABELS: Record<RemainingUnit, string> = {
  friday: '周五',
  saturday: '周六',
  sunday: '周日',
  weekend: '周末',
  custom: '自定义星期',
}

const RECORD_TYPE_HELP: Record<RecorderType, string> = {
  moment: '记下一天发生过的事，适合留下一个时刻。',
  elapsed: '从某个开始日期起，看看这段时间已经走了多久。',
  remaining: '设定截止日期，统计那之前还会遇到多少个指定日子。',
  stage: '填写开始和结束日期，看看一个阶段已经走到哪里。',
}

const DEGREE_TAB_NOTES: Record<DegreeTab, string> = {
  elapsed: '已经走过的时间',
  remaining: '还可以遇见的日子',
  stage: '正在经过的阶段',
}

const REMAINING_UNIT_HELP = '选择你想数的日子：比如“周五”会计算截止日期前还剩多少个周五；“周末”会计算周六和周日；“自定义星期”可以自己选择。'

const MOMENT_KIND_HELP = '给这个时刻一个轻巧的归类，方便以后在时光里寻找；不影响日期和内容。'

const WEEKDAY_CHOICES: Array<[number, string]> = [[1, '一'], [2, '二'], [3, '三'], [4, '四'], [5, '五'], [6, '六'], [0, '日']]

function getPageTransition(page: PageId): PageTransition {
  return page === 'now' ? 'now-curtain' : page === 'timeline' ? 'timeline-film' : page === 'degrees' ? 'degrees-dial' : 'settings-document'
}

function makeId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  return `${prefix}-${random}`
}

function HelpHint({ id, label, text }: { id: string; label: string; text: string }): ReactElement {
  return <span className="field-help-inline"><span>{label}</span><button type="button" aria-label={`解释“${label}”`} aria-describedby={id}><CircleHelp size={14} strokeWidth={1.7} aria-hidden="true" /></button><span id={id} className="field-help-tooltip" role="tooltip">{text}</span></span>
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
  const navigateTo = useCallback((nextPage: PageId) => {
    if (page === nextPage) return
    setTransitionNonce((nonce) => nonce + 1)
    setPage(nextPage)
  }, [page])

  useEffect(() => {
    void Promise.all([loadState(), loadRecoverySnapshot()]).then(([loadedState, snapshot]) => {
      setState(loadedState)
      setRecoveryAvailable(Boolean(snapshot))
    })
  }, [])

  useEffect(() => {
    if (state) void saveState(state).catch((error) => console.warn('Unable to persist app state.', error))
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
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pendingImport, recorder, selectedMoment, selectedStage])

  useEffect(() => {
    const overlayOpen = Boolean(pendingImport || recorder || selectedMoment || selectedStage)
    if (!overlayOpen) return
    const previousBodyOverflow = document.body.style.overflow
    const previousDocumentOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousDocumentOverflow
    }
  }, [pendingImport, recorder, selectedMoment, selectedStage])

  const updateState = useCallback((updater: (current: AppState) => AppState) => {
    setState((current) => (current ? updater(current) : current))
  }, [])

  const handleRecord = useCallback((draft: RecordDraft) => {
    const timestamp = new Date().toISOString()
    updateState((current) => {
      if (draft.type === 'moment') {
        const photoIds = draft.photos.map((photo) => photo.id)
        const existingId = draft.existingId ?? draft.existingMomentId
        if (existingId) {
          const existing = current.moments.find((item) => item.id === existingId)
          if (!existing) return current
          const activePhotoIds = new Set(photoIds)
          const retainedPhotos = current.photos.filter((photo) => !existing.photoIds.includes(photo.id) || activePhotoIds.has(photo.id))
          const mergedPhotos = [...retainedPhotos, ...draft.photos.filter((photo) => !retainedPhotos.some((item) => item.id === photo.id))]
          const updated: Moment = {
            ...existing,
            kind: draft.momentKind,
            title: draft.title.trim(),
            date: draft.date,
            note: draft.note.trim() || undefined,
            location: draft.location.trim() || undefined,
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
        return { ...current, moments: [moment, ...current.moments], photos: [...current.photos, ...draft.photos] }
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
    if (!pendingImport) return
    try {
      if (mode === 'merge') {
        updateState((current) => mergeState(current, pendingImport.data))
      } else {
        if (!state) return
        await saveRecoverySnapshot(state)
        setRecoveryAvailable(true)
        updateState(() => pendingImport.data)
      }
      setNotice(mode === 'merge' ? `已合并 ${pendingImport.momentCount} 条记录。` : `已恢复 ${pendingImport.momentCount} 条记录；替换前快照已保留。`)
      setPendingImport(null)
    } catch (error) {
      setNotice(error instanceof Error ? `替换前快照保存失败：${error.message}` : '替换前快照保存失败，未覆盖本机数据。')
    }
  }, [pendingImport, state, updateState])

  const restoreRecovery = useCallback(async () => {
    try {
      const snapshot = await loadRecoverySnapshot()
      if (!snapshot) {
        setNotice('没有找到可恢复的替换前快照。')
        return
      }
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
      updateState(() => createEmptyState())
      setSelectedMoment(null)
      setSelectedStage(null)
      setPendingImport(null)
      setEditingRecord(null)
      setRecorder(null)
      setNotice('已清空当前时间册；清空前快照可以在这里恢复。')
    } catch (error) {
      setNotice(error instanceof Error ? `清空前快照保存失败：${error.message}` : '清空前快照保存失败，未删除当前数据。')
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

  const handleTimelineFilterChange = useCallback((filter: TimelineFilter) => {
    updateState((current) => ({ ...current, settings: { ...current.settings, timelineFilter: filter } }))
    setTimelineScrollTop(0)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [updateState])

  if (!state) {
    return <div className="loading-screen">正在打开你的时间册<span>。</span><span>。</span><span>。</span></div>
  }

  return (
    <div className="app-shell" data-page={page} data-world={page} data-theme={state.settings.theme ?? 'light'} data-density={state.settings.displayDensity ?? 'comfortable'} data-visual-narrative={state.settings.visualNarrative ?? 'archive'} data-visual-story={state.settings.visualNarrative ?? 'archive'}>
      <ModernSidebar page={page} onNavigate={navigateTo} onRecord={() => setRecorder('moment')} name={state.settings.displayName} />
      <main className="main-column">
        <div className={`content-frame world-route world-route--${page} world-transition--${getPageTransition(page)}`} data-layout={`layout-${page}`} key={`${page}-${transitionNonce}`}>
          {page === 'now' && <NowWorldV28 state={state} onRecord={() => setRecorder('moment')} onOpenMoment={setSelectedMoment} />}
          {page === 'timeline' && <TimelineWorldV28 state={state} filter={state.settings.timelineFilter ?? 'all'} scrollTop={timelineScrollTop} onFilterChange={handleTimelineFilterChange} onScrollPositionChange={setTimelineScrollTop} onOpenMoment={setSelectedMoment} onRecord={() => setRecorder('moment')} />}
          {page === 'degrees' && <DegreesWorldV28 state={state} tab={degreeTab} onTabChange={setDegreeTab} onPinElapsed={(id) => setPinned('pinnedElapsedId', id)} onPinRemaining={(id) => setPinned('pinnedRemainingId', id)} onElapsedDisplayMode={setElapsedDisplayMode} onElapsedSort={setElapsedSort} onShareElapsed={shareElapsed} onShareRemaining={shareRemaining} onEditElapsed={(item) => openRecordEdit('elapsed', item)} onEditRemaining={(item) => openRecordEdit('remaining', item)} onOpenStage={setSelectedStage} onRecord={setRecorder} />}
          {page === 'settings' && <SettingsWorldV28 state={state} recoveryAvailable={recoveryAvailable} backupPassword={backupPassword} onBackupPasswordChange={setBackupPassword} onExportJson={() => void exportJson(state)} onExportZip={() => void exportZip(state)} onExportEncrypted={exportEncrypted} onImport={importData} onRestoreSnapshot={restoreRecovery} onResetData={resetData} onLifeProfileChange={setLifeProfile} onAppearanceChange={setAppearance} />}
        </div>
      </main>
      {recorder && <RecordDrawer type={recorder} existingRecord={editingRecord ?? undefined} availablePhotos={state.photos} onClose={() => { setRecorder(null); setEditingRecord(null) }} onChangeType={changeRecorderType} onSave={handleRecord} />}
      {selectedMoment && <MomentDetail moment={selectedMoment} photos={state.photos} isPinned={state.settings.pinnedMomentId === selectedMoment.id} onPin={() => setPinned('pinnedMomentId', selectedMoment.id)} onShare={() => void shareMoment(selectedMoment)} onClose={() => setSelectedMoment(null)} onEdit={() => openMomentEdit(selectedMoment)} onDelete={() => { if (window.confirm('确定要移除这段记录吗？')) deleteMoment(selectedMoment.id) }} />}
      {selectedStage && <StageDetail stage={selectedStage} onClose={() => setSelectedStage(null)} onEdit={() => openRecordEdit('stage', selectedStage)} onToggle={() => updateStage(selectedStage.id, { enabled: !selectedStage.enabled })} onDelete={() => { if (window.confirm('确定要移除这段刻度吗？')) deleteStage(selectedStage.id) }} />}
      {pendingImport && <ImportDialog summary={pendingImport} onCancel={() => setPendingImport(null)} onChoose={finishImport} />}
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

function NowPage({ state, onRecord, onOpenMoment }: { state: AppState; onRecord: () => void; onOpenMoment: (moment: Moment) => void }): ReactElement {
  const today = todayIso()
  const yearProgress = getYearProgress(today)
  const year = today.slice(0, 4)
  const elapsed = pickPinned(state.elapsed, state.settings.pinnedElapsedId)
  const remaining = pickPinned(state.remaining, state.settings.pinnedRemainingId)
  const memory = pickPinned(state.moments, state.settings.pinnedMomentId) ?? state.moments.find((moment) => moment.date < today)
  const elapsedDisplay = getElapsedDisplay(elapsed ? getElapsedBreakdown(elapsed.startDate) : { days: 0, weeks: 0, months: 0, years: 0 }, state.settings.elapsedDisplayMode ?? 'days')
  const remainingDates = remaining ? getRemainingDates(remaining.endDate, remaining.unit, today, remaining.weekdays) : []

  return (
    <div className="page page-now">
      <PageIntro eyebrow={formatDateWithWeekday(today)} title="此刻" description="今天，也在时间里。" action={<button className="quiet-action" onClick={onRecord}><Plus size={16} />记录</button>} />
      <section className="year-panel" aria-label="年度进度">
        <div className="panel-kicker">{year} · 这一年</div>
        <div className="year-panel-main">
          <div className="year-number">{yearProgress.toFixed(1)}<span>%</span></div>
          <div className="year-copy">
            <strong>已经走过</strong>
            <span>还剩 {getDaysRemainingInYear(today)} 天，时间正在经过这里。</span>
          </div>
        </div>
        <div className="progress-rail"><span style={{ transform: `scaleX(${yearProgress / 100})` }} /></div>
      </section>

      <div className="feature-grid">
        <section className="feature-panel elapsed-panel">
          <PanelHeading label="经年" icon={<Clock3 size={15} />} />
          {elapsed ? <>
            <div className="feature-title">{elapsed.title}</div>
            <div className="feature-number">{formatDisplayNumber(elapsedDisplay.value, state.settings.numberFormat ?? 'plain')}<small>{elapsedDisplay.unit}</small></div>
            <div className="feature-meta">{formatDate(elapsed.startDate, 'short')} — 至今</div>
            <p className="feature-caption">原来已经这么久了。</p>
          </> : <EmptyInline text="还没有一段经年" />}
        </section>
        <section className="feature-panel remaining-panel">
          <PanelHeading label="余下" icon={<CalendarDays size={15} />} />
          {remaining ? <>
            <div className="feature-title">{remaining.title}</div>
            <div className="feature-number">{formatDisplayNumber(remainingDates.length, state.settings.numberFormat ?? 'plain')}<small>{formatCounterUnit(remaining.unit)}</small></div>
            <div className="feature-meta">下一次 · {remainingDates[0] ? formatDate(remainingDates[0].date, 'short') : '已经到了'}</div>
            <p className="feature-caption">看看剩下来的那些日子。</p>
          </> : <EmptyInline text="还没有一段余下" />}
        </section>
      </div>

      {memory && <button className="memory-panel" onClick={() => onOpenMoment(memory)}>
        <div className="memory-side">{formatRelative(memory.date, today)}</div>
        <div className="memory-content">
          <div className="panel-kicker">{KIND_LABELS[memory.kind]}</div>
          <h2>{memory.title}</h2>
          <p>{memory.note || '有些日子，后来才知道值得记住。'}</p>
          <span>{formatDate(memory.date, 'short')} {memory.location ? `· ${memory.location}` : ''}</span>
        </div>
        <ChevronRight size={19} className="memory-arrow" />
      </button>}
    </div>
  )
}

function TimelinePage({ state, filter, scrollTop, onFilterChange, onScrollPositionChange, onOpenMoment, onRecord }: { state: AppState; filter: TimelineFilter; scrollTop: number; onFilterChange: (filter: TimelineFilter) => void; onScrollPositionChange: (value: number) => void; onOpenMoment: (moment: Moment) => void; onRecord: () => void }): ReactElement {
  const currentYear = todayIso().slice(0, 4)
  const moments = useMemo(() => [...state.moments]
    .filter((moment) => filter === 'all' || (filter === 'this_year' ? moment.date.startsWith(currentYear) : moment.kind === filter))
    .sort((a, b) => b.date.localeCompare(a.date)), [currentYear, filter, state.moments])
  useEffect(() => {
    window.scrollTo({ top: scrollTop, behavior: 'auto' })
    return () => onScrollPositionChange(window.scrollY)
  }, [onScrollPositionChange, scrollTop])
  const groups = moments.reduce<Record<string, Moment[]>>((result, moment) => {
    const key = moment.date.slice(0, 7)
    result[key] = [...(result[key] ?? []), moment]
    return result
  }, {})

  return (
    <div className="page page-timeline">
      <PageIntro eyebrow="一生的时间轴" title="时光" description="把发生过的事情，放回它们经过的年月。" action={<button className="quiet-action" onClick={onRecord}><Plus size={16} />记录</button>} />
      <div className="filter-row" role="tablist" aria-label="时间轴筛选">
        {([['all', '全部'], ['first', '初见'], ['yearly_first', '今年第一次'], ['milestone', '人生节点'], ['this_year', '今年']] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={filter === id} className={`filter-chip ${filter === id ? 'is-selected' : ''}`} onClick={() => onFilterChange(id)}>{label}</button>)}
      </div>
      <div className="timeline-list">
        {Object.entries(groups).map(([month, monthMoments]) => (
          <section className="timeline-month" key={month}>
            <div className="month-label"><strong>{month.slice(0, 4)}</strong><span>{getMonthLabel(`${month}-01`)}</span></div>
            <div className="month-entries">
              {monthMoments.map((moment) => <button className="timeline-entry" key={moment.id} onClick={() => onOpenMoment(moment)}>
                <span className="timeline-node" />
                <span className="timeline-date">{formatDate(moment.date, 'short')}</span>
                <span className="timeline-copy"><strong>{moment.title}</strong><span>{KIND_LABELS[moment.kind]}{moment.location ? ` · ${moment.location}` : ''}</span></span>
                <ChevronRight size={17} className="entry-arrow" />
              </button>)}
            </div>
          </section>
        ))}
        {moments.length === 0 && <EmptyState title="还没有一段时光" text="从一件最近发生的小事开始。" action={onRecord} />}
      </div>
    </div>
  )
}

function DegreesPage({ state, tab, onTabChange, onPinElapsed, onPinRemaining, onElapsedDisplayMode, onElapsedSort, onShareElapsed, onShareRemaining, onEditElapsed, onEditRemaining, onOpenStage, onRecord }: { state: AppState; tab: DegreeTab; onTabChange: (tab: DegreeTab) => void; onPinElapsed: (id: string) => void; onPinRemaining: (id: string) => void; onElapsedDisplayMode: (mode: ElapsedDisplayMode) => void; onElapsedSort: (sort: ElapsedSort) => void; onShareElapsed: (item: ElapsedCounter) => void; onShareRemaining: (item: RemainingCounter) => void; onEditElapsed: (item: ElapsedCounter) => void; onEditRemaining: (item: RemainingCounter) => void; onOpenStage: (stage: Stage) => void; onRecord: (type: RecorderType) => void }): ReactElement {
  return (
    <div className={`page page-degrees degree-page--${tab}`}>
      <PageIntro eyebrow="时间的三种方向" title="几度" description="已经走了多少，还能看见多少。" />
      <div className="degree-tabs" role="tablist" aria-label="时间方向">
        <span className="degree-tabs-lead">ORIENTATIONS</span>
        {([['elapsed', '经年'], ['remaining', '余下'], ['stage', '刻度']] as const).map(([id, label], index) => <button key={id} role="tab" aria-selected={tab === id} aria-label={`${label}，${DEGREE_TAB_NOTES[id]}`} title={DEGREE_TAB_NOTES[id]} className={tab === id ? 'is-selected' : ''} onClick={() => onTabChange(id)}><span>0{index + 1}</span><strong>{label}</strong><small>{DEGREE_TAB_NOTES[id]}</small></button>)}
      </div>
      {tab === 'elapsed' && <ElapsedList state={state} pinnedId={state.settings.pinnedElapsedId} displayMode={state.settings.elapsedDisplayMode ?? 'days'} sort={state.settings.elapsedSort ?? 'recent'} onPin={onPinElapsed} onShare={onShareElapsed} onEdit={onEditElapsed} onDisplayModeChange={onElapsedDisplayMode} onSortChange={onElapsedSort} onRecord={() => onRecord('elapsed')} />}
      {tab === 'remaining' && <RemainingList state={state} pinnedId={state.settings.pinnedRemainingId} onPin={onPinRemaining} onShare={onShareRemaining} onEdit={onEditRemaining} onRecord={() => onRecord('remaining')} />}
      {tab === 'stage' && <StageList state={state} onOpenStage={onOpenStage} onRecord={() => onRecord('stage')} />}
    </div>
  )
}

function ElapsedList({ state, pinnedId, displayMode, sort, onPin, onShare, onEdit, onDisplayModeChange, onSortChange, onRecord }: { state: AppState; pinnedId?: string; displayMode: ElapsedDisplayMode; sort: ElapsedSort; onPin: (id: string) => void; onShare: (item: ElapsedCounter) => void; onEdit: (item: ElapsedCounter) => void; onDisplayModeChange: (mode: ElapsedDisplayMode) => void; onSortChange: (sort: ElapsedSort) => void; onRecord: () => void }): ReactElement {
  const items = useMemo(() => [...state.elapsed].sort((a, b) => {
    if (sort === 'oldest') return a.startDate.localeCompare(b.startDate)
    if (sort === 'longest') return getElapsedBreakdown(b.startDate).days - getElapsedBreakdown(a.startDate).days
    return b.updatedAt.localeCompare(a.updatedAt)
  }), [sort, state.elapsed])
  const controls = <div className="elapsed-controls"><div className="segmented-control" role="group" aria-label="经年显示单位">{([['days', '天'], ['weeks', '周'], ['months', '月'], ['years', '年']] as const).map(([id, label]) => <button key={id} className={displayMode === id ? 'is-selected' : ''} onClick={() => onDisplayModeChange(id)}>{label}</button>)}</div><select aria-label="经年排序" value={sort} onChange={(event) => onSortChange(event.target.value as ElapsedSort)}><option value="recent">最近编辑</option><option value="oldest">开始最早</option><option value="longest">经过最长</option></select></div>
  return <DegreeListShell variant="elapsed" title="已经经过的时间" action={onRecord} controls={controls} empty={state.elapsed.length === 0} emptyText="还没有一段经年。">
    {items.map((item) => {
      const breakdown = getElapsedBreakdown(item.startDate)
      const display = getElapsedDisplay(breakdown, displayMode)
      return <article className="degree-row" key={item.id}><div><span className="row-label">{formatDate(item.startDate, 'short')} — 至今</span><h2>{item.title}</h2></div><div className="row-number">{display.value}<small>{display.unit}</small></div><div className="row-actions"><button className={`pin-button ${pinnedId === item.id ? 'is-pinned' : ''}`} onClick={() => onPin(item.id)} aria-label={pinnedId === item.id ? '取消置顶' : '置顶'}><Pin size={16} /></button><button className="share-button" onClick={() => onShare(item)} aria-label="生成经年分享卡"><Share2 size={16} /></button><button className="share-button" onClick={() => onEdit(item)} aria-label={`编辑${item.title}`}><Pencil size={16} /></button></div></article>
    })}
  </DegreeListShell>
}

function RemainingList({ state, pinnedId, onPin, onShare, onEdit, onRecord }: { state: AppState; pinnedId?: string; onPin: (id: string) => void; onShare: (item: RemainingCounter) => void; onEdit: (item: RemainingCounter) => void; onRecord: () => void }): ReactElement {
  const items = useMemo(() => [...state.remaining].sort((a, b) => a.endDate.localeCompare(b.endDate)), [state.remaining])
  return <DegreeListShell variant="remaining" title="还剩下的具体日子" action={onRecord} empty={state.remaining.length === 0} emptyText="还没有一段余下。">
    {items.map((item) => {
      const dates = getRemainingDates(item.endDate, item.unit, todayIso(), item.weekdays)
      return <article className="degree-row" key={item.id}><div><span className="row-label">截止 · {formatDate(item.endDate, 'short')}</span><h2>{item.title}</h2><span className="row-caption">下一次 · {dates[0] ? `${formatDate(dates[0].date, 'short')} ${getWeekdayLabel(dates[0].date)}` : '已经到了'}</span><div className="remaining-date-list" aria-label={`${item.title} 接下来日期`}>{dates.slice(0, 5).map((date) => <span className="remaining-date" key={date.date}>{formatDate(date.date, 'short')} <small>{getWeekdayLabel(date.date)}</small></span>)}{dates.length > 5 && <span className="remaining-more">+{dates.length - 5} 个</span>}</div></div><div className="row-number">{dates.length}<small>{formatCounterUnit(item.unit)}</small></div><div className="row-actions"><button className={`pin-button ${pinnedId === item.id ? 'is-pinned' : ''}`} onClick={() => onPin(item.id)} aria-label={pinnedId === item.id ? '取消置顶' : '置顶'}><Pin size={16} /></button><button className="share-button" onClick={() => onShare(item)} aria-label="生成余下分享卡"><Share2 size={16} /></button><button className="share-button" onClick={() => onEdit(item)} aria-label={`编辑${item.title}`}><Pencil size={16} /></button></div></article>
    })}
  </DegreeListShell>
}

function StageList({ state, onOpenStage, onRecord }: { state: AppState; onOpenStage: (stage: Stage) => void; onRecord: () => void }): ReactElement {
  const stages = useMemo(() => {
    const regularStages = state.stages.filter((stage) => stage.enabled).sort((a, b) => a.startDate.localeCompare(b.startDate))
    if (!state.settings.displayLifeProgress || !state.settings.birthDate || !state.settings.lifeExpectancyYears) return regularStages
    const lifeStage: Stage = { id: 'stage-life-progress', kind: 'life', title: '人生进度', startDate: state.settings.birthDate, endDate: getLifeEndDate(state.settings.birthDate, state.settings.lifeExpectancyYears), enabled: true, createdAt: state.settings.birthDate, updatedAt: state.settings.birthDate }
    return [lifeStage, ...regularStages]
  }, [state.settings.birthDate, state.settings.displayLifeProgress, state.settings.lifeExpectancyYears, state.stages])

  return <DegreeListShell variant="stage" title="正在经过的阶段" action={onRecord} empty={stages.length === 0} emptyText="还没有一段刻度。">
    {stages.map((item) => {
      const progress = item.kind === 'life' ? getLifeProgress(item.startDate, state.settings.lifeExpectancyYears ?? 80) : getStageProgress(item.startDate, item.endDate)
      return <button className="stage-row stage-row-button" key={item.id} onClick={() => onOpenStage(item)} aria-label={`查看${item.title}阶段详情`}><div className="stage-row-head"><div><span className="row-label">{item.kind === 'life' ? `${formatDate(item.startDate, 'long')} — ${formatDate(item.endDate, 'long')}` : `${formatDate(item.startDate, 'short')} — ${formatDate(item.endDate, 'short')}`}</span><h2>{item.title}</h2></div><strong>{progress.toFixed(1)}%</strong></div><div className="progress-rail"><span style={{ transform: `scaleX(${progress / 100})` }} /></div><span className="stage-caption">{item.kind === 'life' ? '按照你的预期年限，时间走到这里。' : '时间走到这里。'}</span></button>
    })}
  </DegreeListShell>
}

function DegreeListShell({ variant, title, action, controls, empty, emptyText, children }: { variant?: DegreeTab; title: string; action: () => void; controls?: ReactNode; empty: boolean; emptyText: string; children: ReactNode }): ReactElement {
  return <section className={`degree-list-shell degree-list-shell--${variant ?? 'default'}`}><div className="section-heading"><div><span className="eyebrow">几度</span><h2>{title}</h2></div><div className="heading-actions">{controls}<button className="icon-text-button" onClick={action}><Plus size={16} />新建</button></div></div>{empty ? <EmptyState title={emptyText} text="从一个明确的日期开始，给时间一个名字。" action={action} /> : <div className="degree-list">{children}</div>}</section>
}

function SettingsPage({ state, recoveryAvailable, onExportJson, onExportZip, onExportEncrypted, onImport, onRestoreSnapshot, onResetData, onLifeProfileChange, onAppearanceChange }: { state: AppState; recoveryAvailable: boolean; onExportJson: () => void; onExportZip: () => void; onExportEncrypted: (password: string) => void | Promise<void>; onImport: (file: File, password: string) => void; onRestoreSnapshot: () => void; onResetData: () => void | Promise<void>; onLifeProfileChange: (patch: { displayLifeProgress?: boolean; birthDate?: string; lifeExpectancyYears?: number }) => void; onAppearanceChange: (patch: { theme?: ThemeMode; displayDensity?: DisplayDensity; numberFormat?: NumberFormat }) => void }): ReactElement {
  const fileInputId = 'backup-import'
  const [backupPassword, setBackupPassword] = useState('')
  const passwordReady = backupPassword.trim().length >= 8
  return <div className="page page-settings">
    <PageIntro eyebrow="只属于你的资料" title="我的" description="你的记录保存在这台电脑上。" />
    <div className="settings-layout">
      <section className="profile-card"><div className="large-avatar">{state.settings.displayName.slice(0, 1)}</div><div><span className="eyebrow">我的时间册</span><h2>{state.settings.displayName}</h2><p>一份还在继续的个人档案。</p></div></section>
      <section className="stats-strip"><Stat value={formatDisplayNumber(state.moments.length, state.settings.numberFormat ?? 'plain')} label="个时刻" /><Stat value={formatDisplayNumber(state.elapsed.length, state.settings.numberFormat ?? 'plain')} label="段经年" /><Stat value={formatDisplayNumber(state.remaining.length, state.settings.numberFormat ?? 'plain')} label="段余下" /><Stat value={formatDisplayNumber(state.stages.length, state.settings.numberFormat ?? 'plain')} label="段刻度" /></section>
      <section className="settings-section"><div className="section-heading"><div><span className="eyebrow">数据</span><h2>带走你的时间</h2></div><Archive size={22} strokeWidth={1.5} /></div><p className="section-note">完整备份会包含记录与照片，可以在另一台电脑恢复。替换导入和清空数据前都会自动保留一份本地快照。</p><form className="encrypted-backup-row" aria-label="加密备份" onSubmit={(event) => { event.preventDefault(); if (passwordReady) void onExportEncrypted(backupPassword) }}><label>备份密码 <span className="optional">加密导出或导入时使用</span><input name="backupPassword" autoComplete="new-password" type="password" minLength={8} value={backupPassword} onChange={(event) => setBackupPassword(event.target.value)} placeholder="至少 8 个字符" /></label><button type="submit" className="dark-action" disabled={!passwordReady}><KeyRound size={16} />导出加密备份</button></form><p className="encrypted-backup-note">加密备份使用 AES-GCM 保护，并带有完整性校验。导入 `.memento` 文件时会使用这里的密码。</p><div className="data-actions"><button className="outline-action" onClick={onExportJson}><ArrowDownToLine size={16} />导出 JSON</button><button className="outline-action" onClick={onExportZip}><Archive size={16} />导出完整 ZIP</button><button type="button" className="outline-action" onClick={() => document.getElementById(fileInputId)?.click()}><ArrowUpFromLine size={16} />导入备份</button><input hidden id={fileInputId} type="file" accept=".json,.zip,.memento,application/json,application/zip,application/octet-stream" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file, backupPassword); event.currentTarget.value = '' }} />{recoveryAvailable && <button className="outline-action" onClick={onRestoreSnapshot}><ArrowUpFromLine size={16} />恢复替换前快照</button>}<button className="outline-action danger-action" onClick={() => { if (window.confirm('清空后会删除当前时间册里的所有记录和照片，但会先保留一份可恢复快照。确定继续吗？')) void onResetData() }}>清空全部数据</button></div>{recoveryAvailable && <p className="recovery-note" role="status">这里有一份替换导入或清空前的本地恢复快照。</p>}</section>
      <section className="settings-section life-settings"><div className="section-heading"><div><span className="eyebrow">可选刻度</span><h2>人生进度</h2></div><Layers3 size={22} strokeWidth={1.5} /></div><p className="section-note">只有你主动填写生日和预期年限后，才会在“刻度”里显示这条进度。</p><label className="setting-toggle"><input type="checkbox" checked={state.settings.displayLifeProgress} onChange={(event) => onLifeProfileChange({ displayLifeProgress: event.target.checked })} /><span>显示人生进度</span></label><div className="life-fields"><label>生日<input type="date" value={state.settings.birthDate ?? ''} onChange={(event) => onLifeProfileChange({ birthDate: event.target.value })} /></label><label>预期年限<input type="number" min="1" max="150" value={state.settings.lifeExpectancyYears ?? 80} onChange={(event) => onLifeProfileChange({ lifeExpectancyYears: Number(event.target.value) || 80 })} /></label></div></section>
      <section className="settings-section appearance-settings"><div className="section-heading"><div><span className="eyebrow">显示与主题</span><h2>让时间册像你</h2></div><Sparkles size={22} strokeWidth={1.5} /></div><p className="section-note">偏好只保存在这台电脑上，不会改变你的记录内容。</p><div className="appearance-fields"><label>主题<select value={state.settings.theme ?? 'light'} onChange={(event) => onAppearanceChange({ theme: event.target.value as ThemeMode })}><option value="light">浅色</option><option value="dark">深色</option><option value="high-contrast">高对比</option></select></label><label>页面密度<select value={state.settings.displayDensity ?? 'comfortable'} onChange={(event) => onAppearanceChange({ displayDensity: event.target.value as DisplayDensity })}><option value="comfortable">舒适</option><option value="compact">紧凑</option></select></label><label>数字显示<select value={state.settings.numberFormat ?? 'plain'} onChange={(event) => onAppearanceChange({ numberFormat: event.target.value as NumberFormat })}><option value="plain">不分组</option><option value="grouped">千位分组</option></select></label></div></section>
      <section className="settings-section muted-section"><div className="section-heading"><div><span className="eyebrow">关于</span><h2>几度 · Memento</h2></div><Sparkles size={22} strokeWidth={1.5} /></div><p className="section-note">v2.5.0 · 本地优先 · 无账号 · 无云端</p></section>
    </div>
  </div>
}

function ModernSidebar({ page, onNavigate, onRecord, name }: { page: PageId; onNavigate: (page: PageId) => void; onRecord: () => void; name: string }): ReactElement {
  return (
    <aside className={`sidebar modern-sidebar sidebar--${page}`} data-sidebar-world={page}>
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
          <Settings2 size={14} className="profile-setting" aria-hidden="true" />
        </div>
      </div>
    </aside>
  )
}

function TimeOrbit({ progress }: { progress: number }): ReactElement {
  const safeProgress = Math.min(100, Math.max(0, progress))
  const center = 260
  const radius = 194
  const angle = (safeProgress / 100) * Math.PI * 2 - Math.PI / 2
  const point = { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius }
  const ticks = Array.from({ length: 24 }, (_, index) => {
    const tickAngle = (index / 24) * Math.PI * 2 - Math.PI / 2
    const outer = 224
    const inner = index % 6 === 0 ? 202 : index % 3 === 0 ? 210 : 216
    return { index, x1: center + Math.cos(tickAngle) * inner, y1: center + Math.sin(tickAngle) * inner, x2: center + Math.cos(tickAngle) * outer, y2: center + Math.sin(tickAngle) * outer }
  })
  return (
    <svg className="time-orbit" viewBox="0 0 520 520" role="img" aria-label={`今年已过去 ${safeProgress.toFixed(1)}%`}>
      <circle cx="260" cy="260" r="224" className="orbit-ring orbit-ring--outer" />
      <circle cx="260" cy="260" r="194" className="orbit-ring orbit-ring--inner" />
      {ticks.map((tick) => <line key={tick.index} x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2} className={`orbit-tick ${tick.index % 6 === 0 ? 'is-major' : ''}`} />)}
      <line x1="260" y1="260" x2={point.x} y2={point.y} className="orbit-needle" />
      <circle cx={point.x} cy={point.y} r="8" className="orbit-point" />
      <circle cx="260" cy="260" r="4" className="orbit-center" />
      <text x="260" y="236" textAnchor="middle" className="orbit-center-label">YEAR</text>
      <text x="260" y="270" textAnchor="middle" className="orbit-center-number">{safeProgress.toFixed(1)}%</text>
      <text x="260" y="306" textAnchor="middle" className="orbit-center-note">时间正在经过</text>
    </svg>
  )
}

interface NowViewSlots {
  state: AppState
  today: string
  year: string
  timeLabel: string
  yearProgress: number
  dayProgress: number
  elapsed?: ElapsedCounter
  remaining?: RemainingCounter
  memory?: Moment
  elapsedDisplay: ReturnType<typeof getElapsedDisplay>
  remainingDates: ReturnType<typeof getRemainingDates>
  photo?: PhotoAsset
}

function SafeImage({ src, alt, fileLabel, className, loading = 'lazy' }: { src: string; alt: string; fileLabel: string; className?: string; loading?: 'eager' | 'lazy' }): ReactElement {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])

  if (failed) return <div className={`photo-media-error${className ? ` ${className}` : ''}`} role="img" aria-label={`${fileLabel}无法读取`}><span>图片暂时无法读取</span><small>{fileLabel}</small><button type="button" onClick={() => setFailed(false)}>重新加载</button></div>
  return <img className={className} src={src} alt={alt} loading={loading} decoding="async" onError={() => setFailed(true)} onLoad={(event) => { const image = event.currentTarget; if (typeof image.decode === 'function') image.decode().catch(() => setFailed(true)) }} />
}

function WorldHeader({ marker, title, description, action }: { marker: string; title: string; description: string; action?: ReactNode }): ReactElement {
  return <header className="world-header"><div><span className="world-marker">{marker}</span><h1>{title}</h1><p>{description}</p></div>{action}</header>
}

function NowWorld({ state, onRecord, onOpenMoment }: { state: AppState; onRecord: () => void; onOpenMoment: (moment: Moment) => void }): ReactElement {
  const today = todayIso()
  const [currentTime, setCurrentTime] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  const year = today.slice(0, 4)
  const yearProgress = getYearProgress(today)
  const dayProgress = ((currentTime.getHours() * 60 + currentTime.getMinutes()) / 1440) * 100
  const timeLabel = currentTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  const elapsed = pickPinned(state.elapsed, state.settings.pinnedElapsedId)
  const remaining = pickPinned(state.remaining, state.settings.pinnedRemainingId)
  const memory = pickPinned(state.moments, state.settings.pinnedMomentId) ?? state.moments.find((moment) => moment.date < today)
  const elapsedDisplay = getElapsedDisplay(elapsed ? getElapsedBreakdown(elapsed.startDate) : { days: 0, weeks: 0, months: 0, years: 0 }, state.settings.elapsedDisplayMode ?? 'days')
  const remainingDates = remaining ? getRemainingDates(remaining.endDate, remaining.unit, today, remaining.weekdays) : []
  const photo = memory ? getMomentPhoto(state, memory) : undefined

  return <div className="world-page world-now">
    <WorldHeader marker="NOW / 正在发生" title="此刻" description={`${formatDateWithWeekday(today)} · 今天，也在时间里。`} action={<button className="world-action" onClick={onRecord}><Plus size={16} />记一笔</button>} />
    <section className="now-world-stage" aria-label={`此刻：${timeLabel}，年度进度 ${yearProgress.toFixed(1)}%`}>
      <div className="now-world-time">
        <div className="now-world-time-top"><span>LOCAL TIME</span><span>{year} / {today.slice(5)}</span></div>
        <div className="now-world-clock"><strong>{timeLabel}</strong><span>北京时间 · 正在发生</span></div>
        <div className="now-world-caption"><span>今天先被看见，才会成为记忆。</span><span>{getDaysRemainingInYear(today)} 天留在这一年里</span></div>
        <div className="now-world-track" aria-label={`年度已过去 ${yearProgress.toFixed(1)}%`}><span style={{ transform: `scaleX(${yearProgress / 100})` }} /><i style={{ left: `${yearProgress}%` }} /></div>
        <div className="now-world-progress"><strong>{yearProgress.toFixed(1)}<small>%</small></strong><div><span>YEAR POSITION</span><p>这一年已经走过。今天经过 {dayProgress.toFixed(1)}%。</p></div></div>
        <button className="now-world-record" onClick={onRecord}><Plus size={16} />记录正在发生的事</button>
      </div>
      <div className="now-world-photo">
        <div className="now-world-photo-label"><span>OBSERVATION / {today.slice(5)}</span><span>{memory ? '用户记录' : '本地样片'}</span></div>
        {photo ? <SafeImage src={photo.dataUrl} alt={memory?.title ?? photo.name} fileLabel={photo.name} loading="eager" /> : <SafeImage src={springSample} alt="雨后窗边玻璃杯中的一枝新绿" fileLabel="春季样片" loading="eager" />}
        <div className="now-world-photo-note"><strong>{memory?.title ?? '还没有一段被留下的时光'}</strong><span>{memory ? formatDate(memory.date, 'long') : '文字和日期也能构成一页观察档案。'}</span></div>
      </div>
      <aside className="now-world-side">
        <span className="now-world-side-label">A SMALL RECORD</span>
        <p>{memory?.note ?? '从一件正在发生的小事开始，让今天拥有一个可以回来的位置。'}</p>
        <button className="text-action" disabled={!memory} onClick={() => memory && onOpenMoment(memory)}>打开这段时光 <ChevronRight size={15} /></button>
        <div className="now-world-side-foot"><span>今日</span><strong>{dayProgress.toFixed(1)}%</strong></div>
      </aside>
    </section>
    <section className="now-world-bottom" aria-label="此刻摘要">
      <button className="now-world-memory" disabled={!memory} onClick={() => memory && onOpenMoment(memory)}><span>LAST MEMORY / {memory ? formatRelative(memory.date, today) : '—'}</span><strong>{memory?.title ?? '还没有一段被留下的时光'}</strong><p>{memory?.note ?? '从今天发生的一件小事开始。'}</p><small>{memory ? formatDate(memory.date, 'short') : '按下右上角，记一笔'}</small></button>
      <div className="now-world-measures"><div className="world-measure-heading"><span>MEASURES</span><span>经年 · 余下</span></div><div className="world-measure-row"><span>经年</span><strong>{elapsed ? formatDisplayNumber(elapsedDisplay.value, state.settings.numberFormat ?? 'plain') : '—'}<small>{elapsed ? elapsedDisplay.unit : ''}</small></strong><em>{elapsed?.title ?? '还没有一段经年'}</em></div><div className="world-measure-row"><span>余下</span><strong>{remaining ? formatDisplayNumber(remainingDates.length, state.settings.numberFormat ?? 'plain') : '—'}<small>{remaining ? formatCounterUnit(remaining.unit) : ''}</small></strong><em>{remaining?.title ?? '还没有一段余下'}</em></div></div>
    </section>
  </div>
}

function TimelineWorld({ state, filter, scrollTop, onFilterChange, onScrollPositionChange, onOpenMoment, onRecord }: { state: AppState; filter: TimelineFilter; scrollTop: number; onFilterChange: (filter: TimelineFilter) => void; onScrollPositionChange: (value: number) => void; onOpenMoment: (moment: Moment) => void; onRecord: () => void }): ReactElement {
  const currentYear = todayIso().slice(0, 4)
  const moments = useMemo(() => [...state.moments].filter((moment) => filter === 'all' || (filter === 'this_year' ? moment.date.startsWith(currentYear) : moment.kind === filter)).sort((a, b) => b.date.localeCompare(a.date)), [currentYear, filter, state.moments])
  const groups = useMemo(() => moments.reduce<Record<string, Moment[]>>((result, moment) => { const key = moment.date.slice(0, 7); result[key] = [...(result[key] ?? []), moment]; return result }, {}), [moments])
  const filters: Array<[TimelineFilter, string]> = [['all', '全部'], ['first', '初见'], ['yearly_first', '今年第一次'], ['milestone', '人生节点'], ['this_year', '今年']]
  useEffect(() => { window.scrollTo({ top: scrollTop, behavior: 'auto' }); return () => onScrollPositionChange(window.scrollY) }, [onScrollPositionChange, scrollTop])
  const years = [...new Set(moments.map((moment) => moment.date.slice(0, 4)))]

  return <div className="world-page world-timeline">
    <WorldHeader marker="ATLAS / 回到发生过的地方" title="时光" description="不是流水账，是被时间保存下来的证据。" action={<button className="world-action" onClick={onRecord}><Plus size={16} />记一笔</button>} />
    <section className="timeline-world-index"><div className="timeline-world-count"><strong>{String(moments.length).padStart(2, '0')}</strong><span>条记录<br />正在时间里</span></div><div className="timeline-world-years" aria-label="记录年份">{years.length ? years.map((year) => <span key={year}>{year}</span>) : <span>还没有年份</span>}</div><TimelineStoryFilters filters={filters} filter={filter} onFilterChange={onFilterChange} /></section>
    <div className="timeline-world-track-wrap"><div className="timeline-world-track" tabIndex={0} onKeyDown={(event) => { if (event.key === 'ArrowRight') { event.preventDefault(); event.currentTarget.scrollBy({ left: 360, behavior: 'smooth' }) } else if (event.key === 'ArrowLeft') { event.preventDefault(); event.currentTarget.scrollBy({ left: -360, behavior: 'smooth' }) } else if (event.key === 'Home') { event.preventDefault(); event.currentTarget.scrollTo({ left: 0, behavior: 'smooth' }) } else if (event.key === 'End') { event.preventDefault(); event.currentTarget.scrollTo({ left: event.currentTarget.scrollWidth, behavior: 'smooth' }) } }} aria-label="横向浏览时光记录">{Object.entries(groups).map(([month, monthMoments]) => <section className="timeline-atlas-month" key={month}><header><span>{month.slice(0, 4)}</span><strong>{getMonthLabel(`${month}-01`)}</strong><small>{monthMoments.length} 条记录</small></header><div className="timeline-atlas-records">{monthMoments.map((moment) => { const photo = getMomentPhoto(state, moment); return <button className="timeline-atlas-record" key={moment.id} onClick={() => onOpenMoment(moment)}><span className="timeline-atlas-media">{photo ? <SafeImage src={photo.dataUrl} alt={moment.title} fileLabel={photo.name} /> : <span className="timeline-atlas-no-photo"><small>文字证据</small><strong>{moment.title}</strong></span>}</span><span className="timeline-atlas-meta">{formatDate(moment.date, 'short')} · {KIND_LABELS[moment.kind]}</span><strong>{moment.title}</strong><p>{moment.note ?? '这一天被时间保存下来。'}</p><ChevronRight size={15} /></button> })}</div></section>)}{moments.length === 0 && <div className="timeline-world-empty"><div><span>THE FIRST FRAME</span><h2>第一条记录，会成为时间轴的起点</h2><p>从一件最近发生的小事开始，让档案出现第一行字。</p><button className="outline-action" onClick={onRecord}>从这里开始</button></div><div className="timeline-world-empty-media"><SafeImage src={summerSample} alt="" fileLabel="夏季时间轴样片" loading="eager" /></div></div>}</div></div>
    <div className="timeline-world-hint"><span>← →</span> 用方向键沿着年月浏览 · <span>HOME / END</span> 定位开头与结尾</div>
  </div>
}

interface DegreesWorldProps {
  state: AppState
  tab: DegreeTab
  onTabChange: (tab: DegreeTab) => void
  onPinElapsed: (id: string) => void
  onPinRemaining: (id: string) => void
  onElapsedDisplayMode: (mode: ElapsedDisplayMode) => void
  onElapsedSort: (sort: ElapsedSort) => void
  onShareElapsed: (item: ElapsedCounter) => void
  onShareRemaining: (item: RemainingCounter) => void
  onEditElapsed: (item: ElapsedCounter) => void
  onEditRemaining: (item: RemainingCounter) => void
  onOpenStage: (stage: Stage) => void
  onRecord: (type: RecorderType) => void
}

function DegreeWorldMeasure({ state, tab }: { state: AppState; tab: DegreeTab }): ReactElement {
  const elapsed = pickPinned(state.elapsed, state.settings.pinnedElapsedId)
  const remaining = pickPinned(state.remaining, state.settings.pinnedRemainingId)
  const stage = state.stages.find((item) => item.enabled) ?? state.stages[0]
  if (tab === 'elapsed') {
    const display = elapsed ? getElapsedDisplay(getElapsedBreakdown(elapsed.startDate), state.settings.elapsedDisplayMode ?? 'days') : null
    return <div className="degree-world-measure"><div><span>PAST / 经年</span><h2>{elapsed?.title ?? '还没有一段经年'}</h2><p>{elapsed ? `${formatDate(elapsed.startDate, 'long')} 起，时间一直走到今天。` : '从一个明确的开始日期，给时间一个名字。'}</p></div><strong>{display ? formatDisplayNumber(display.value, state.settings.numberFormat ?? 'plain') : '—'}<small>{display?.unit ?? ''}</small></strong></div>
  }
  if (tab === 'remaining') {
    const dates = remaining ? getRemainingDates(remaining.endDate, remaining.unit, todayIso(), remaining.weekdays) : []
    return <div className="degree-world-measure"><div><span>FUTURE / 余下</span><h2>{remaining?.title ?? '还没有一段余下'}</h2><p>{remaining ? `下一次是 ${dates[0] ? formatDate(dates[0].date, 'long') : '已经到了'}，截止 ${formatDate(remaining.endDate, 'long')}。` : '把未来拆成可以抵达的具体日子。'}</p></div><strong>{remaining ? formatDisplayNumber(dates.length, state.settings.numberFormat ?? 'plain') : '—'}<small>{remaining ? formatCounterUnit(remaining.unit) : ''}</small></strong></div>
  }
  const progress = stage ? (stage.kind === 'life' ? getLifeProgress(stage.startDate, state.settings.lifeExpectancyYears ?? 80) : getStageProgress(stage.startDate, stage.endDate)) : 0
  return <div className="degree-world-measure degree-world-measure--stage"><div><span>PASSAGE / 刻度</span><h2>{stage?.title ?? '还没有一段刻度'}</h2><p>{stage ? `${formatDate(stage.startDate, 'long')} — ${formatDate(stage.endDate, 'long')}。时间走到这里。` : '给一个正在经过的阶段写下开始与结束。'}</p></div><div className="degree-world-stage-ruler" aria-label={`阶段进度 ${progress.toFixed(1)}%`}><span style={{ transform: `scaleX(${progress / 100})` }} /><i style={{ left: `${progress}%` }} /></div><strong>{stage ? `${progress.toFixed(1)}%` : '—'}</strong></div>
}

function DegreesWorld({ state, tab, onTabChange, onPinElapsed, onPinRemaining, onElapsedDisplayMode, onElapsedSort, onShareElapsed, onShareRemaining, onEditElapsed, onEditRemaining, onOpenStage, onRecord }: DegreesWorldProps): ReactElement {
  const tabRefs = useRef<Partial<Record<DegreeTab, HTMLButtonElement | null>>>({})
  const selectTab = (next: DegreeTab) => {
    onTabChange(next)
    tabRefs.current[next]?.focus()
  }
  return <div className="world-page world-degrees">
    <WorldHeader marker="INSTRUMENT / 看见已经与余下" title="几度" description="时间不是一个答案，而是三个可以观察的方向。" />
    <div className="degree-world-tabs" role="tablist" aria-label="时间方向">{([['elapsed', '经年'], ['remaining', '余下'], ['stage', '刻度']] as const).map(([id, label], index) => <button key={id} ref={(element) => { tabRefs.current[id] = element }} role="tab" aria-selected={tab === id} aria-controls="degree-world-panel" tabIndex={tab === id ? 0 : -1} className={tab === id ? 'is-selected' : ''} onClick={() => selectTab(id)} onKeyDown={(event) => { if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); selectTab(id === 'elapsed' ? 'remaining' : id === 'remaining' ? 'stage' : 'elapsed') } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); selectTab(id === 'elapsed' ? 'stage' : id === 'remaining' ? 'elapsed' : 'remaining') } }}><span>0{index + 1}</span><strong>{label}</strong><small>{DEGREE_TAB_NOTES[id]}</small></button>)}</div>
    <DegreeWorldMeasure state={state} tab={tab} />
    <div className="degree-world-detail" id="degree-world-panel" role="tabpanel" aria-label={`${tab === 'elapsed' ? '经年' : tab === 'remaining' ? '余下' : '刻度'}数据`}>{tab === 'elapsed' && <ModernElapsedList state={state} visualNarrative="instrument" pinnedId={state.settings.pinnedElapsedId} displayMode={state.settings.elapsedDisplayMode ?? 'days'} sort={state.settings.elapsedSort ?? 'recent'} onPin={onPinElapsed} onShare={onShareElapsed} onEdit={onEditElapsed} onDisplayModeChange={onElapsedDisplayMode} onSortChange={onElapsedSort} onRecord={() => onRecord('elapsed')} />}{tab === 'remaining' && <ModernRemainingList state={state} visualNarrative="instrument" pinnedId={state.settings.pinnedRemainingId} onPin={onPinRemaining} onShare={onShareRemaining} onEdit={onEditRemaining} onRecord={() => onRecord('remaining')} />}{tab === 'stage' && <ModernStageList state={state} visualNarrative="instrument" onOpenStage={onOpenStage} onRecord={() => onRecord('stage')} />}</div>
  </div>
}

function LightNowLayout({ slots, onRecord, onOpenMoment }: { slots: NowViewSlots; onRecord: () => void; onOpenMoment: (moment: Moment) => void }): ReactElement {
  const { state, today, year, timeLabel, yearProgress, dayProgress, elapsed, remaining, memory, elapsedDisplay, remainingDates, photo } = slots
  return <>
    <PageIntro eyebrow="春 / 此刻" title="此刻" description={`${formatDateWithWeekday(today)} · 今天，也在时间里。`} action={<button className="quiet-action" onClick={onRecord}><Plus size={16} />记一笔</button>} />
    <section className="light-now-stage" aria-label="雨后晨光中的此刻">
      <div className="light-now-copy"><span className="light-kicker">SPRING / NOW</span><h2>今天，也在时间里。</h2><strong>{timeLabel}</strong><span className="light-now-date">{formatDateWithWeekday(today)} · {year}</span><div className="light-progress-line"><span style={{ transform: `scaleX(${yearProgress / 100})` }} /></div><p>这一年已经走过 {yearProgress.toFixed(1)}%，今天经过 {dayProgress.toFixed(1)}%。</p><button className="dark-action" onClick={onRecord}><Plus size={16} />记录此刻</button></div>
      <div className="light-now-media">{photo ? <SafeImage src={photo.dataUrl} alt={memory?.title ?? photo.name} fileLabel={photo.name} loading="eager" /> : <SafeImage src={springSample} alt="雨后窗边玻璃杯中的一枝新绿" fileLabel="春季样片" loading="eager" />}</div>
    </section>
    <section className="light-now-summary" aria-label="此刻摘要"><button className="light-summary-memory" onClick={() => memory && onOpenMoment(memory)} disabled={!memory}><span>置顶记忆</span><strong>{memory?.title ?? '还没有一段被留下的时光'}</strong><small>{memory ? formatDate(memory.date, 'short') : '从今天留下一件小事。'}</small></button><div><span>经年</span><strong>{elapsed ? formatDisplayNumber(elapsedDisplay.value, state.settings.numberFormat ?? 'plain') : '—'}<small>{elapsed ? elapsedDisplay.unit : ''}</small></strong><p>{elapsed?.title ?? '还没有一段经年'}</p></div><div><span>余下</span><strong>{remaining ? formatDisplayNumber(remainingDates.length, state.settings.numberFormat ?? 'plain') : '—'}<small>{remaining ? formatCounterUnit(remaining.unit) : ''}</small></strong><p>{remaining?.title ?? '还没有一段余下'}</p></div></section>
  </>
}

function InstrumentNowLayout({ slots, onRecord, onOpenMoment }: { slots: NowViewSlots; onRecord: () => void; onOpenMoment: (moment: Moment) => void }): ReactElement {
  const { today, timeLabel, yearProgress, memory, photo } = slots
  return <>
    <PageIntro eyebrow="刻度 / 春·此刻" title="此刻" description="一枚时间盘，显示现在、今日与年度位置。" action={<button className="quiet-action" onClick={onRecord}><Plus size={16} />记一笔</button>} />
    <section className="instrument-now-stage" aria-label={`生命时钟：当前时间 ${timeLabel}，年度进度 ${yearProgress.toFixed(1)}%`}><div className="instrument-dial-wrap"><TimeOrbit progress={yearProgress} /><p className="instrument-equivalence">年度位置：已过去 {yearProgress.toFixed(1)}%，当前时间 {timeLabel}。</p></div><div className="instrument-observation"><span className="instrument-kicker">OBSERVATION / 01</span><h2>{memory?.title ?? '从今天开始观察'}</h2><span className="instrument-date">{memory ? formatDate(memory.date, 'long') : formatDate(today, 'long')}</span>{photo ? <SafeImage src={photo.dataUrl} alt={memory?.title ?? photo.name} fileLabel={photo.name} loading="eager" /> : <SafeImage src={springSample} alt="雨后窗边玻璃杯中的一枝新绿" fileLabel="春季样片" loading="eager" />}<p>{memory?.note ?? '记录一件正在发生的小事，时间盘会继续替你看见今天。'}</p><button className="outline-action" onClick={() => memory && onOpenMoment(memory)} disabled={!memory}>打开观察记录</button></div></section>
    <div className="instrument-now-tools"><button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>今日</button><button onClick={onRecord}><Plus size={15} />记录</button><button onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}>日历</button></div>
  </>
}

function ModernNowPage({ state, visualNarrative, onRecord, onOpenMoment }: { state: AppState; visualNarrative: VisualNarrative; onRecord: () => void; onOpenMoment: (moment: Moment) => void }): ReactElement {
  const today = todayIso()
  const [currentTime, setCurrentTime] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  const yearProgress = getYearProgress(today)
  const year = today.slice(0, 4)
  const elapsed = pickPinned(state.elapsed, state.settings.pinnedElapsedId)
  const remaining = pickPinned(state.remaining, state.settings.pinnedRemainingId)
  const memory = pickPinned(state.moments, state.settings.pinnedMomentId) ?? state.moments.find((moment) => moment.date < today)
  const elapsedDisplay = getElapsedDisplay(elapsed ? getElapsedBreakdown(elapsed.startDate) : { days: 0, weeks: 0, months: 0, years: 0 }, state.settings.elapsedDisplayMode ?? 'days')
  const remainingDates = remaining ? getRemainingDates(remaining.endDate, remaining.unit, today, remaining.weekdays) : []
  const minutesToday = currentTime.getHours() * 60 + currentTime.getMinutes()
  const dayProgress = (minutesToday / 1440) * 100
  const timeLabel = currentTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  const photo = memory ? memory.photoIds.map((id) => state.photos.find((item) => item.id === id)).find((item): item is PhotoAsset => Boolean(item)) : undefined
  const slots: NowViewSlots = { state, today, year, timeLabel, yearProgress, dayProgress, elapsed, remaining, memory, elapsedDisplay, remainingDates, photo }

  return (
    <div className={`page page-now modern-now now-story--${visualNarrative}`}>
      {visualNarrative === 'light' && <LightNowLayout slots={slots} onRecord={onRecord} onOpenMoment={onOpenMoment} />}
      {visualNarrative === 'instrument' && <InstrumentNowLayout slots={slots} onRecord={onRecord} onOpenMoment={onOpenMoment} />}
      {visualNarrative === 'archive' && <>
      <PageIntro eyebrow="个人时间观测 / 01" title="此刻" description={`${formatDateWithWeekday(today)} · 今天，也在时间里。`} action={<button className="quiet-action" onClick={onRecord}><Plus size={16} />记一笔</button>} />
      <section className="now-observatory" aria-label="此刻的时间观测">
        <div className="observatory-copy">
          <div className="observatory-meta"><span>LOCAL TIME</span><span>{year} / {today.slice(5)}</span></div>
          <div className="clock-readout"><strong>{timeLabel}</strong><span>北京时间 · 正在发生</span></div>
          <div className="year-readout"><strong>{yearProgress.toFixed(1)}<small>%</small></strong><p>这一年已经走过<br /><em>还剩 {getDaysRemainingInYear(today)} 天</em></p></div>
          <div className="time-track" aria-label={`今年已过去 ${yearProgress.toFixed(1)}%`}><span style={{ transform: `scaleX(${yearProgress / 100})` }} /><i style={{ left: `${yearProgress}%` }} /></div>
          <div className="observatory-foot"><span>今日经过 {dayProgress.toFixed(1)}%</span><span>LOCAL / 01</span></div>
        </div>
        <div className="archive-specimen-frame">
          {photo ? <SafeImage src={photo.dataUrl} alt={memory?.title ?? photo.name} fileLabel={photo.name} loading="eager" /> : <div className="archive-specimen-empty"><div><span>今日标本</span><strong>{formatDate(today, 'long')}</strong><p>还没有照片；文字和日期也能构成一页观察档案。</p></div></div>}
          <div className="archive-specimen-caption"><span>今日标本</span><span>{memory ? '记录照片' : '无照片状态'}</span></div>
        </div>
      </section>
      <div className="now-lower-grid">
        <button className="memory-archive" onClick={() => memory && onOpenMoment(memory)} disabled={!memory}>
          <span className="archive-slip-index">LAST MEMORY / {memory ? formatRelative(memory.date, today) : '—'}</span>
          {memory ? <><span className="archive-slip-kind">{KIND_LABELS[memory.kind]}</span><strong>{memory.title}</strong><p>{memory.note || '有些日子，后来才知道值得记住。'}</p><span className="archive-slip-date">{formatDate(memory.date, 'short')} {memory.location ? `· ${memory.location}` : ''}</span><ChevronRight size={17} className="memory-arrow" /></> : <><strong>还没有一段被留下的时光</strong><p>从今天发生的一件小事开始。</p><span className="archive-slip-date">按下右上角，记一笔</span></>}
        </button>
        <section className="now-measures" aria-label="时间刻度">
          <div className="measure-heading"><span>LIVE MEASURES</span><span>02 — 03</span></div>
          <article className="measure-line measure-line--elapsed"><div><span className="measure-label"><Clock3 size={14} />经年</span><strong>{elapsed ? elapsed.title : '还没有一段经年'}</strong></div><span className="measure-value">{elapsed ? formatDisplayNumber(elapsedDisplay.value, state.settings.numberFormat ?? 'plain') : '—'}<small>{elapsed ? elapsedDisplay.unit : ''}</small></span></article>
          <article className="measure-line measure-line--remaining"><div><span className="measure-label"><CalendarDays size={14} />余下</span><strong>{remaining ? remaining.title : '还没有一段余下'}</strong></div><span className="measure-value">{remaining ? formatDisplayNumber(remainingDates.length, state.settings.numberFormat ?? 'plain') : '—'}<small>{remaining ? formatCounterUnit(remaining.unit) : ''}</small></span></article>
          <div className="measure-foot">数据只在这台电脑上保存 · 每一次记录都是时间的坐标</div>
        </section>
      </div>
      </>}
    </div>
  )
}

function getMomentPhoto(state: AppState, moment: Moment): PhotoAsset | undefined {
  return moment.photoIds.map((id) => state.photos.find((photo) => photo.id === id)).find((photo): photo is PhotoAsset => Boolean(photo))
}

function TimelineStoryFilters({ filters, filter, onFilterChange }: { filters: Array<[TimelineFilter, string]>; filter: TimelineFilter; onFilterChange: (filter: TimelineFilter) => void }): ReactElement {
  return <div className="filter-row" role="tablist" aria-label="时间轴筛选">{filters.map(([id, label]) => <button key={id} role="tab" aria-selected={filter === id} className={`filter-chip ${filter === id ? 'is-selected' : ''}`} onClick={() => onFilterChange(id)}>{label}</button>)}</div>
}

function LightTimelineLayout({ state, moments, groups, filters, filter, onFilterChange, onOpenMoment, onRecord }: { state: AppState; moments: Moment[]; groups: Record<string, Moment[]>; filters: Array<[TimelineFilter, string]>; filter: TimelineFilter; onFilterChange: (filter: TimelineFilter) => void; onOpenMoment: (moment: Moment) => void; onRecord: () => void }): ReactElement {
  return <>
    <PageIntro eyebrow="夏 / 时光" title="时光" description="生活留下来的，不止日期。" action={<button className="quiet-action" onClick={onRecord}><Plus size={16} />记一笔</button>} />
    <section className="light-timeline-index"><div><span>SUMMER / TIMELINE</span><strong>{moments.length}</strong><p>条记录在光线里相遇。</p></div><TimelineStoryFilters filters={filters} filter={filter} onFilterChange={onFilterChange} /></section>
    <div className="light-timeline-stream">{Object.entries(groups).map(([month, monthMoments]) => <section key={month} className="light-month"><header><span>{month.slice(0, 4)}</span><strong>{getMonthLabel(`${month}-01`)}</strong></header>{monthMoments.map((moment) => { const photo = getMomentPhoto(state, moment); return <div className="light-timeline-record" key={moment.id}><div className="light-timeline-media">{photo ? <SafeImage src={photo.dataUrl} alt={moment.title} fileLabel={photo.name} /> : <div className="light-timeline-no-photo"><span>无照片</span><strong>{moment.title}</strong><small>{formatDate(moment.date, 'short')}</small></div>}</div><button onClick={() => onOpenMoment(moment)}><span>{formatDate(moment.date, 'short')} · {KIND_LABELS[moment.kind]}</span><strong>{moment.title}</strong><p>{moment.note ?? '这一天被时间保存下来。'}</p></button></div> })}</section>)}{moments.length === 0 && <EmptyState title="第一条记录，会成为时间轴的起点" text="从一件最近发生的小事开始，让档案出现第一行字。" action={onRecord} />}</div>
  </>
}

function InstrumentTimelineLayout({ state, moments, groups, filters, filter, onFilterChange, onOpenMoment, onRecord }: { state: AppState; moments: Moment[]; groups: Record<string, Moment[]>; filters: Array<[TimelineFilter, string]>; filter: TimelineFilter; onFilterChange: (filter: TimelineFilter) => void; onOpenMoment: (moment: Moment) => void; onRecord: () => void }): ReactElement {
  const [selectedId, setSelectedId] = useState(moments[0]?.id)
  const selected = moments.find((moment) => moment.id === selectedId) ?? moments[0]
  return <>
    <PageIntro eyebrow="刻度 / 夏·时光" title="时光" description="沿着日期与记录，找到可以回去的时刻。" action={<button className="quiet-action" onClick={onRecord}><Plus size={16} />记一笔</button>} />
    <section className="instrument-timeline-index"><div><span>YEAR RANGE</span><strong>{moments.length ? `${moments[moments.length - 1].date.slice(0, 4)} — ${moments[0].date.slice(0, 4)}` : '—'}</strong></div><TimelineStoryFilters filters={filters} filter={filter} onFilterChange={onFilterChange} /></section>
    <div className="instrument-year-ruler" aria-label="有记录的年份">{Object.keys(groups).map((month) => <span key={month}>{month.slice(0, 4)}</span>)}</div>
    <div className="instrument-film-strip">{moments.map((moment) => { const photo = getMomentPhoto(state, moment); return <button key={moment.id} className={selected?.id === moment.id ? 'is-selected' : ''} onClick={() => { setSelectedId(moment.id); onOpenMoment(moment) }}><span className="film-frame">{photo ? <SafeImage src={photo.dataUrl} alt={moment.title} fileLabel={photo.name} /> : <span className="film-text-frame"><small>{formatDate(moment.date, 'short')}</small><strong>{moment.title}</strong></span>}</span><small>{formatDate(moment.date, 'short')}</small></button> })}</div>
    <section className="instrument-timeline-detail" aria-live="polite">{selected ? <><span>{formatDate(selected.date, 'long')} · {KIND_LABELS[selected.kind]}</span><h2>{selected.title}</h2><p>{selected.note ?? '这一天没有附加说明，但日期本身也是一条证据。'}</p></> : <EmptyState title="还没有记录" text="第一条记录会成为时间尺上的起点。" action={onRecord} />}</section>
  </>
}

function ModernTimelinePage({ state, visualNarrative, filter, scrollTop, onFilterChange, onScrollPositionChange, onOpenMoment, onRecord }: { state: AppState; visualNarrative: VisualNarrative; filter: TimelineFilter; scrollTop: number; onFilterChange: (filter: TimelineFilter) => void; onScrollPositionChange: (value: number) => void; onOpenMoment: (moment: Moment) => void; onRecord: () => void }): ReactElement {
  const currentYear = todayIso().slice(0, 4)
  const moments = useMemo(() => [...state.moments].filter((moment) => filter === 'all' || (filter === 'this_year' ? moment.date.startsWith(currentYear) : moment.kind === filter)).sort((a, b) => b.date.localeCompare(a.date)), [currentYear, filter, state.moments])
  useEffect(() => {
    window.scrollTo({ top: scrollTop, behavior: 'auto' })
    return () => onScrollPositionChange(window.scrollY)
  }, [onScrollPositionChange, scrollTop])
  const groups = moments.reduce<Record<string, Moment[]>>((result, moment) => {
    const key = moment.date.slice(0, 7)
    result[key] = [...(result[key] ?? []), moment]
    return result
  }, {})
  const filters: Array<[TimelineFilter, string]> = [['all', '全部'], ['first', '初见'], ['yearly_first', '今年第一次'], ['milestone', '人生节点'], ['this_year', '今年']]

  const storyClass = `page page-timeline modern-timeline timeline-story--${visualNarrative}`
  if (visualNarrative === 'light') return <div className={storyClass}><LightTimelineLayout state={state} moments={moments} groups={groups} filters={filters} filter={filter} onFilterChange={onFilterChange} onOpenMoment={onOpenMoment} onRecord={onRecord} /></div>
  if (visualNarrative === 'instrument') return <div className={storyClass}><InstrumentTimelineLayout state={state} moments={moments} groups={groups} filters={filters} filter={filter} onFilterChange={onFilterChange} onOpenMoment={onOpenMoment} onRecord={onRecord} /></div>
  return <div className={storyClass}>
    <PageIntro eyebrow="个人档案 / 02" title="时光" description="不是流水账，是被时间保存下来的证据。" action={<button className="quiet-action" onClick={onRecord}><Plus size={16} />记一笔</button>} />
    <section className="timeline-index"><div className="timeline-index-count"><strong>{String(moments.length).padStart(2, '0')}</strong><span>条时光<br />正在档案里</span></div><div className="timeline-index-copy"><span>ARCHIVE INDEX</span><p>沿着年月向下走，回到那些曾经发生的地方。</p></div><div className="filter-row" role="tablist" aria-label="时间轴筛选">{filters.map(([id, label]) => <button key={id} role="tab" aria-selected={filter === id} className={`filter-chip ${filter === id ? 'is-selected' : ''}`} onClick={() => onFilterChange(id)}>{label}</button>)}</div></section>
    <div className="archive-stream">
      {Object.entries(groups).map(([month, monthMoments], groupIndex) => <section className="archive-month" key={month}>
        <header className="archive-month-head"><span className="archive-month-index">{String(groupIndex + 1).padStart(2, '0')}</span><strong>{month.slice(0, 4)}</strong><span>{getMonthLabel(`${month}-01`)}</span><em>{monthMoments.length} 条记录</em></header>
        <div className="archive-entries">{monthMoments.map((moment) => <button className="archive-entry" key={moment.id} onClick={() => onOpenMoment(moment)}><span className={`archive-entry-marker archive-entry-marker--${moment.kind}`} /><span className="archive-entry-date">{formatDate(moment.date, 'short')}</span><span className="archive-entry-copy"><strong>{moment.title}</strong><span>{KIND_LABELS[moment.kind]}{moment.location ? ` · ${moment.location}` : ''}</span>{moment.note && <em>“{moment.note}”</em>}</span><ChevronRight size={16} className="entry-arrow" /></button>)}</div>
      </section>)}
      {moments.length === 0 && <EmptyState title="这里还没有时光" text="从一件最近发生的小事开始，让档案出现第一行字。" action={onRecord} />}
    </div>
  </div>
}

function DegreeLightLead({ state, tab }: { state: AppState; tab: DegreeTab }): ReactElement {
  const moment = pickPinned(state.moments, state.settings.pinnedMomentId)
  const photo = moment ? getMomentPhoto(state, moment) : undefined
  return <section className="degree-light-lead"><div><span>秋 / 几度 · 傍晚长影</span><h2>已经走了多少，还能看见多少。</h2><p>数据保留原来的含义，光线只改变阅读的重心。</p></div><div className="degree-light-photo">{photo ? <SafeImage src={photo.dataUrl} alt={moment?.title ?? photo.name} fileLabel={photo.name} /> : <div className="degree-light-no-photo"><strong>{moment?.title ?? '还没有照片'}</strong><span>{moment ? formatDate(moment.date, 'short') : '以数字继续观察'}</span></div>}<small>{tab === 'elapsed' ? '累计' : tab === 'remaining' ? '未来' : '阶段'} · 当前选择</small></div></section>
}

function DegreeInstrumentMeasure({ state, tab }: { state: AppState; tab: DegreeTab }): ReactElement {
  const elapsed = pickPinned(state.elapsed, state.settings.pinnedElapsedId)
  const remaining = pickPinned(state.remaining, state.settings.pinnedRemainingId)
  const stage = state.stages.find((item) => item.enabled)
  const progress = tab === 'elapsed' && elapsed ? Math.min(100, getElapsedBreakdown(elapsed.startDate).days / 3650 * 100) : tab === 'remaining' && remaining ? Math.min(100, getRemainingDates(remaining.endDate, remaining.unit, todayIso(), remaining.weekdays).length / 100 * 100) : stage ? getStageProgress(stage.startDate, stage.endDate) : 0
  const label = tab === 'elapsed' ? elapsed?.title ?? '还没有一段经年' : tab === 'remaining' ? remaining?.title ?? '还没有一段余下' : stage?.title ?? '还没有一段刻度'
  return <section className="degree-instrument-measure" aria-label={`${label}的主测量图`}><div><span>主测量</span><h2>{label}</h2><p>{tab === 'elapsed' ? '从开始日期起，已经累计的时间。' : tab === 'remaining' ? '截至日期前仍可遇见的具体日子。' : '从开始日期到结束日期，阶段走到这里。'}</p></div><div className="instrument-linear-measure"><span style={{ transform: `scaleX(${progress / 100})` }} /><i style={{ left: `${progress}%` }} /></div><strong>{progress.toFixed(1)}%</strong></section>
}

function ModernDegreesPage({ state, visualNarrative, tab, onTabChange, onPinElapsed, onPinRemaining, onElapsedDisplayMode, onElapsedSort, onShareElapsed, onShareRemaining, onEditElapsed, onEditRemaining, onOpenStage, onRecord }: { state: AppState; visualNarrative: VisualNarrative; tab: DegreeTab; onTabChange: (tab: DegreeTab) => void; onPinElapsed: (id: string) => void; onPinRemaining: (id: string) => void; onElapsedDisplayMode: (mode: ElapsedDisplayMode) => void; onElapsedSort: (sort: ElapsedSort) => void; onShareElapsed: (item: ElapsedCounter) => void; onShareRemaining: (item: RemainingCounter) => void; onEditElapsed: (item: ElapsedCounter) => void; onEditRemaining: (item: RemainingCounter) => void; onOpenStage: (stage: Stage) => void; onRecord: (type: RecorderType) => void }): ReactElement {
  const tabs: Array<[DegreeTab, string, string]> = [['elapsed', '经年', '已经走过的时间'], ['remaining', '余下', '还可以遇见的日子'], ['stage', '刻度', '正在经过的阶段']]
  return <div className={`page page-degrees degree-page--${tab} modern-degrees degrees-story--${visualNarrative}`}>
    <PageIntro eyebrow="时间的三种方向 / 03" title="几度" description="把时间从一个数字，变成可以看见的方向。" />
    <div className="degree-tabs" role="tablist" aria-label="时间方向"><span className="degree-tabs-lead">ORIENTATIONS</span>{tabs.map(([id, label, note], index) => <button key={id} role="tab" aria-selected={tab === id} aria-controls={`degree-panel-${id}`} className={tab === id ? 'is-selected' : ''} onClick={() => onTabChange(id)}><span>0{index + 1}</span><strong>{label}</strong><small>{note}</small></button>)}</div>
    {visualNarrative === 'light' && <DegreeLightLead state={state} tab={tab} />}
    {visualNarrative === 'instrument' && <DegreeInstrumentMeasure state={state} tab={tab} />}
    {tab === 'elapsed' && <ModernElapsedList state={state} visualNarrative={visualNarrative} pinnedId={state.settings.pinnedElapsedId} displayMode={state.settings.elapsedDisplayMode ?? 'days'} sort={state.settings.elapsedSort ?? 'recent'} onPin={onPinElapsed} onShare={onShareElapsed} onEdit={onEditElapsed} onDisplayModeChange={onElapsedDisplayMode} onSortChange={onElapsedSort} onRecord={() => onRecord('elapsed')} />}
    {tab === 'remaining' && <ModernRemainingList state={state} visualNarrative={visualNarrative} pinnedId={state.settings.pinnedRemainingId} onPin={onPinRemaining} onShare={onShareRemaining} onEdit={onEditRemaining} onRecord={() => onRecord('remaining')} />}
    {tab === 'stage' && <ModernStageList state={state} visualNarrative={visualNarrative} onOpenStage={onOpenStage} onRecord={() => onRecord('stage')} />}
  </div>
}

function ModernElapsedList({ state, visualNarrative, pinnedId, displayMode, sort, onPin, onShare, onEdit, onDisplayModeChange, onSortChange, onRecord }: { state: AppState; visualNarrative: VisualNarrative; pinnedId?: string; displayMode: ElapsedDisplayMode; sort: ElapsedSort; onPin: (id: string) => void; onShare: (item: ElapsedCounter) => void; onEdit: (item: ElapsedCounter) => void; onDisplayModeChange: (mode: ElapsedDisplayMode) => void; onSortChange: (sort: ElapsedSort) => void; onRecord: () => void }): ReactElement {
  const items = useMemo(() => [...state.elapsed].sort((a, b) => sort === 'oldest' ? a.startDate.localeCompare(b.startDate) : sort === 'longest' ? getElapsedBreakdown(b.startDate).days - getElapsedBreakdown(a.startDate).days : b.updatedAt.localeCompare(a.updatedAt)), [sort, state.elapsed])
  const controls = <div className="elapsed-controls"><div className="segmented-control" role="group" aria-label="经年显示单位">{([['days', '天'], ['weeks', '周'], ['months', '月'], ['years', '年']] as const).map(([id, label]) => <button key={id} className={displayMode === id ? 'is-selected' : ''} onClick={() => onDisplayModeChange(id)}>{label}</button>)}</div><select aria-label="经年排序" value={sort} onChange={(event) => onSortChange(event.target.value as ElapsedSort)}><option value="recent">最近编辑</option><option value="oldest">开始最早</option><option value="longest">经过最长</option></select></div>
  return <ModernDegreeListShell id="elapsed" visualNarrative={visualNarrative} variant="elapsed" title="已经经过的时间" subtitle="每一段经年，都从某个具体日子开始。" action={onRecord} controls={controls} empty={state.elapsed.length === 0} emptyText="还没有一段经年。">
    {items.map((item, index) => { const display = getElapsedDisplay(getElapsedBreakdown(item.startDate), displayMode); return <article className="degree-row" key={item.id}><span className="degree-row-index">{String(index + 1).padStart(2, '0')}</span><div className="degree-row-copy"><span className="row-label">{formatDate(item.startDate, 'short')} — 至今</span><h2>{item.title}</h2><span className="row-caption">从那天起，时间一直在这里累积。</span></div><div className="row-number">{formatDisplayNumber(display.value, state.settings.numberFormat ?? 'plain')}<small>{display.unit}</small></div><div className="row-actions"><button className={`pin-button ${pinnedId === item.id ? 'is-pinned' : ''}`} onClick={() => onPin(item.id)} aria-label={pinnedId === item.id ? '取消置顶' : '置顶'}><Pin size={15} /></button><button className="share-button" onClick={() => onShare(item)} aria-label="生成经年分享卡"><Share2 size={15} /></button><button className="share-button" onClick={() => onEdit(item)} aria-label={`编辑${item.title}`}><Pencil size={15} /></button></div></article> })}
  </ModernDegreeListShell>
}

function ModernRemainingList({ state, visualNarrative, pinnedId, onPin, onShare, onEdit, onRecord }: { state: AppState; visualNarrative: VisualNarrative; pinnedId?: string; onPin: (id: string) => void; onShare: (item: RemainingCounter) => void; onEdit: (item: RemainingCounter) => void; onRecord: () => void }): ReactElement {
  const items = useMemo(() => [...state.remaining].sort((a, b) => a.endDate.localeCompare(b.endDate)), [state.remaining])
  return <ModernDegreeListShell id="remaining" visualNarrative={visualNarrative} variant="remaining" title="还剩下的具体日子" subtitle="把未来拆成一页页可以抵达的日历。" action={onRecord} empty={state.remaining.length === 0} emptyText="还没有一段余下。">
    {items.map((item, index) => { const dates = getRemainingDates(item.endDate, item.unit, todayIso(), item.weekdays); return <article className="degree-row" key={item.id}><span className="degree-row-index">{String(index + 1).padStart(2, '0')}</span><div className="degree-row-copy"><span className="row-label">截止 · {formatDate(item.endDate, 'short')}</span><h2>{item.title}</h2><span className="row-caption">下一次 · {dates[0] ? `${formatDate(dates[0].date, 'short')} ${getWeekdayLabel(dates[0].date)}` : '已经到了'}</span><div className="remaining-date-list" aria-label={`${item.title} 接下来日期`}>{dates.slice(0, 5).map((date) => <span className="remaining-date" key={date.date}>{formatDate(date.date, 'short')} <small>{getWeekdayLabel(date.date)}</small></span>)}{dates.length > 5 && <span className="remaining-more">+{dates.length - 5} 个</span>}</div></div><div className="row-number">{dates.length}<small>{formatCounterUnit(item.unit)}</small></div><div className="row-actions"><button className={`pin-button ${pinnedId === item.id ? 'is-pinned' : ''}`} onClick={() => onPin(item.id)} aria-label={pinnedId === item.id ? '取消置顶' : '置顶'}><Pin size={15} /></button><button className="share-button" onClick={() => onShare(item)} aria-label="生成余下分享卡"><Share2 size={15} /></button><button className="share-button" onClick={() => onEdit(item)} aria-label={`编辑${item.title}`}><Pencil size={15} /></button></div></article> })}
  </ModernDegreeListShell>
}

function ModernStageList({ state, visualNarrative, onOpenStage, onRecord }: { state: AppState; visualNarrative: VisualNarrative; onOpenStage: (stage: Stage) => void; onRecord: () => void }): ReactElement {
  const stages = useMemo(() => {
    const regularStages = state.stages.filter((stage) => stage.enabled).sort((a, b) => a.startDate.localeCompare(b.startDate))
    if (!state.settings.displayLifeProgress || !state.settings.birthDate || !state.settings.lifeExpectancyYears) return regularStages
    const lifeStage: Stage = { id: 'stage-life-progress', kind: 'life', title: '人生进度', startDate: state.settings.birthDate, endDate: getLifeEndDate(state.settings.birthDate, state.settings.lifeExpectancyYears), enabled: true, createdAt: state.settings.birthDate, updatedAt: state.settings.birthDate }
    return [lifeStage, ...regularStages]
  }, [state.settings.birthDate, state.settings.displayLifeProgress, state.settings.lifeExpectancyYears, state.stages])
  return <ModernDegreeListShell id="stage" visualNarrative={visualNarrative} variant="stage" title="正在经过的阶段" subtitle="阶段不是终点，而是你正在其中的那一段。" action={onRecord} empty={stages.length === 0} emptyText="还没有一段刻度。">
    {stages.map((item, index) => { const progress = item.kind === 'life' ? getLifeProgress(item.startDate, state.settings.lifeExpectancyYears ?? 80) : getStageProgress(item.startDate, item.endDate); return <button className="stage-row stage-row-button" key={item.id} onClick={() => onOpenStage(item)} aria-label={`查看${item.title}阶段详情`}><span className="stage-row-index">0{index + 1}</span><div className="stage-row-head"><div><span className="row-label">{item.kind === 'life' ? `${formatDate(item.startDate, 'long')} — ${formatDate(item.endDate, 'long')}` : `${formatDate(item.startDate, 'short')} — ${formatDate(item.endDate, 'short')}`}</span><h2>{item.title}</h2></div><strong>{progress.toFixed(1)}%</strong></div><div className="stage-horizon"><span style={{ transform: `scaleX(${progress / 100})` }} /><i style={{ left: `${progress}%` }} /></div><span className="stage-caption">{item.kind === 'life' ? '按照你的预期年限，时间走到这里。' : '时间走到这里。'}</span></button> })}
  </ModernDegreeListShell>
}

function ModernDegreeListShell({ id, visualNarrative, variant, title, subtitle, action, controls, empty, emptyText, children }: { id: DegreeTab; visualNarrative: VisualNarrative; variant: DegreeTab; title: string; subtitle: string; action: () => void; controls?: ReactNode; empty: boolean; emptyText: string; children: ReactNode }): ReactElement {
  return <section id={`degree-panel-${id}`} className={`degree-list-shell modern-degree-shell degree-list-shell--${variant} degree-story--${visualNarrative}`} role="tabpanel"><div className="degree-shell-header"><div><span className="eyebrow">{variant === 'elapsed' ? 'PAST / 经年' : variant === 'remaining' ? 'FUTURE / 余下' : 'PASSAGE / 刻度'}</span><h2>{title}</h2><p>{subtitle}</p></div><div className="heading-actions">{controls}<button className="icon-text-button" onClick={action}><Plus size={16} />新建</button></div></div>{empty ? <EmptyState title={emptyText} text="从一个明确的日期开始，给时间一个名字。" action={action} /> : <div className="degree-list">{children}</div>}</section>
}

function VisualNarrativePicker({ value, error, onChange }: { value: VisualNarrative; error: string | null; onChange: (value: VisualNarrative) => void }): ReactElement {
  const [preview, setPreview] = useState<VisualNarrative>(value)
  const optionRefs = useRef<Partial<Record<VisualNarrative, HTMLButtonElement | null>>>({})
  useEffect(() => setPreview(value), [value])
  const previewOption = VISUAL_NARRATIVE_OPTIONS.find((option) => option.id === preview) ?? VISUAL_NARRATIVE_OPTIONS[0]
  const movePreview = (current: VisualNarrative, offset: number) => {
    const currentIndex = VISUAL_NARRATIVE_OPTIONS.findIndex((option) => option.id === current)
    const nextIndex = (currentIndex + offset + VISUAL_NARRATIVE_OPTIONS.length) % VISUAL_NARRATIVE_OPTIONS.length
    const next = VISUAL_NARRATIVE_OPTIONS[nextIndex].id
    setPreview(next)
    optionRefs.current[next]?.focus()
  }
  return <div className="visual-narrative-picker" onMouseLeave={() => setPreview(value)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPreview(value) }}>
    <div className={`narrative-preview narrative-preview--${preview}`} aria-label={`视觉叙事预览：${previewOption.label}`}><div className="narrative-preview-title"><span>装帧样本</span><strong>{previewOption.label}</strong><small>{previewOption.description}</small></div><div className="narrative-season-strips">{SEASON_SAMPLES.map((sample) => <div className="narrative-season-strip" key={sample.name}><img src={sample.src} alt="" aria-hidden="true" /><span>{sample.name} · {sample.page}</span></div>)}</div></div>
    <fieldset className="narrative-options"><legend>视觉叙事</legend><div role="radiogroup" aria-label="视觉叙事选择">{VISUAL_NARRATIVE_OPTIONS.map((option) => <button type="button" role="radio" aria-checked={value === option.id} tabIndex={value === option.id ? 0 : -1} className={`narrative-option ${value === option.id ? 'is-selected' : ''}`} key={option.id} ref={(element) => { optionRefs.current[option.id] = element }} onMouseEnter={() => setPreview(option.id)} onFocus={() => setPreview(option.id)} onClick={() => onChange(option.id)} onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowRight') { event.preventDefault(); movePreview(option.id, 1) } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') { event.preventDefault(); movePreview(option.id, -1) } else if (event.key === 'Home') { event.preventDefault(); movePreview('archive', -VISUAL_NARRATIVE_OPTIONS.length) } else if (event.key === 'End') { event.preventDefault(); movePreview('instrument', VISUAL_NARRATIVE_OPTIONS.length) } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onChange(option.id) } }}><span className="narrative-radio" aria-hidden="true" /><span><strong>{option.label}</strong><small>{option.description}</small></span><em>{value === option.id ? '当前' : option.season}</em></button>)}</div></fieldset>
    {error && <p className="visual-narrative-error" role="alert">{error}</p>}
  </div>
}

function WorldMap(): ReactElement {
  return <div className="world-map" aria-label="四个页面的固定视觉身份"><div className="world-map-intro"><span>FOUR ROOMS / 四个阅览室</span><strong>同一册时间，四种观看方式。</strong><p>页面身份固定，记录与备份逻辑保持一致。</p></div><div className="world-map-items">{SEASON_SAMPLES.map((sample, index) => <div className={`world-map-item world-map-item--${sample.name}`} key={sample.name}><div className="world-map-image"><SafeImage src={sample.src} alt="" fileLabel={`${sample.page}样片`} loading="lazy" /></div><span>0{index + 1}</span><strong>{sample.page}</strong><small>{['呼吸时钟', '记忆胶片', '时间测量台', '冬夜档案室'][index]}</small></div>)}</div></div>
}

function SettingsWorld({ state, recoveryAvailable, onExportJson, onExportZip, onExportEncrypted, onImport, onRestoreSnapshot, onResetData, onLifeProfileChange, onAppearanceChange }: { state: AppState; recoveryAvailable: boolean; onExportJson: () => void; onExportZip: () => void; onExportEncrypted: (password: string) => void | Promise<void>; onImport: (file: File, password: string) => void; onRestoreSnapshot: () => void; onResetData: () => void | Promise<void>; onLifeProfileChange: (patch: { displayLifeProgress?: boolean; birthDate?: string; lifeExpectancyYears?: number }) => void; onAppearanceChange: (patch: { theme?: ThemeMode; displayDensity?: DisplayDensity; numberFormat?: NumberFormat }) => void }): ReactElement {
  const fileInputId = 'backup-import'
  const [backupPassword, setBackupPassword] = useState('')
  const passwordReady = backupPassword.trim().length >= 8
  return <div className="page page-settings modern-settings world-page world-settings">
    <WorldHeader marker="REGISTRY / 妥善保存" title="我的" description="你的时间册，保存在这台电脑上。" />
    <div className="settings-layout">
      <section className="profile-card"><div className="profile-card-top"><span>PERSONAL ARCHIVE</span><span>NO. 0001</span></div><div className="profile-identity"><div className="large-avatar">{state.settings.displayName.slice(0, 1) || '我'}</div><div><span className="eyebrow">我的时间册</span><h2>{state.settings.displayName}</h2><p>一份还在继续的个人档案。</p></div></div><div className="profile-card-foot"><span>LOCAL ONLY</span><span>几度 / MEMENTO</span></div></section>
      <section className="stats-strip"><Stat value={formatDisplayNumber(state.moments.length, state.settings.numberFormat ?? 'plain')} label="个时刻" /><Stat value={formatDisplayNumber(state.elapsed.length, state.settings.numberFormat ?? 'plain')} label="段经年" /><Stat value={formatDisplayNumber(state.remaining.length, state.settings.numberFormat ?? 'plain')} label="段余下" /><Stat value={formatDisplayNumber(state.stages.length, state.settings.numberFormat ?? 'plain')} label="段刻度" /></section>
      <section className="settings-section data-settings"><div className="section-heading"><div><span className="eyebrow">01 / 数据保险柜</span><h2>带走你的时间</h2></div><Archive size={21} strokeWidth={1.5} /></div><p className="section-note">完整备份会包含记录与照片。替换导入和清空数据前，会自动保留一份本地快照。</p><form className="encrypted-backup-row" aria-label="加密备份" onSubmit={(event) => { event.preventDefault(); if (passwordReady) void onExportEncrypted(backupPassword) }}><label>备份密码 <span className="optional">加密导出或导入时使用</span><input name="backupPassword" autoComplete="new-password" type="password" minLength={8} value={backupPassword} onChange={(event) => setBackupPassword(event.target.value)} placeholder="至少 8 个字符" /></label><button type="submit" className="dark-action" disabled={!passwordReady}><KeyRound size={16} />导出加密备份</button></form><p className="encrypted-backup-note">AES-GCM 加密 · 完整性校验 · 密码只在当前操作中使用。</p><div className="data-actions"><button className="outline-action" onClick={onExportJson}><ArrowDownToLine size={16} />导出 JSON</button><button className="outline-action" onClick={onExportZip}><Archive size={16} />导出完整 ZIP</button><button type="button" className="outline-action" onClick={() => document.getElementById(fileInputId)?.click()}><ArrowUpFromLine size={16} />导入备份</button><input hidden id={fileInputId} type="file" accept=".json,.zip,.memento,application/json,application/zip,application/octet-stream" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file, backupPassword); event.currentTarget.value = '' }} />{recoveryAvailable && <button className="outline-action" onClick={onRestoreSnapshot}><ArrowUpFromLine size={16} />恢复快照</button>}<button className="outline-action danger-action" onClick={() => { if (window.confirm('清空后会删除当前时间册里的所有记录和照片，但会先保留一份可恢复快照。确定继续吗？')) void onResetData() }}>清空全部数据</button></div>{recoveryAvailable && <p className="recovery-note" role="status">这里有一份替换导入或清空前的本地恢复快照。</p>}</section>
      <section className="settings-section life-settings"><div className="section-heading"><div><span className="eyebrow">02 / 可选刻度</span><h2>人生进度</h2></div><Layers3 size={21} strokeWidth={1.5} /></div><p className="section-note">只有你主动填写生日和预期年限后，才会在“刻度”里显示这条进度。</p><label className="setting-toggle"><input type="checkbox" checked={state.settings.displayLifeProgress} onChange={(event) => onLifeProfileChange({ displayLifeProgress: event.target.checked })} /><span>显示人生进度</span></label><div className="life-fields"><label>生日<input type="date" value={state.settings.birthDate ?? ''} onChange={(event) => onLifeProfileChange({ birthDate: event.target.value })} /></label><label>预期年限<input type="number" min="1" max="150" value={state.settings.lifeExpectancyYears ?? 80} onChange={(event) => onLifeProfileChange({ lifeExpectancyYears: Number(event.target.value) || 80 })} /></label></div></section>
      <section className="settings-section appearance-settings"><div className="section-heading"><div><span className="eyebrow">03 / 外观与阅读</span><h2>四个固定的阅览室</h2></div><Sparkles size={21} strokeWidth={1.5} /></div><p className="section-note">每个页面拥有自己的观看方式；你可以继续调整阅读光线、密度和数字格式。</p><WorldMap /><div className="appearance-fields"><label>阅读光线<select value={state.settings.theme ?? 'light'} onChange={(event) => onAppearanceChange({ theme: event.target.value as ThemeMode })}><option value="light">浅色</option><option value="dark">深色</option><option value="high-contrast">高对比</option></select></label><label>阅读习惯<select value={state.settings.displayDensity ?? 'comfortable'} onChange={(event) => onAppearanceChange({ displayDensity: event.target.value as DisplayDensity })}><option value="comfortable">舒适</option><option value="compact">紧凑</option></select></label><label>数字显示<select value={state.settings.numberFormat ?? 'plain'} onChange={(event) => onAppearanceChange({ numberFormat: event.target.value as NumberFormat })}><option value="plain">不分组</option><option value="grouped">千位分组</option></select></label></div></section>
      <section className="settings-section muted-section"><div className="section-heading"><div><span className="eyebrow">04 / 关于这本册子</span><h2>几度 · Memento</h2></div><Sparkles size={21} strokeWidth={1.5} /></div><p className="section-note">v2.7.0 · 本地优先 · 无账号 · 无云端</p></section>
    </div>
  </div>
}

function RecordDrawer({ type, existingRecord, availablePhotos, onClose, onChangeType, onSave }: { type: RecorderType; existingRecord?: EditableRecord; availablePhotos: PhotoAsset[]; onClose: () => void; onChangeType: (type: RecorderType) => void; onSave: (draft: RecordDraft) => void }): ReactElement {
  const existingMoment = type === 'moment' ? existingRecord as Moment | undefined : undefined
  const existingElapsed = type === 'elapsed' ? existingRecord as ElapsedCounter | undefined : undefined
  const existingRemaining = type === 'remaining' ? existingRecord as RemainingCounter | undefined : undefined
  const existingStage = type === 'stage' ? existingRecord as Stage | undefined : undefined
  const [title, setTitle] = useState(() => existingMoment?.title ?? '')
  const [date, setDate] = useState(() => existingMoment?.date ?? existingElapsed?.startDate ?? existingStage?.startDate ?? todayIso())
  const [note, setNote] = useState(() => existingMoment?.note ?? '')
  const [location, setLocation] = useState(() => existingMoment?.location ?? '')
  const [endDate, setEndDate] = useState(existingRemaining?.endDate ?? existingStage?.endDate ?? shiftIsoDate(todayIso(), 120))
  const [unit, setUnit] = useState<RemainingUnit>(existingRemaining?.unit ?? 'friday')
  const [weekdays, setWeekdays] = useState<number[]>(() => existingRemaining?.weekdays ? [...existingRemaining.weekdays] : [])
  const [momentKind, setMomentKind] = useState<MomentKind>(() => existingMoment?.kind ?? 'first')
  const [photos, setPhotos] = useState<PhotoAsset[]>(() => existingMoment ? existingMoment.photoIds.map((id) => availablePhotos.find((photo) => photo.id === id)).filter((photo): photo is PhotoAsset => Boolean(photo)) : [])
  const [validationError, setValidationError] = useState<string | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const endDateInputRef = useRef<HTMLInputElement>(null)
  const unitSelectRef = useRef<HTMLSelectElement>(null)

  const typeLabel = type === 'moment' ? (existingMoment ? '编辑这段时光' : '记录一个时刻') : type === 'elapsed' ? (existingElapsed ? '编辑这段经年' : '创建一段经年') : type === 'remaining' ? (existingRemaining ? '编辑这段余下' : '创建一段余下') : (existingStage ? '编辑这段刻度' : '创建一段刻度')

  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || photos.length >= 3) return
    const reader = new FileReader()
    reader.onload = () => setPhotos((current) => [...current, { id: makeId('photo'), dataUrl: String(reader.result), name: file.name, mimeType: file.type }])
    reader.readAsDataURL(file)
    event.currentTarget.value = ''
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) {
      setValidationError('请先给这段时间写一个名字。')
      titleInputRef.current?.focus()
      return
    }
    if (type !== 'remaining' && !isValidIsoDate(date)) {
      setValidationError('请选择一个有效的日期。')
      dateInputRef.current?.focus()
      return
    }
    if ((type === 'remaining' || type === 'stage') && !isValidIsoDate(endDate)) {
      setValidationError('请选择一个有效的结束日期。')
      endDateInputRef.current?.focus()
      return
    }
    if (type === 'stage' && endDate < date) {
      setValidationError('结束日期不能早于开始日期。')
      endDateInputRef.current?.focus()
      return
    }
    if (type === 'remaining' && unit === 'custom' && weekdays.length === 0) {
      setValidationError('请至少选择一个星期。')
      unitSelectRef.current?.focus()
      return
    }
    setValidationError(null)
    onSave({ type, existingId: existingRecord?.id, existingMomentId: existingMoment?.id, momentKind, title, date, note, location, endDate, unit, weekdays, photos })
  }

  return <div className="drawer-layer"><button className="drawer-backdrop" onClick={onClose} aria-label="关闭记录面板" /><aside className="record-drawer" role="dialog" aria-modal="true" aria-label={typeLabel}><div className="drawer-header"><div><span className="eyebrow">几度</span><h2>{typeLabel}</h2></div><button className="close-button" onClick={onClose} aria-label="关闭"><X size={19} /></button></div><div className="drawer-type-row">{(['moment', 'elapsed', 'remaining', 'stage'] as RecorderType[]).map((item) => <button type="button" key={item} className={item === type ? 'is-selected' : ''} title={RECORD_TYPE_HELP[item]} aria-pressed={item === type} onClick={() => onChangeType(item)}>{item === 'moment' ? '初见' : item === 'elapsed' ? '经年' : item === 'remaining' ? '余下' : '刻度'}</button>)}</div><p className="drawer-type-hint">{RECORD_TYPE_HELP[type]}</p><form className="record-form" aria-describedby={validationError ? 'record-form-error' : undefined} onSubmit={submit}><label>名称<input ref={titleInputRef} name="title" aria-required="true" value={title} onChange={(event) => { setTitle(event.target.value); setValidationError(null) }} placeholder={type === 'moment' ? '例如：第一次一个人旅行' : type === 'elapsed' ? '例如：来到这座城市' : type === 'remaining' ? '例如：毕业以前' : '例如：大学'} autoFocus /></label>{validationError && <p id="record-form-error" className="form-error" role="alert">{validationError}</p>}{type !== 'remaining' && <label>{type === 'stage' ? '开始日期' : type === 'moment' ? '发生日期' : '开始日期'}<input ref={dateInputRef} name="date" aria-required="true" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>}{(type === 'remaining' || type === 'stage') && <label>{type === 'remaining' ? '截止日期' : '结束日期'}<input ref={endDateInputRef} name="endDate" aria-required="true" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>}{type === 'remaining' && <><div><label htmlFor="remaining-unit"><HelpHint id="remaining-unit-help" label="想数什么" text={REMAINING_UNIT_HELP} /><select ref={unitSelectRef} id="remaining-unit" name="remainingUnit" value={unit} onChange={(event) => { setUnit(event.target.value as RemainingUnit); setValidationError(null) }}>{Object.entries(UNIT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>{unit === 'custom' && <div className="weekday-picker" role="group" aria-label="选择星期"><span>每周选择</span><div>{WEEKDAY_CHOICES.map(([day, label]) => <button type="button" key={day} className={weekdays.includes(day) ? 'is-selected' : ''} onClick={() => { setWeekdays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day]); setValidationError(null) }}>周{label}</button>)}</div></div>}</div></>}{type === 'moment' && <><label><HelpHint id="moment-kind-help" label="类型" text={MOMENT_KIND_HELP} /><select id="moment-kind" name="momentKind" aria-label="时刻类型" value={momentKind} onChange={(event) => setMomentKind(event.target.value as MomentKind)}>{Object.entries(KIND_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>地点 <span className="optional">选填</span><input name="location" autoComplete="street-address" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="例如：北海道" /></label><label>一句话 <span className="optional">选填</span><textarea name="note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="那天下午天气很好。" rows={3} /></label><label className="photo-field">照片 <span className="optional">最多 3 张</span><span className="photo-upload"><ImagePlus size={17} /><span>{photos.length >= 3 ? '照片已满' : '留下一张证据'}</span><input disabled={photos.length >= 3} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} /></span>{photos.length > 0 && <span className="photo-preview-list">{photos.map((photo) => <span className="photo-thumb" key={photo.id}><img src={photo.dataUrl} alt={photo.name} /><button type="button" onClick={() => setPhotos((current) => current.filter((item) => item.id !== photo.id))} aria-label={`移除${photo.name}`}><X size={12} /></button></span>)}</span>}</label></>}<button className="save-record" type="submit">{existingRecord ? '保存修改' : '保存这段时间'}</button></form></aside></div>
}

function MomentDetail({ moment, photos, isPinned, onPin, onShare, onClose, onEdit, onDelete }: { moment: Moment; photos: PhotoAsset[]; isPinned: boolean; onPin: () => void; onShare: () => void; onClose: () => void; onEdit: () => void; onDelete: () => void }): ReactElement {
  const momentPhotos = photos.filter((photo) => moment.photoIds.includes(photo.id))
  return <div className="drawer-layer"><button className="drawer-backdrop" onClick={onClose} aria-label="关闭详情" /><aside className="detail-drawer" role="dialog" aria-modal="true" aria-label={`${moment.title}详情`}><div className="detail-toolbar"><span className="eyebrow">{KIND_LABELS[moment.kind]}</span><div><button className={`close-button ${isPinned ? 'is-pinned' : ''}`} onClick={onPin} aria-label={isPinned ? '取消首页置顶' : '置顶到首页'}><Pin size={16} /></button><button className="close-button" onClick={onShare} aria-label="生成 Moment 分享卡"><Share2 size={16} /></button><button className="close-button" onClick={onEdit} aria-label="编辑"><Pencil size={16} /></button><button className="close-button" onClick={onDelete} aria-label="删除"><Trash2 size={17} /></button><button className="close-button" onClick={onClose} aria-label="关闭"><X size={19} /></button></div></div>{momentPhotos[0] ? <SafeImage className="detail-photo" src={momentPhotos[0].dataUrl} alt={moment.title} fileLabel={momentPhotos[0].name} /> : <div className="detail-photo-placeholder"><Archive size={30} strokeWidth={1.4} /><span>为这个时刻留一张照片</span></div>}<div className="detail-copy"><h2>{moment.title}</h2><p className="detail-date">{formatDateWithWeekday(moment.date)}</p>{moment.location && <p className="detail-location">{moment.location}</p>}<p className="detail-note">{moment.note || '有些日子，后来才知道值得记住。'}</p><div className="detail-footnote">这是时间册里的第 {moment.id === 'moment-watermelon' ? '1' : '一'} 个「{KIND_LABELS[moment.kind]}」</div></div></aside></div>
}

function StageDetail({ stage, onClose, onEdit, onToggle, onDelete }: { stage: Stage; onClose: () => void; onEdit: () => void; onToggle: () => void; onDelete: () => void }): ReactElement {
  const isLife = stage.kind === 'life'
  const lifeYears = Math.max(1, Number(stage.endDate.slice(0, 4)) - Number(stage.startDate.slice(0, 4)))
  const progress = isLife ? getLifeProgress(stage.startDate, lifeYears) : getStageProgress(stage.startDate, stage.endDate)
  return <div className="drawer-layer"><button className="drawer-backdrop" onClick={onClose} aria-label="关闭阶段详情" /><aside className="detail-drawer stage-detail-drawer" role="dialog" aria-modal="true" aria-label={`${stage.title}阶段详情`}><div className="detail-toolbar"><span className="eyebrow">阶段详情</span><div>{!isLife && <button className="close-button" onClick={onEdit} aria-label={`编辑${stage.title}`}><Pencil size={16} /></button>}<button className="close-button" onClick={onClose} aria-label="关闭"><X size={19} /></button></div></div><div className="stage-detail-copy"><span className="row-label">{formatDate(stage.startDate, 'long')} — {formatDate(stage.endDate, 'long')}</span><h2>{stage.title}</h2><div className="stage-detail-number">{progress.toFixed(1)}<small>%</small></div><div className="progress-rail"><span style={{ transform: `scaleX(${progress / 100})` }} /></div><p>{isLife ? '这是根据生日和预期年限计算的人生进度，不会修改你的其他阶段记录。' : stage.enabled ? '这段刻度正在你的时间里经过。' : '这段刻度已暂停展示。'}</p></div>{!isLife && <div className="stage-detail-actions"><button className="outline-action" onClick={onToggle}>{stage.enabled ? '暂停展示' : '重新启用'}</button><button className="outline-action danger-action" onClick={onDelete}>删除这段刻度</button></div>}</aside></div>
}

function ImportDialog({ summary, onCancel, onChoose }: { summary: BackupSummary; onCancel: () => void; onChoose: (mode: 'merge' | 'replace') => void }): ReactElement {
  return <div className="dialog-layer"><button className="dialog-backdrop" onClick={onCancel} aria-label="关闭导入预览" /><section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title"><div className="dialog-icon"><Archive size={20} /></div><div className="eyebrow">备份预览</div><h2 id="import-title">带回一段时间</h2><p className="dialog-file">{summary.fileName}</p><div className="import-summary"><span><strong>{summary.momentCount}</strong> 个时刻</span><span><strong>{summary.photoCount}</strong> 张照片</span><span>{summary.timezone}</span></div><p className="dialog-note">合并会保留本机和备份中的不同记录；替换会用备份内容覆盖本机时间册。</p><div className="dialog-actions"><button className="outline-action" onClick={onCancel}>取消</button><button className="outline-action" onClick={() => onChoose('merge')}>合并导入</button><button className="dark-action" onClick={() => onChoose('replace')}>替换本机数据</button></div></section></div>
}

function PanelHeading({ label, icon }: { label: string; icon: ReactNode }): ReactElement { return <div className="panel-heading"><span>{icon}{label}</span><MoreHorizontal size={17} /></div> }
function EmptyInline({ text }: { text: string }): ReactElement { return <div className="empty-inline"><span>{text}</span><Plus size={16} /></div> }
function EmptyState({ title, text, action }: { title: string; text: string; action: () => void }): ReactElement { return <div className="empty-state"><div className="empty-symbol">＋</div><h3>{title}</h3><p>{text}</p><button className="outline-action" onClick={action}>从这里开始</button></div> }
function Stat({ value, label }: { value: number | string; label: string }): ReactElement { return <div className="stat"><strong>{value}</strong><span>{label}</span></div> }

function NowWorldV28({ state, onRecord, onOpenMoment }: { state: AppState; onRecord: () => void; onOpenMoment: (moment: Moment) => void }): ReactElement {
  const today = todayIso()
  const [currentTime, setCurrentTime] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  const year = today.slice(0, 4)
  const timeLabel = currentTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  const dayProgress = ((currentTime.getHours() * 60 + currentTime.getMinutes()) / 1440) * 100
  const yearProgress = getYearProgress(today)
  const elapsed = pickPinned(state.elapsed, state.settings.pinnedElapsedId)
  const remaining = pickPinned(state.remaining, state.settings.pinnedRemainingId)
  const memory = pickPinned(state.moments, state.settings.pinnedMomentId) ?? state.moments.find((moment) => moment.date < today)
  const photo = memory ? getMomentPhoto(state, memory) : undefined
  const elapsedDisplay = getElapsedDisplay(elapsed ? getElapsedBreakdown(elapsed.startDate) : { days: 0, weeks: 0, months: 0, years: 0 }, state.settings.elapsedDisplayMode ?? 'days')
  const remainingDates = remaining ? getRemainingDates(remaining.endDate, remaining.unit, today, remaining.weekdays) : []

  return <div className="world-page world-now world-now-v28" data-layout="clock-stage">
    <header className="now-command">
      <div className="now-command-status"><span className="now-status-dot" aria-hidden="true" /><span>LOCAL / LIVE</span><time dateTime={today}>{formatDateWithWeekday(today)}</time></div>
      <div className="now-command-title"><span>正在发生</span><h1>此刻</h1><p>先看见今天，再把它留下来。</p></div>
      <button className="now-command-action" onClick={onRecord}><Plus size={17} />记一笔</button>
    </header>
    <section className="now-clock-grid" aria-label={`此刻 ${timeLabel}，年度进度 ${yearProgress.toFixed(1)}%`}>
      <article className="now-clock-readout">
        <div className="now-readout-meta"><span>北京时间</span><span>{year} / {today.slice(5)}</span></div>
        <div className="now-clock-value"><strong>{timeLabel}</strong><span>正在发生</span></div>
        <div className="now-clock-caption"><p>今天先被看见，才会成为记忆。</p><span>距离这一年结束还有 {getDaysRemainingInYear(today)} 天</span></div>
        <div className="now-day-meter"><div><span>今日位置</span><strong>{dayProgress.toFixed(1)}%</strong></div><span className="now-meter-line"><i style={{ transform: `scaleX(${dayProgress / 100})` }} /></span></div>
        <button className="now-record-link" onClick={onRecord}><Plus size={15} />记录正在发生的事</button>
      </article>
      <figure className="now-observation-window">
        <div className="now-window-top"><span>OBSERVATION WINDOW</span><span>{memory ? '用户记录' : '等待第一条观察'}</span></div>
        {photo ? <SafeImage src={photo.dataUrl} alt={memory?.title ?? photo.name} fileLabel={photo.name} loading="eager" /> : <div className="now-empty-window"><span>今天还没有观察</span><strong>{formatDate(today, 'long')}</strong><p>文字、日期和一个正在发生的小事，也可以成为完整记录。</p><button onClick={onRecord}>打开记录入口 <ChevronRight size={14} /></button></div>}
        {memory && <figcaption><strong>{memory.title}</strong><span>{formatDate(memory.date, 'long')}{memory.location ? ` · ${memory.location}` : ''}</span></figcaption>}
      </figure>
      <aside className="now-live-note">
        <span className="now-live-note-label">一条正在发生的事</span>
        <p>{memory?.note ?? '从一件正在发生的小事开始，让今天拥有一个可以回来的位置。'}</p>
        <button className="now-note-action" disabled={!memory} onClick={() => memory && onOpenMoment(memory)}>打开这段时光 <ChevronRight size={15} /></button>
        <div className="now-live-note-foot"><span>今日经过</span><strong>{dayProgress.toFixed(1)}%</strong></div>
      </aside>
    </section>
    <section className="now-baseline" aria-label="年度和人生时间基线">
      <div className="now-year-baseline"><div className="now-baseline-label"><span>YEAR POSITION</span><strong>{yearProgress.toFixed(1)}%</strong></div><div className="now-baseline-rail"><i style={{ transform: `scaleX(${yearProgress / 100})` }} /><b style={{ left: `${yearProgress}%` }} /></div><div className="now-baseline-dates"><span>01 / 01</span><span>{today}</span><span>12 / 31</span></div></div>
      <div className="now-baseline-measures"><div><span>经年</span><strong>{elapsed ? formatDisplayNumber(elapsedDisplay.value, state.settings.numberFormat ?? 'plain') : '—'}<small>{elapsed ? elapsedDisplay.unit : ''}</small></strong><em>{elapsed?.title ?? '还没有一段经年'}</em></div><div><span>余下</span><strong>{remaining ? formatDisplayNumber(remainingDates.length, state.settings.numberFormat ?? 'plain') : '—'}<small>{remaining ? formatCounterUnit(remaining.unit) : ''}</small></strong><em>{remaining?.title ?? '还没有一段余下'}</em></div></div>
    </section>
  </div>
}

function TimelineWorldV28({ state, filter, scrollTop, onFilterChange, onScrollPositionChange, onOpenMoment, onRecord }: { state: AppState; filter: TimelineFilter; scrollTop: number; onFilterChange: (filter: TimelineFilter) => void; onScrollPositionChange: (value: number) => void; onOpenMoment: (moment: Moment) => void; onRecord: () => void }): ReactElement {
  const currentYear = todayIso().slice(0, 4)
  const moments = useMemo(() => [...state.moments].filter((moment) => filter === 'all' || (filter === 'this_year' ? moment.date.startsWith(currentYear) : moment.kind === filter)).sort((a, b) => b.date.localeCompare(a.date)), [currentYear, filter, state.moments])
  const groups = useMemo(() => moments.reduce<Record<string, Moment[]>>((result, moment) => { const key = moment.date.slice(0, 7); result[key] = [...(result[key] ?? []), moment]; return result }, {}), [moments])
  const months = Object.keys(groups)
  const years = [...new Set(moments.map((moment) => moment.date.slice(0, 4)))]
  const filters: Array<[TimelineFilter, string]> = [['all', '全部'], ['first', '初见'], ['yearly_first', '今年第一次'], ['milestone', '人生节点'], ['this_year', '今年']]
  useEffect(() => { window.scrollTo({ top: scrollTop, behavior: 'auto' }); return () => onScrollPositionChange(window.scrollY) }, [onScrollPositionChange, scrollTop])
  const jumpTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
  const jumpToYear = (year: string) => document.querySelector<HTMLElement>(`.timeline-film-month[data-year="${year}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
  const moveTrack = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); event.currentTarget.scrollBy({ left: 420, behavior: 'smooth' }) }
    if (event.key === 'ArrowLeft') { event.preventDefault(); event.currentTarget.scrollBy({ left: -420, behavior: 'smooth' }) }
    if (event.key === 'Home') { event.preventDefault(); event.currentTarget.scrollTo({ left: 0, behavior: 'smooth' }) }
    if (event.key === 'End') { event.preventDefault(); event.currentTarget.scrollTo({ left: event.currentTarget.scrollWidth, behavior: 'smooth' }) }
  }

  return <div className="world-page world-timeline world-timeline-v28" data-layout="film-wall">
    <header className="timeline-command"><div><span>ARCHIVE / 记录证据</span><h1>时光</h1><p>沿着年月回到发生过的地方。</p></div><div className="timeline-command-right"><strong>{String(moments.length).padStart(2, '0')}</strong><span>条记录在时间里</span><button onClick={onRecord}><Plus size={17} />记一笔</button></div></header>
    <section className="timeline-ruler" aria-label="年份定位与筛选"><div className="timeline-ruler-title"><span>YEAR INDEX</span><strong>{years.length ? `${years[years.length - 1]} — ${years[0]}` : '还没有年份'}</strong></div><div className="timeline-years">{years.length ? years.map((year) => <button key={year} onClick={() => jumpToYear(year)}>{year}</button>) : <span>还没有年份</span>}</div><TimelineStoryFilters filters={filters} filter={filter} onFilterChange={onFilterChange} /></section>
    <div className="timeline-wall-body">
      <aside className="timeline-month-spine" aria-label="月份定位"><span>MONTHS</span>{months.length ? months.map((month) => <button key={month} onClick={() => jumpTo(`timeline-month-${month}`)}><strong>{month.slice(5)}</strong><small>{getMonthLabel(`${month}-01`)}</small></button>) : <span className="timeline-no-month">—</span>}</aside>
      <div className="timeline-film-track" tabIndex={0} onKeyDown={moveTrack} aria-label="横向浏览时光记录">
        {months.length ? months.map((month) => <section className="timeline-film-month" id={`timeline-month-${month}`} data-year={month.slice(0, 4)} key={month}><header><span>{month.slice(0, 4)}</span><h2>{getMonthLabel(`${month}-01`)}</h2><small>{groups[month].length} 条记录</small></header><div className="timeline-film-frames">{groups[month].map((moment) => { const photo = getMomentPhoto(state, moment); return <button className="timeline-film-frame" key={moment.id} onClick={() => onOpenMoment(moment)}><span className="timeline-frame-media">{photo ? <SafeImage src={photo.dataUrl} alt={moment.title} fileLabel={photo.name} /> : <span className="timeline-text-evidence"><small>TEXT EVIDENCE</small><strong>{moment.title}</strong></span>}</span><span className="timeline-frame-date">{formatDate(moment.date, 'short')} · {KIND_LABELS[moment.kind]}</span><strong>{moment.title}</strong><p>{moment.note ?? '这一天被时间保存下来。'}</p><ChevronRight size={15} /></button> })}</div></section>) : <div className="timeline-first-frame"><div><span>FIRST FRAME</span><h2>第一条记录，会成为时间轴的起点</h2><p>从一件最近发生的小事开始，让档案出现第一行字。</p><button className="outline-action" onClick={onRecord}>从这里开始</button></div><div className="timeline-empty-reel"><SafeImage src={summerSample} alt="" fileLabel="时间轴辅助样片" loading="eager" /><span>辅助影格 · 不代表用户记录</span></div></div>}
      </div>
    </div>
    <div className="timeline-key-help"><span>← →</span> 沿胶片带浏览 <span>HOME / END</span> 定位开头与结尾</div>
  </div>
}

function DegreeGaugeV28({ progress, mode }: { progress: number; mode: DegreeTab }): ReactElement {
  const safeProgress = Math.min(100, Math.max(0, progress))
  const radius = 114
  const circumference = 2 * Math.PI * radius
  const ticks = Array.from({ length: 24 }, (_, index) => { const angle = (index / 24) * Math.PI * 2 - Math.PI / 2; return { index, x1: 130 + Math.cos(angle) * 132, y1: 130 + Math.sin(angle) * 132, x2: 130 + Math.cos(angle) * (index % 6 === 0 ? 112 : 120), y2: 130 + Math.sin(angle) * (index % 6 === 0 ? 112 : 120) } })
  return <svg className="degree-gauge" viewBox="0 0 260 260" role="img" aria-label={`${mode === 'elapsed' ? '经年' : mode === 'remaining' ? '余下' : '刻度'} ${safeProgress.toFixed(1)}%`}><circle cx="130" cy="130" r="132" className="degree-gauge-frame" />{ticks.map((tick) => <line key={tick.index} x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2} className={tick.index % 6 === 0 ? 'is-major' : ''} />)}<circle cx="130" cy="130" r={radius} className="degree-gauge-track" /><circle cx="130" cy="130" r={radius} className="degree-gauge-progress" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - safeProgress / 100)} /><circle cx="130" cy="130" r="6" className="degree-gauge-center" /><text x="130" y="122" textAnchor="middle" className="degree-gauge-label">{mode === 'elapsed' ? 'PAST' : mode === 'remaining' ? 'NEXT' : 'PASSAGE'}</text><text x="130" y="151" textAnchor="middle" className="degree-gauge-value">{safeProgress.toFixed(1)}%</text></svg>
}

function DegreesWorldV28({ state, tab, onTabChange, onPinElapsed, onPinRemaining, onElapsedDisplayMode, onElapsedSort, onShareElapsed, onShareRemaining, onEditElapsed, onEditRemaining, onOpenStage, onRecord }: DegreesWorldProps): ReactElement {
  const tabRefs = useRef<Partial<Record<DegreeTab, HTMLButtonElement | null>>>({})
  const selectTab = (next: DegreeTab) => { onTabChange(next); tabRefs.current[next]?.focus() }
  const tabs: Array<[DegreeTab, string]> = [['elapsed', '经年'], ['remaining', '余下'], ['stage', '刻度']]
  return <div className={`world-page world-degrees world-degrees-v28 degree-page--${tab}`} data-layout="measurement-instrument">
    <div className="degree-instrument-shell">
      <aside className="degree-command-rail"><div className="degree-rail-mark">几度<span>TIME INSTRUMENT</span></div><div className="degree-rail-tabs" role="tablist" aria-label="时间方向">{tabs.map(([id, label], index) => <button key={id} ref={(element) => { tabRefs.current[id] = element }} role="tab" aria-selected={tab === id} aria-controls={`degree-panel-${id}`} tabIndex={tab === id ? 0 : -1} className={tab === id ? 'is-selected' : ''} onClick={() => selectTab(id)} onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowRight') { event.preventDefault(); selectTab(id === 'elapsed' ? 'remaining' : id === 'remaining' ? 'stage' : 'elapsed') } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') { event.preventDefault(); selectTab(id === 'elapsed' ? 'stage' : id === 'remaining' ? 'elapsed' : 'remaining') } }}><span>0{index + 1}</span><strong>{label}</strong><small>{DEGREE_TAB_NOTES[id]}</small></button>)}</div><button className="degree-rail-record" onClick={() => onRecord(tab)}><Plus size={15} />新建</button></aside>
      <main className="degree-instrument-main"><header className="degree-instrument-header"><div><span>MEASUREMENT / TIME</span><h1>几度</h1><p>把已经、余下和正在经过的时间，放在同一台仪器上观察。</p></div><span className="degree-instrument-readout">{tab === 'elapsed' ? 'PAST' : tab === 'remaining' ? 'NEXT' : 'PASSAGE'}</span></header><DegreeMeasurementPanel state={state} tab={tab} /><section className="degree-instrument-list" aria-label="时间记录列表">{tab === 'elapsed' && <ModernElapsedList state={state} visualNarrative="instrument" pinnedId={state.settings.pinnedElapsedId} displayMode={state.settings.elapsedDisplayMode ?? 'days'} sort={state.settings.elapsedSort ?? 'recent'} onPin={onPinElapsed} onShare={onShareElapsed} onEdit={onEditElapsed} onDisplayModeChange={onElapsedDisplayMode} onSortChange={onElapsedSort} onRecord={() => onRecord('elapsed')} />}{tab === 'remaining' && <ModernRemainingList state={state} visualNarrative="instrument" pinnedId={state.settings.pinnedRemainingId} onPin={onPinRemaining} onShare={onShareRemaining} onEdit={onEditRemaining} onRecord={() => onRecord('remaining')} />}{tab === 'stage' && <ModernStageList state={state} visualNarrative="instrument" onOpenStage={onOpenStage} onRecord={() => onRecord('stage')} />}</section></main>
    </div>
  </div>
}

function DegreeMeasurementPanel({ state, tab }: { state: AppState; tab: DegreeTab }): ReactElement {
  const elapsed = pickPinned(state.elapsed, state.settings.pinnedElapsedId)
  const remaining = pickPinned(state.remaining, state.settings.pinnedRemainingId)
  const stage = state.stages.find((item) => item.enabled) ?? state.stages[0]
  const display = elapsed ? getElapsedDisplay(getElapsedBreakdown(elapsed.startDate), state.settings.elapsedDisplayMode ?? 'days') : null
  const dates = remaining ? getRemainingDates(remaining.endDate, remaining.unit, todayIso(), remaining.weekdays) : []
  const progress = tab === 'elapsed' ? (elapsed ? Math.min(100, getElapsedBreakdown(elapsed.startDate).days / 3650 * 100) : 0) : tab === 'remaining' ? (remaining ? Math.min(100, dates.length / 100 * 100) : 0) : (stage ? stage.kind === 'life' ? getLifeProgress(stage.startDate, state.settings.lifeExpectancyYears ?? 80) : getStageProgress(stage.startDate, stage.endDate) : 0)
  const title = tab === 'elapsed' ? elapsed?.title ?? '还没有一段经年' : tab === 'remaining' ? remaining?.title ?? '还没有一段余下' : stage?.title ?? '还没有一段刻度'
  const dateText = tab === 'elapsed' ? (elapsed ? `${formatDate(elapsed.startDate, 'long')} 起 · 至今` : '等待一个明确的开始日期') : tab === 'remaining' ? (remaining ? `截止 ${formatDate(remaining.endDate, 'long')}` : '等待一个明确的截止日期') : (stage ? `${formatDate(stage.startDate, 'long')} — ${formatDate(stage.endDate, 'long')}` : '等待一段开始与结束日期')
  const value = tab === 'elapsed' ? (display ? `${formatDisplayNumber(display.value, state.settings.numberFormat ?? 'plain')}` : '—') : tab === 'remaining' ? (remaining ? formatDisplayNumber(dates.length, state.settings.numberFormat ?? 'plain') : '—') : stage ? progress.toFixed(1) : '—'
  const unit = tab === 'elapsed' ? display?.unit ?? '' : tab === 'remaining' ? remaining ? formatCounterUnit(remaining.unit) : '' : stage ? '%' : ''
  return <section className="degree-measurement-panel" aria-label={`${title}的主测量图`}><div className="degree-measurement-copy"><span>{tab === 'elapsed' ? 'PAST / 经年' : tab === 'remaining' ? 'FUTURE / 余下' : 'PASSAGE / 刻度'}</span><h2>{title}</h2><p>{dateText}</p><small>{tab === 'elapsed' ? '从开始日期起，已经累计的时间。' : tab === 'remaining' ? '截止日期以前仍然可以遇见的具体日子。' : '阶段从开始日期走向结束日期，当前点正在这里。'}</small></div><DegreeGaugeV28 progress={progress} mode={tab} /><div className="degree-measurement-value"><strong>{value}</strong><span>{unit}</span><p>真实数据 · 当前选择</p></div></section>
}

function SettingsWorldV28({ state, recoveryAvailable, backupPassword, onBackupPasswordChange, onExportJson, onExportZip, onExportEncrypted, onImport, onRestoreSnapshot, onResetData, onLifeProfileChange, onAppearanceChange }: { state: AppState; recoveryAvailable: boolean; backupPassword: string; onBackupPasswordChange: (value: string) => void; onExportJson: () => void; onExportZip: () => void; onExportEncrypted: (password: string) => void | Promise<void>; onImport: (file: File, password: string) => void; onRestoreSnapshot: () => void; onResetData: () => void | Promise<void>; onLifeProfileChange: (patch: { displayLifeProgress?: boolean; birthDate?: string; lifeExpectancyYears?: number }) => void; onAppearanceChange: (patch: { theme?: ThemeMode; displayDensity?: DisplayDensity; numberFormat?: NumberFormat }) => void }): ReactElement {
  const fileInputId = 'backup-import'
  const [section, setSection] = useState<SettingsSectionId>('data')
  const passwordReady = backupPassword.trim().length >= 8
  const sections: Array<[SettingsSectionId, string, string]> = [['data', '数据', '导入、导出与恢复'], ['life', '人生', '可选的时间刻度'], ['appearance', '阅读', '光线、密度与数字'], ['about', '关于', '版本与本地原则']]
  return <div className="world-page world-settings world-settings-v28" data-layout="registry-document">
    <header className="registry-header"><div><span>PERSONAL REGISTRY / LOCAL ONLY</span><h1>我的</h1><p>把这本时间册照料好。</p></div><div className="registry-identity"><strong>{state.settings.displayName.slice(0, 1) || '我'}</strong><span>{state.settings.displayName}<br />只保存在这台电脑上</span></div></header>
    <div className="registry-ledger"><span>记录总数</span><strong>{state.moments.length}</strong><span>经年</span><strong>{state.elapsed.length}</strong><span>余下</span><strong>{state.remaining.length}</strong><span>刻度</span><strong>{state.stages.length}</strong></div>
    <div className="registry-body"><nav className="registry-directory" aria-label="设置目录"><span>目录</span>{sections.map(([id, label, note]) => <button key={id} className={section === id ? 'is-selected' : ''} aria-current={section === id ? 'page' : undefined} onClick={() => setSection(id)}><strong>{label}</strong><small>{note}</small><ChevronRight size={15} /></button>)}</nav><main className="registry-document" aria-live="polite">
      {section === 'data' && <section className="registry-section registry-data"><div className="registry-section-heading"><div><span>DATA / 01</span><h2>带走你的时间</h2></div><Archive size={20} /></div><p className="section-note">完整备份会包含记录与照片。替换导入和清空数据前，会自动保留一份本地快照。</p><form className="encrypted-backup-row" aria-label="加密备份" onSubmit={(event) => { event.preventDefault(); if (passwordReady) void onExportEncrypted(backupPassword) }}><label>备份密码 <span className="optional">加密导出或导入时使用</span><input name="backupPassword" autoComplete="new-password" type="password" minLength={8} value={backupPassword} onChange={(event) => onBackupPasswordChange(event.target.value)} placeholder="至少 8 个字符" /></label><button type="submit" className="dark-action" disabled={!passwordReady}><KeyRound size={16} />导出加密备份</button></form><p className="encrypted-backup-note">AES-GCM 加密 · 完整性校验 · 密码只在当前操作中使用。</p><div className="data-actions"><button className="outline-action" onClick={onExportJson}><ArrowDownToLine size={16} />导出 JSON</button><button className="outline-action" onClick={onExportZip}><Archive size={16} />导出完整 ZIP</button><button type="button" className="outline-action" onClick={() => document.getElementById(fileInputId)?.click()}><ArrowUpFromLine size={16} />导入备份</button><input hidden id={fileInputId} type="file" accept=".json,.zip,.memento,application/json,application/zip,application/octet-stream" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file, backupPassword); event.currentTarget.value = '' }} />{recoveryAvailable && <button className="outline-action" onClick={onRestoreSnapshot}><ArrowUpFromLine size={16} />恢复快照</button>}<button className="outline-action danger-action" onClick={() => { if (window.confirm('清空后会删除当前时间册里的所有记录和照片，但会先保留一份可恢复快照。确定继续吗？')) void onResetData() }}>清空全部数据</button></div>{recoveryAvailable && <p className="recovery-note" role="status">这里有一份替换导入或清空前的本地恢复快照。</p>}</section>}
      {section === 'life' && <section className="registry-section registry-life"><div className="registry-section-heading"><div><span>LIFE / 02</span><h2>人生进度</h2></div><Layers3 size={20} /></div><p className="section-note">只有你主动填写生日和预期年限后，才会在“几度”的刻度里显示这条进度。</p><label className="setting-toggle"><input type="checkbox" checked={state.settings.displayLifeProgress} onChange={(event) => onLifeProfileChange({ displayLifeProgress: event.target.checked })} /><span>显示人生进度</span></label><div className="life-fields"><label>生日<input type="date" value={state.settings.birthDate ?? ''} onChange={(event) => onLifeProfileChange({ birthDate: event.target.value })} /></label><label>预期年限<input type="number" min="1" max="150" value={state.settings.lifeExpectancyYears ?? 80} onChange={(event) => onLifeProfileChange({ lifeExpectancyYears: Number(event.target.value) || 80 })} /></label></div></section>}
      {section === 'appearance' && <section className="registry-section registry-appearance"><div className="registry-section-heading"><div><span>READING / 03</span><h2>阅读外观</h2></div><Sparkles size={20} /></div><p className="section-note">四个页面拥有各自的观看方式；这里调整的是阅读条件，不会改变页面身份。</p><div className="appearance-fields"><label>阅读光线<select value={state.settings.theme ?? 'light'} onChange={(event) => onAppearanceChange({ theme: event.target.value as ThemeMode })}><option value="light">浅色</option><option value="dark">深色</option><option value="high-contrast">高对比</option></select></label><label>阅读习惯<select value={state.settings.displayDensity ?? 'comfortable'} onChange={(event) => onAppearanceChange({ displayDensity: event.target.value as DisplayDensity })}><option value="comfortable">舒适</option><option value="compact">紧凑</option></select></label><label>数字显示<select value={state.settings.numberFormat ?? 'plain'} onChange={(event) => onAppearanceChange({ numberFormat: event.target.value as NumberFormat })}><option value="plain">不分组</option><option value="grouped">千位分组</option></select></label></div></section>}
      {section === 'about' && <section className="registry-section registry-about"><div className="registry-section-heading"><div><span>MEMENTO / 04</span><h2>几度 · Memento</h2></div><Sparkles size={20} /></div><p className="section-note">v2.8.0 · 本地优先 · 无账号 · 无云端。你的时间只属于你。</p></section>}
    </main></div>
  </div>
}

export default function AppRoot(): ReactElement {
  return <AppErrorBoundary><App /></AppErrorBoundary>
}
