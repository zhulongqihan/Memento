import { Component, useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, ErrorInfo, FormEvent, ReactElement, ReactNode } from 'react'
import {
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  CalendarDays,
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
} from './domain/types'
import { mergeState } from './data/merge'
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

const UNIT_LABELS: Record<RemainingUnit, string> = {
  friday: '每个周五',
  saturday: '每个周六',
  sunday: '每个周日',
  weekend: '每个周末（周六、周日）',
  custom: '我选择的星期',
}

const UNIT_HELPERS: Record<RemainingUnit, string> = {
  friday: '会计算从今天到截止日期之间，一共有多少个周五。',
  saturday: '会计算从今天到截止日期之间，一共有多少个周六。',
  sunday: '会计算从今天到截止日期之间，一共有多少个周日。',
  weekend: '会计算从今天到截止日期之间，所有周六和周日的数量。',
  custom: '你可以在下方选择一个或多个星期，应用会计算它们还剩多少次。',
}

const WEEKDAY_CHOICES: Array<[number, string]> = [[1, '一'], [2, '二'], [3, '三'], [4, '四'], [5, '五'], [6, '六'], [0, '日']]

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
  const [degreeTab, setDegreeTab] = useState<DegreeTab>('elapsed')
  const [recorder, setRecorder] = useState<RecorderType | null>(null)
  const [editingRecord, setEditingRecord] = useState<EditableRecord | null>(null)
  const [selectedMoment, setSelectedMoment] = useState<Moment | null>(null)
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null)
  const [pendingImport, setPendingImport] = useState<BackupSummary | null>(null)
  const [recoveryAvailable, setRecoveryAvailable] = useState(false)
  const [timelineScrollTop, setTimelineScrollTop] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([loadState(), loadRecoverySnapshot()]).then(([loadedState, snapshot]) => {
      setState(loadedState)
      setRecoveryAvailable(Boolean(snapshot))
    })
  }, [])

  useEffect(() => {
    if (state) void saveState(state)
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
    <div className="app-shell" data-theme={state.settings.theme ?? 'light'} data-density={state.settings.displayDensity ?? 'comfortable'}>
      <Sidebar page={page} onNavigate={setPage} onRecord={() => setRecorder('moment')} name={state.settings.displayName} />
      <main className="main-column">
        <div className="content-frame">
          {page === 'now' && <NowPage state={state} onRecord={() => setRecorder('moment')} onOpenMoment={setSelectedMoment} />}
          {page === 'timeline' && <TimelinePage state={state} filter={state.settings.timelineFilter ?? 'all'} scrollTop={timelineScrollTop} onFilterChange={handleTimelineFilterChange} onScrollPositionChange={setTimelineScrollTop} onOpenMoment={setSelectedMoment} onRecord={() => setRecorder('moment')} />}
          {page === 'degrees' && <DegreesPage state={state} tab={degreeTab} onTabChange={setDegreeTab} onPinElapsed={(id) => setPinned('pinnedElapsedId', id)} onPinRemaining={(id) => setPinned('pinnedRemainingId', id)} onElapsedDisplayMode={setElapsedDisplayMode} onElapsedSort={setElapsedSort} onShareElapsed={shareElapsed} onShareRemaining={shareRemaining} onEditElapsed={(item) => openRecordEdit('elapsed', item)} onEditRemaining={(item) => openRecordEdit('remaining', item)} onOpenStage={setSelectedStage} onRecord={setRecorder} />}
          {page === 'settings' && <SettingsPage state={state} recoveryAvailable={recoveryAvailable} onExportJson={() => void exportJson(state)} onExportZip={() => void exportZip(state)} onExportEncrypted={exportEncrypted} onImport={importData} onRestoreSnapshot={restoreRecovery} onResetData={resetData} onLifeProfileChange={setLifeProfile} onAppearanceChange={setAppearance} />}
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
          <button key={id} className={`nav-item ${page === id ? 'is-active' : ''}`} onClick={() => onNavigate(id)}>
            <Icon size={17} strokeWidth={1.8} />
            <span>{label}</span>
            {page === id && <span className="active-dot" aria-hidden="true" />}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <button className="record-button" onClick={onRecord}>
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
        <div className="progress-rail"><span style={{ width: `${yearProgress}%` }} /></div>
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
    <div className="page page-degrees">
      <PageIntro eyebrow="时间的三种方向" title="几度" description="已经走了多少，还能看见多少。" />
      <div className="degree-tabs" role="tablist">
        {([['elapsed', '经年'], ['remaining', '余下'], ['stage', '刻度']] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-selected' : ''} onClick={() => onTabChange(id)}>{label}</button>)}
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
  return <DegreeListShell title="已经经过的时间" action={onRecord} controls={controls} empty={state.elapsed.length === 0} emptyText="还没有一段经年。">
    {items.map((item) => {
      const breakdown = getElapsedBreakdown(item.startDate)
      const display = getElapsedDisplay(breakdown, displayMode)
      return <article className="degree-row" key={item.id}><div><span className="row-label">{formatDate(item.startDate, 'short')} — 至今</span><h2>{item.title}</h2></div><div className="row-number">{display.value}<small>{display.unit}</small></div><div className="row-actions"><button className={`pin-button ${pinnedId === item.id ? 'is-pinned' : ''}`} onClick={() => onPin(item.id)} aria-label={pinnedId === item.id ? '取消置顶' : '置顶'}><Pin size={16} /></button><button className="share-button" onClick={() => onShare(item)} aria-label="生成经年分享卡"><Share2 size={16} /></button><button className="share-button" onClick={() => onEdit(item)} aria-label={`编辑${item.title}`}><Pencil size={16} /></button></div></article>
    })}
  </DegreeListShell>
}

function RemainingList({ state, pinnedId, onPin, onShare, onEdit, onRecord }: { state: AppState; pinnedId?: string; onPin: (id: string) => void; onShare: (item: RemainingCounter) => void; onEdit: (item: RemainingCounter) => void; onRecord: () => void }): ReactElement {
  const items = useMemo(() => [...state.remaining].sort((a, b) => a.endDate.localeCompare(b.endDate)), [state.remaining])
  return <DegreeListShell title="还剩下的具体日子" action={onRecord} empty={state.remaining.length === 0} emptyText="还没有一段余下。">
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

  return <DegreeListShell title="正在经过的阶段" action={onRecord} empty={stages.length === 0} emptyText="还没有一段刻度。">
    {stages.map((item) => {
      const progress = item.kind === 'life' ? getLifeProgress(item.startDate, state.settings.lifeExpectancyYears ?? 80) : getStageProgress(item.startDate, item.endDate)
      return <button className="stage-row stage-row-button" key={item.id} onClick={() => onOpenStage(item)} aria-label={`查看${item.title}阶段详情`}><div className="stage-row-head"><div><span className="row-label">{item.kind === 'life' ? `${formatDate(item.startDate, 'long')} — ${formatDate(item.endDate, 'long')}` : `${formatDate(item.startDate, 'short')} — ${formatDate(item.endDate, 'short')}`}</span><h2>{item.title}</h2></div><strong>{progress.toFixed(1)}%</strong></div><div className="progress-rail"><span style={{ width: `${progress}%` }} /></div><span className="stage-caption">{item.kind === 'life' ? '按照你的预期年限，时间走到这里。' : '时间走到这里。'}</span></button>
    })}
  </DegreeListShell>
}

function DegreeListShell({ title, action, controls, empty, emptyText, children }: { title: string; action: () => void; controls?: ReactNode; empty: boolean; emptyText: string; children: ReactNode }): ReactElement {
  return <section className="degree-list-shell"><div className="section-heading"><div><span className="eyebrow">几度</span><h2>{title}</h2></div><div className="heading-actions">{controls}<button className="icon-text-button" onClick={action}><Plus size={16} />新建</button></div></div>{empty ? <EmptyState title={emptyText} text="从一个明确的日期开始，给时间一个名字。" action={action} /> : <div className="degree-list">{children}</div>}</section>
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
      <section className="settings-section"><div className="section-heading"><div><span className="eyebrow">数据</span><h2>带走你的时间</h2></div><Archive size={22} strokeWidth={1.5} /></div><p className="section-note">完整备份会包含记录与照片，可以在另一台电脑恢复。替换导入和清空数据前都会自动保留一份本地快照。</p><div className="encrypted-backup-row"><label>备份密码 <span className="optional">加密导出或导入时使用</span><input type="password" minLength={8} value={backupPassword} onChange={(event) => setBackupPassword(event.target.value)} placeholder="至少 8 个字符" /></label><button className="dark-action" disabled={!passwordReady} onClick={() => void onExportEncrypted(backupPassword)}><KeyRound size={16} />导出加密备份</button></div><p className="encrypted-backup-note">加密备份使用 AES-GCM 保护，并带有完整性校验。导入 `.memento` 文件时会使用这里的密码。</p><div className="data-actions"><button className="outline-action" onClick={onExportJson}><ArrowDownToLine size={16} />导出 JSON</button><button className="outline-action" onClick={onExportZip}><Archive size={16} />导出完整 ZIP</button><label className="outline-action" htmlFor={fileInputId}><ArrowUpFromLine size={16} />导入备份<input id={fileInputId} type="file" accept=".json,.zip,.memento,application/json,application/zip,application/octet-stream" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file, backupPassword); event.currentTarget.value = '' }} /></label>{recoveryAvailable && <button className="outline-action" onClick={onRestoreSnapshot}><ArrowUpFromLine size={16} />恢复替换前快照</button>}<button className="outline-action danger-action" onClick={() => { if (window.confirm('清空后会删除当前时间册里的所有记录和照片，但会先保留一份可恢复快照。确定继续吗？')) void onResetData() }}>清空全部数据</button></div>{recoveryAvailable && <p className="recovery-note" role="status">这里有一份替换导入或清空前的本地恢复快照。</p>}</section>
      <section className="settings-section life-settings"><div className="section-heading"><div><span className="eyebrow">可选刻度</span><h2>人生进度</h2></div><Layers3 size={22} strokeWidth={1.5} /></div><p className="section-note">只有你主动填写生日和预期年限后，才会在“刻度”里显示这条进度。</p><label className="setting-toggle"><input type="checkbox" checked={state.settings.displayLifeProgress} onChange={(event) => onLifeProfileChange({ displayLifeProgress: event.target.checked })} /><span>显示人生进度</span></label><div className="life-fields"><label>生日<input type="date" value={state.settings.birthDate ?? ''} onChange={(event) => onLifeProfileChange({ birthDate: event.target.value })} /></label><label>预期年限<input type="number" min="1" max="150" value={state.settings.lifeExpectancyYears ?? 80} onChange={(event) => onLifeProfileChange({ lifeExpectancyYears: Number(event.target.value) || 80 })} /></label></div></section>
      <section className="settings-section appearance-settings"><div className="section-heading"><div><span className="eyebrow">显示与主题</span><h2>让时间册像你</h2></div><Sparkles size={22} strokeWidth={1.5} /></div><p className="section-note">偏好只保存在这台电脑上，不会改变你的记录内容。</p><div className="appearance-fields"><label>主题<select value={state.settings.theme ?? 'light'} onChange={(event) => onAppearanceChange({ theme: event.target.value as ThemeMode })}><option value="light">浅色</option><option value="dark">深色</option><option value="high-contrast">高对比</option></select></label><label>页面密度<select value={state.settings.displayDensity ?? 'comfortable'} onChange={(event) => onAppearanceChange({ displayDensity: event.target.value as DisplayDensity })}><option value="comfortable">舒适</option><option value="compact">紧凑</option></select></label><label>数字显示<select value={state.settings.numberFormat ?? 'plain'} onChange={(event) => onAppearanceChange({ numberFormat: event.target.value as NumberFormat })}><option value="plain">不分组</option><option value="grouped">千位分组</option></select></label></div></section>
      <section className="settings-section muted-section"><div className="section-heading"><div><span className="eyebrow">关于</span><h2>几度 · Memento</h2></div><Sparkles size={22} strokeWidth={1.5} /></div><p className="section-note">v2.5.0 · 本地优先 · 无账号 · 无云端</p></section>
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
      return
    }
    if (type !== 'remaining' && !isValidIsoDate(date)) {
      setValidationError('请选择一个有效的日期。')
      return
    }
    if ((type === 'remaining' || type === 'stage') && !isValidIsoDate(endDate)) {
      setValidationError('请选择一个有效的结束日期。')
      return
    }
    if (type === 'stage' && endDate < date) {
      setValidationError('结束日期不能早于开始日期。')
      return
    }
    if (type === 'remaining' && unit === 'custom' && weekdays.length === 0) {
      setValidationError('请至少选择一个星期。')
      return
    }
    setValidationError(null)
    onSave({ type, existingId: existingRecord?.id, existingMomentId: existingMoment?.id, momentKind, title, date, note, location, endDate, unit, weekdays, photos })
  }

  return <div className="drawer-layer"><button className="drawer-backdrop" onClick={onClose} aria-label="关闭记录面板" /><aside className="record-drawer" role="dialog" aria-modal="true" aria-label={typeLabel}><div className="drawer-header"><div><span className="eyebrow">几度</span><h2>{typeLabel}</h2></div><button className="close-button" onClick={onClose} aria-label="关闭"><X size={19} /></button></div><div className="drawer-type-row">{(['moment', 'elapsed', 'remaining', 'stage'] as RecorderType[]).map((item) => <button type="button" key={item} className={item === type ? 'is-selected' : ''} onClick={() => onChangeType(item)}>{item === 'moment' ? '初见' : item === 'elapsed' ? '经年' : item === 'remaining' ? '余下' : '刻度'}</button>)}</div><form className="record-form" onSubmit={submit}><label>名称<input value={title} onChange={(event) => { setTitle(event.target.value); setValidationError(null) }} placeholder={type === 'moment' ? '例如：第一次一个人旅行' : type === 'elapsed' ? '例如：来到这座城市' : type === 'remaining' ? '例如：毕业以前' : '例如：大学'} autoFocus /></label>{validationError && <p className="form-error" role="alert">{validationError}</p>}{type !== 'remaining' && <label>{type === 'stage' ? '开始日期' : type === 'moment' ? '发生日期' : '开始日期'}<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>}{(type === 'remaining' || type === 'stage') && <label>{type === 'remaining' ? '截止日期' : '结束日期'}<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>}{type === 'remaining' && <><div><label htmlFor="remaining-unit">截止前要统计的日子<select id="remaining-unit" value={unit} aria-describedby="remaining-unit-help" onChange={(event) => { setUnit(event.target.value as RemainingUnit); setValidationError(null) }}>{Object.entries(UNIT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><p className="row-caption" id="remaining-unit-help">{UNIT_HELPERS[unit]}</p></div>{unit === 'custom' && <div className="weekday-picker" role="group" aria-label="选择星期"><span>请选择要统计的星期</span><div>{WEEKDAY_CHOICES.map(([day, label]) => <button type="button" key={day} className={weekdays.includes(day) ? 'is-selected' : ''} onClick={() => { setWeekdays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day]); setValidationError(null) }}>周{label}</button>)}</div></div>}</>}{type === 'moment' && <><label>类型<select value={momentKind} onChange={(event) => setMomentKind(event.target.value as MomentKind)}>{Object.entries(KIND_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>地点 <span className="optional">选填</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="例如：北海道" /></label><label>一句话 <span className="optional">选填</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="那天下午天气很好。" rows={3} /></label><label className="photo-field">照片 <span className="optional">最多 3 张</span><span className="photo-upload"><ImagePlus size={17} /><span>{photos.length >= 3 ? '照片已满' : '留下一张证据'}</span><input disabled={photos.length >= 3} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} /></span>{photos.length > 0 && <span className="photo-preview-list">{photos.map((photo) => <span className="photo-thumb" key={photo.id}><img src={photo.dataUrl} alt={photo.name} /><button type="button" onClick={() => setPhotos((current) => current.filter((item) => item.id !== photo.id))} aria-label={`移除${photo.name}`}><X size={12} /></button></span>)}</span>}</label></>}<button className="save-record" type="submit">{existingRecord ? '保存修改' : '保存这段时间'}</button></form></aside></div>
}

