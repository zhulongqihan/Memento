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
import { exportJson, exportZip, parseBackup } from './data/backup'
import { clearRecoverySnapshot, loadRecoverySnapshot, loadState, saveRecoverySnapshot, saveState } from './data/repository'
import { downloadShareCard } from './data/cards'
import type {
  AppState,
  BackupSummary,
  DegreeTab,
  ElapsedCounter,
  ElapsedDisplayMode,
  ElapsedSort,
  Moment,
  MomentKind,
  PageId,
  PhotoAsset,
  RemainingCounter,
  RemainingUnit,
  Stage,
  TimelineFilter,
} from './domain/types'
import { mergeState } from './data/merge'
import { pickPinned } from './domain/preferences'
import {
  formatCounterUnit,
  formatDate,
  formatDateWithWeekday,
  formatRelative,
  getDaysRemainingInYear,
  getElapsedBreakdown,
  getElapsedDisplay,
  getMonthLabel,
  getRemainingDates,
  getStageProgress,
  getWeekdayLabel,
  getYearProgress,
  shiftIsoDate,
  todayIso,
} from './domain/time'

type RecorderType = 'moment' | 'elapsed' | 'remaining' | 'stage'

interface RecordDraft {
  type: RecorderType
  existingMomentId?: string
  momentKind: MomentKind
  title: string
  date: string
  note: string
  location: string
  endDate: string
  unit: RemainingUnit
  photos: PhotoAsset[]
}

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
  friday: '周五',
  saturday: '周六',
  sunday: '周日',
  weekend: '周末',
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
  const [degreeTab, setDegreeTab] = useState<DegreeTab>('elapsed')
  const [recorder, setRecorder] = useState<RecorderType | null>(null)
  const [editingMoment, setEditingMoment] = useState<Moment | null>(null)
  const [selectedMoment, setSelectedMoment] = useState<Moment | null>(null)
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
      else if (recorder) { setRecorder(null); setEditingMoment(null) }
      else if (selectedMoment) setSelectedMoment(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pendingImport, recorder, selectedMoment])

  const updateState = useCallback((updater: (current: AppState) => AppState) => {
    setState((current) => (current ? updater(current) : current))
  }, [])

  const handleRecord = useCallback((draft: RecordDraft) => {
    const timestamp = new Date().toISOString()
    updateState((current) => {
      if (draft.type === 'moment') {
        const photoIds = draft.photos.map((photo) => photo.id)
        if (draft.existingMomentId) {
          const existing = current.moments.find((item) => item.id === draft.existingMomentId)
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
        const remaining: RemainingCounter = {
          id: makeId('remaining'),
          title: draft.title.trim(),
          endDate: draft.endDate,
          unit: draft.unit,
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
      return { ...current, stages: [stage, ...current.stages] }
    })
    setRecorder(null)
    setEditingMoment(null)
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

  const importData = useCallback(async (file: File) => {
    try {
      const imported = await parseBackup(file)
      setPendingImport(imported)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '导入失败，请检查备份文件。')
    }
  }, [updateState])

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
      const dates = getRemainingDates(item.endDate, item.unit)
      await downloadShareCard('remaining', { title: item.title, count: dates.length, unit: formatCounterUnit(item.unit), nextDate: dates[0] ? formatDate(dates[0].date, 'short') : undefined })
      setNotice('余下分享卡已经生成。')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '分享卡生成失败。')
    }
  }, [])

  const openMomentEdit = useCallback((moment: Moment) => {
    setSelectedMoment(null)
    setEditingMoment(moment)
    setRecorder('moment')
  }, [])

  const changeRecorderType = useCallback((type: RecorderType) => {
    if (type !== 'moment') setEditingMoment(null)
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

  const handleTimelineFilterChange = useCallback((filter: TimelineFilter) => {
    updateState((current) => ({ ...current, settings: { ...current.settings, timelineFilter: filter } }))
    setTimelineScrollTop(0)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [updateState])

  if (!state) {
    return <div className="loading-screen">正在打开你的时间册<span>。</span><span>。</span><span>。</span></div>
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} onNavigate={setPage} onRecord={() => setRecorder('moment')} name={state.settings.displayName} />
      <main className="main-column">
        <div className="content-frame">
          {page === 'now' && <NowPage state={state} onRecord={() => setRecorder('moment')} onOpenMoment={setSelectedMoment} />}
          {page === 'timeline' && <TimelinePage state={state} filter={state.settings.timelineFilter ?? 'all'} scrollTop={timelineScrollTop} onFilterChange={handleTimelineFilterChange} onScrollPositionChange={setTimelineScrollTop} onOpenMoment={setSelectedMoment} onRecord={() => setRecorder('moment')} />}
          {page === 'degrees' && <DegreesPage state={state} tab={degreeTab} onTabChange={setDegreeTab} onPinElapsed={(id) => setPinned('pinnedElapsedId', id)} onPinRemaining={(id) => setPinned('pinnedRemainingId', id)} onElapsedDisplayMode={setElapsedDisplayMode} onElapsedSort={setElapsedSort} onShareElapsed={shareElapsed} onShareRemaining={shareRemaining} onRecord={setRecorder} />}
          {page === 'settings' && <SettingsPage state={state} recoveryAvailable={recoveryAvailable} onExportJson={() => void exportJson(state)} onExportZip={() => void exportZip(state)} onImport={importData} onRestoreSnapshot={restoreRecovery} />}
        </div>
      </main>
      {recorder && <RecordDrawer type={recorder} existingMoment={editingMoment ?? undefined} availablePhotos={state.photos} onClose={() => { setRecorder(null); setEditingMoment(null) }} onChangeType={changeRecorderType} onSave={handleRecord} />}
      {selectedMoment && <MomentDetail moment={selectedMoment} photos={state.photos} isPinned={state.settings.pinnedMomentId === selectedMoment.id} onPin={() => setPinned('pinnedMomentId', selectedMoment.id)} onShare={() => void shareMoment(selectedMoment)} onClose={() => setSelectedMoment(null)} onEdit={() => openMomentEdit(selectedMoment)} onDelete={() => { if (window.confirm('确定要移除这段记录吗？')) deleteMoment(selectedMoment.id) }} />}
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
  const remainingDates = remaining ? getRemainingDates(remaining.endDate, remaining.unit) : []

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
            <div className="feature-number">{elapsedDisplay.value}<small>{elapsedDisplay.unit}</small></div>
            <div className="feature-meta">{formatDate(elapsed.startDate, 'short')} — 至今</div>
            <p className="feature-caption">原来已经这么久了。</p>
          </> : <EmptyInline text="还没有一段经年" />}
        </section>
        <section className="feature-panel remaining-panel">
          <PanelHeading label="余下" icon={<CalendarDays size={15} />} />
          {remaining ? <>
            <div className="feature-title">{remaining.title}</div>
            <div className="feature-number">{remainingDates.length}<small>{formatCounterUnit(remaining.unit)}</small></div>
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

function DegreesPage({ state, tab, onTabChange, onPinElapsed, onPinRemaining, onElapsedDisplayMode, onElapsedSort, onShareElapsed, onShareRemaining, onRecord }: { state: AppState; tab: DegreeTab; onTabChange: (tab: DegreeTab) => void; onPinElapsed: (id: string) => void; onPinRemaining: (id: string) => void; onElapsedDisplayMode: (mode: ElapsedDisplayMode) => void; onElapsedSort: (sort: ElapsedSort) => void; onShareElapsed: (item: ElapsedCounter) => void; onShareRemaining: (item: RemainingCounter) => void; onRecord: (type: RecorderType) => void }): ReactElement {
  return (
    <div className="page page-degrees">
      <PageIntro eyebrow="时间的三种方向" title="几度" description="已经走了多少，还能看见多少。" />
      <div className="degree-tabs" role="tablist">
        {([['elapsed', '经年'], ['remaining', '余下'], ['stage', '刻度']] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-selected' : ''} onClick={() => onTabChange(id)}>{label}</button>)}
      </div>
      {tab === 'elapsed' && <ElapsedList state={state} pinnedId={state.settings.pinnedElapsedId} displayMode={state.settings.elapsedDisplayMode ?? 'days'} sort={state.settings.elapsedSort ?? 'recent'} onPin={onPinElapsed} onShare={onShareElapsed} onDisplayModeChange={onElapsedDisplayMode} onSortChange={onElapsedSort} onRecord={() => onRecord('elapsed')} />}
      {tab === 'remaining' && <RemainingList state={state} pinnedId={state.settings.pinnedRemainingId} onPin={onPinRemaining} onShare={onShareRemaining} onRecord={() => onRecord('remaining')} />}
      {tab === 'stage' && <StageList state={state} onRecord={() => onRecord('stage')} />}
    </div>
  )
}

function ElapsedList({ state, pinnedId, displayMode, sort, onPin, onShare, onDisplayModeChange, onSortChange, onRecord }: { state: AppState; pinnedId?: string; displayMode: ElapsedDisplayMode; sort: ElapsedSort; onPin: (id: string) => void; onShare: (item: ElapsedCounter) => void; onDisplayModeChange: (mode: ElapsedDisplayMode) => void; onSortChange: (sort: ElapsedSort) => void; onRecord: () => void }): ReactElement {
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
      return <article className="degree-row" key={item.id}><div><span className="row-label">{formatDate(item.startDate, 'short')} — 至今</span><h2>{item.title}</h2></div><div className="row-number">{display.value}<small>{display.unit}</small></div><div className="row-actions"><button className={`pin-button ${pinnedId === item.id ? 'is-pinned' : ''}`} onClick={() => onPin(item.id)} aria-label={pinnedId === item.id ? '取消置顶' : '置顶'}><Pin size={16} /></button><button className="share-button" onClick={() => onShare(item)} aria-label="生成经年分享卡"><Share2 size={16} /></button></div></article>
    })}
  </DegreeListShell>
}

function RemainingList({ state, pinnedId, onPin, onShare, onRecord }: { state: AppState; pinnedId?: string; onPin: (id: string) => void; onShare: (item: RemainingCounter) => void; onRecord: () => void }): ReactElement {
  const items = useMemo(() => [...state.remaining].sort((a, b) => a.endDate.localeCompare(b.endDate)), [state.remaining])
  return <DegreeListShell title="还剩下的具体日子" action={onRecord} empty={state.remaining.length === 0} emptyText="还没有一段余下。">
    {items.map((item) => {
      const dates = getRemainingDates(item.endDate, item.unit)
      return <article className="degree-row" key={item.id}><div><span className="row-label">截止 · {formatDate(item.endDate, 'short')}</span><h2>{item.title}</h2><span className="row-caption">下一次 · {dates[0] ? `${formatDate(dates[0].date, 'short')} ${getWeekdayLabel(dates[0].date)}` : '已经到了'}</span><div className="remaining-date-list" aria-label={`${item.title} 接下来日期`}>{dates.slice(0, 5).map((date) => <span className="remaining-date" key={date.date}>{formatDate(date.date, 'short')} <small>{getWeekdayLabel(date.date)}</small></span>)}{dates.length > 5 && <span className="remaining-more">+{dates.length - 5} 个</span>}</div></div><div className="row-number">{dates.length}<small>{formatCounterUnit(item.unit)}</small></div><div className="row-actions"><button className={`pin-button ${pinnedId === item.id ? 'is-pinned' : ''}`} onClick={() => onPin(item.id)} aria-label={pinnedId === item.id ? '取消置顶' : '置顶'}><Pin size={16} /></button><button className="share-button" onClick={() => onShare(item)} aria-label="生成余下分享卡"><Share2 size={16} /></button></div></article>
    })}
  </DegreeListShell>
}

function StageList({ state, onRecord }: { state: AppState; onRecord: () => void }): ReactElement {
  return <DegreeListShell title="正在经过的阶段" action={onRecord} empty={state.stages.length === 0} emptyText="还没有一段刻度。">
    {state.stages.filter((stage) => stage.enabled).map((item) => {
      const progress = getStageProgress(item.startDate, item.endDate)
      return <article className="stage-row" key={item.id}><div className="stage-row-head"><div><span className="row-label">{formatDate(item.startDate, 'short')} — {formatDate(item.endDate, 'short')}</span><h2>{item.title}</h2></div><strong>{progress.toFixed(1)}%</strong></div><div className="progress-rail"><span style={{ width: `${progress}%` }} /></div><span className="stage-caption">时间走到这里。</span></article>
    })}
  </DegreeListShell>
}

function DegreeListShell({ title, action, controls, empty, emptyText, children }: { title: string; action: () => void; controls?: ReactNode; empty: boolean; emptyText: string; children: ReactNode }): ReactElement {
  return <section className="degree-list-shell"><div className="section-heading"><div><span className="eyebrow">几度</span><h2>{title}</h2></div><div className="heading-actions">{controls}<button className="icon-text-button" onClick={action}><Plus size={16} />新建</button></div></div>{empty ? <EmptyState title={emptyText} text="从一个明确的日期开始，给时间一个名字。" action={action} /> : <div className="degree-list">{children}</div>}</section>
}

function SettingsPage({ state, recoveryAvailable, onExportJson, onExportZip, onImport, onRestoreSnapshot }: { state: AppState; recoveryAvailable: boolean; onExportJson: () => void; onExportZip: () => void; onImport: (file: File) => void; onRestoreSnapshot: () => void }): ReactElement {
  const fileInputId = 'backup-import'
  return <div className="page page-settings">
    <PageIntro eyebrow="只属于你的资料" title="我的" description="你的记录保存在这台电脑上。" />
    <div className="settings-layout">
      <section className="profile-card"><div className="large-avatar">{state.settings.displayName.slice(0, 1)}</div><div><span className="eyebrow">我的时间册</span><h2>{state.settings.displayName}</h2><p>一份还在继续的个人档案。</p></div></section>
      <section className="stats-strip"><Stat value={state.moments.length} label="个时刻" /><Stat value={state.elapsed.length} label="段经年" /><Stat value={state.remaining.length} label="段余下" /><Stat value={state.stages.length} label="段刻度" /></section>
      <section className="settings-section"><div className="section-heading"><div><span className="eyebrow">数据</span><h2>带走你的时间</h2></div><Archive size={22} strokeWidth={1.5} /></div><p className="section-note">完整备份会包含记录与照片，可以在另一台电脑恢复。替换导入前会自动保留一份本地快照。</p><div className="data-actions"><button className="outline-action" onClick={onExportJson}><ArrowDownToLine size={16} />导出 JSON</button><button className="dark-action" onClick={onExportZip}><Archive size={16} />导出完整 ZIP</button><label className="outline-action" htmlFor={fileInputId}><ArrowUpFromLine size={16} />导入备份<input id={fileInputId} type="file" accept=".json,.zip,application/json,application/zip" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.currentTarget.value = '' }} /></label>{recoveryAvailable && <button className="outline-action" onClick={onRestoreSnapshot}><ArrowUpFromLine size={16} />恢复替换前快照</button>}</div>{recoveryAvailable && <p className="recovery-note" role="status">这里有一份替换导入前的本地恢复快照。</p>}</section>
      <section className="settings-section muted-section"><div className="section-heading"><div><span className="eyebrow">关于</span><h2>几度 · Memento</h2></div><Sparkles size={22} strokeWidth={1.5} /></div><p className="section-note">v2.1.0 · 本地优先 · 无账号 · 无云端</p></section>
    </div>
  </div>
}