function MomentDetail({ moment, photos, isPinned, onPin, onShare, onClose, onEdit, onDelete }: { moment: Moment; photos: PhotoAsset[]; isPinned: boolean; onPin: () => void; onShare: () => void; onClose: () => void; onEdit: () => void; onDelete: () => void }): ReactElement {
  const momentPhotos = photos.filter((photo) => moment.photoIds.includes(photo.id))
  return <div className="drawer-layer"><button className="drawer-backdrop" onClick={onClose} aria-label="关闭详情" /><aside className="detail-drawer" role="dialog" aria-modal="true" aria-label={`${moment.title}详情`}><div className="detail-toolbar"><span className="eyebrow">{KIND_LABELS[moment.kind]}</span><div><button className={`close-button ${isPinned ? 'is-pinned' : ''}`} onClick={onPin} aria-label={isPinned ? '取消首页置顶' : '置顶到首页'}><Pin size={16} /></button><button className="close-button" onClick={onShare} aria-label="生成 Moment 分享卡"><Share2 size={16} /></button><button className="close-button" onClick={onEdit} aria-label="编辑"><Pencil size={16} /></button><button className="close-button" onClick={onDelete} aria-label="删除"><Trash2 size={17} /></button><button className="close-button" onClick={onClose} aria-label="关闭"><X size={19} /></button></div></div>{momentPhotos[0] ? <img className="detail-photo" src={momentPhotos[0].dataUrl} alt={moment.title} /> : <div className="detail-photo-placeholder"><Archive size={30} strokeWidth={1.4} /><span>为这个时刻留一张照片</span></div>}<div className="detail-copy"><h2>{moment.title}</h2><p className="detail-date">{formatDateWithWeekday(moment.date)}</p>{moment.location && <p className="detail-location">{moment.location}</p>}<p className="detail-note">{moment.note || '有些日子，后来才知道值得记住。'}</p><div className="detail-footnote">这是时间册里的第 {moment.id === 'moment-watermelon' ? '1' : '一'} 个「{KIND_LABELS[moment.kind]}」</div></div></aside></div>
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

export default function AppRoot(): ReactElement {
  return <AppErrorBoundary><App /></AppErrorBoundary>
}