function RecordDrawer({ type, existingMoment, availablePhotos, onClose, onChangeType, onSave }: { type: RecorderType; existingMoment?: Moment; availablePhotos: PhotoAsset[]; onClose: () => void; onChangeType: (type: RecorderType) => void; onSave: (draft: RecordDraft) => void }): ReactElement {
  const [title, setTitle] = useState(() => existingMoment?.title ?? '')
  const [date, setDate] = useState(() => existingMoment?.date ?? todayIso())
  const [note, setNote] = useState(() => existingMoment?.note ?? '')
  const [location, setLocation] = useState(() => existingMoment?.location ?? '')
  const [endDate, setEndDate] = useState(shiftIsoDate(todayIso(), 120))
  const [unit, setUnit] = useState<RemainingUnit>('friday')
  const [momentKind, setMomentKind] = useState<MomentKind>(() => existingMoment?.kind ?? 'first')
  const [photos, setPhotos] = useState<PhotoAsset[]>(() => existingMoment ? existingMoment.photoIds.map((id) => availablePhotos.find((photo) => photo.id === id)).filter((photo): photo is PhotoAsset => Boolean(photo)) : [])
  const [validationError, setValidationError] = useState<string | null>(null)

  const typeLabel = type === 'moment' ? (existingMoment ? '编辑这段时光' : '记录一个时刻') : type === 'elapsed' ? '创建一段经年' : type === 'remaining' ? '创建一段余下' : '创建一段刻度'

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
    setValidationError(null)
    onSave({ type, existingMomentId: existingMoment?.id, momentKind, title, date, note, location, endDate, unit, photos })
  }

  return <div className="drawer-layer"><button className="drawer-backdrop" onClick={onClose} aria-label="关闭记录面板" /><aside className="record-drawer" role="dialog" aria-modal="true" aria-label={typeLabel}><div className="drawer-header"><div><span className="eyebrow">几度</span><h2>{typeLabel}</h2></div><button className="close-button" onClick={onClose} aria-label="关闭"><X size={19} /></button></div><div className="drawer-type-row">{(['moment', 'elapsed', 'remaining', 'stage'] as RecorderType[]).map((item) => <button type="button" key={item} className={item === type ? 'is-selected' : ''} onClick={() => onChangeType(item)}>{item === 'moment' ? '初见' : item === 'elapsed' ? '经年' : item === 'remaining' ? '余下' : '刻度'}</button>)}</div><form className="record-form" onSubmit={submit}><label>名称<input value={title} onChange={(event) => { setTitle(event.target.value); setValidationError(null) }} placeholder={type === 'moment' ? '例如：第一次一个人旅行' : type === 'elapsed' ? '例如：来到这座城市' : type === 'remaining' ? '例如：毕业以前' : '例如：大学'} autoFocus /></label>{validationError && <p className="form-error" role="alert">{validationError}</p>}<label>{type === 'remaining' || type === 'stage' ? '开始日期' : type === 'moment' ? '发生日期' : '开始日期'}<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>{(type === 'remaining' || type === 'stage') && <label>结束日期<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>}{type === 'remaining' && <label>想数什么<select value={unit} onChange={(event) => setUnit(event.target.value as RemainingUnit)}>{Object.entries(UNIT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}{type === 'moment' && <><label>类型<select value={momentKind} onChange={(event) => setMomentKind(event.target.value as MomentKind)}>{Object.entries(KIND_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>地点 <span className="optional">选填</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="例如：北海道" /></label><label>一句话 <span className="optional">选填</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="那天下午天气很好。" rows={3} /></label><label className="photo-field">照片 <span className="optional">最多 3 张</span><span className="photo-upload"><ImagePlus size={17} /><span>{photos.length >= 3 ? '照片已满' : '留下一张证据'}</span><input disabled={photos.length >= 3} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} /></span>{photos.length > 0 && <span className="photo-preview-list">{photos.map((photo) => <span className="photo-thumb" key={photo.id}><img src={photo.dataUrl} alt={photo.name} /><button type="button" onClick={() => setPhotos((current) => current.filter((item) => item.id !== photo.id))} aria-label={`移除${photo.name}`}><X size={12} /></button></span>)}</span>}</label></>}<button className="save-record" type="submit">{existingMoment ? '保存修改' : '保存这段时间'}</button></form></aside></div>
}

function MomentDetail({ moment, photos, isPinned, onPin, onShare, onClose, onEdit, onDelete }: { moment: Moment; photos: PhotoAsset[]; isPinned: boolean; onPin: () => void; onShare: () => void; onClose: () => void; onEdit: () => void; onDelete: () => void }): ReactElement {
  const momentPhotos = photos.filter((photo) => moment.photoIds.includes(photo.id))
  return <div className="drawer-layer"><button className="drawer-backdrop" onClick={onClose} aria-label="关闭详情" /><aside className="detail-drawer" role="dialog" aria-modal="true" aria-label={`${moment.title}详情`}><div className="detail-toolbar"><span className="eyebrow">{KIND_LABELS[moment.kind]}</span><div><button className={`close-button ${isPinned ? 'is-pinned' : ''}`} onClick={onPin} aria-label={isPinned ? '取消首页置顶' : '置顶到首页'}><Pin size={16} /></button><button className="close-button" onClick={onShare} aria-label="生成 Moment 分享卡"><Share2 size={16} /></button><button className="close-button" onClick={onEdit} aria-label="编辑"><Pencil size={16} /></button><button className="close-button" onClick={onDelete} aria-label="删除"><Trash2 size={17} /></button><button className="close-button" onClick={onClose} aria-label="关闭"><X size={19} /></button></div></div>{momentPhotos[0] ? <img className="detail-photo" src={momentPhotos[0].dataUrl} alt={moment.title} /> : <div className="detail-photo-placeholder"><Archive size={30} strokeWidth={1.4} /><span>为这个时刻留一张照片</span></div>}<div className="detail-copy"><h2>{moment.title}</h2><p className="detail-date">{formatDateWithWeekday(moment.date)}</p>{moment.location && <p className="detail-location">{moment.location}</p>}<p className="detail-note">{moment.note || '有些日子，后来才知道值得记住。'}</p><div className="detail-footnote">这是时间册里的第 {moment.id === 'moment-watermelon' ? '1' : '一'} 个「{KIND_LABELS[moment.kind]}」</div></div></aside></div>
}

function ImportDialog({ summary, onCancel, onChoose }: { summary: BackupSummary; onCancel: () => void; onChoose: (mode: 'merge' | 'replace') => void }): ReactElement {
  return <div className="dialog-layer"><button className="dialog-backdrop" onClick={onCancel} aria-label="关闭导入预览" /><section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title"><div className="dialog-icon"><Archive size={20} /></div><div className="eyebrow">备份预览</div><h2 id="import-title">带回一段时间</h2><p className="dialog-file">{summary.fileName}</p><div className="import-summary"><span><strong>{summary.momentCount}</strong> 个时刻</span><span><strong>{summary.photoCount}</strong> 张照片</span><span>{summary.timezone}</span></div><p className="dialog-note">合并会保留本机和备份中的不同记录；替换会用备份内容覆盖本机时间册。</p><div className="dialog-actions"><button className="outline-action" onClick={onCancel}>取消</button><button className="outline-action" onClick={() => onChoose('merge')}>合并导入</button><button className="dark-action" onClick={() => onChoose('replace')}>替换本机数据</button></div></section></div>
}

function PanelHeading({ label, icon }: { label: string; icon: ReactNode }): ReactElement { return <div className="panel-heading"><span>{icon}{label}</span><MoreHorizontal size={17} /></div> }
function EmptyInline({ text }: { text: string }): ReactElement { return <div className="empty-inline"><span>{text}</span><Plus size={16} /></div> }
function EmptyState({ title, text, action }: { title: string; text: string; action: () => void }): ReactElement { return <div className="empty-state"><div className="empty-symbol">＋</div><h3>{title}</h3><p>{text}</p><button className="outline-action" onClick={action}>从这里开始</button></div> }
function Stat({ value, label }: { value: number; label: string }): ReactElement { return <div className="stat"><strong>{value}</strong><span>{label}</span></div> }

export default function AppRoot(): ReactElement {
  return <AppErrorBoundary><App /></AppErrorBoundary>
}
