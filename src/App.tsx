import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactElement, ReactNode } from 'react'
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
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { exportJson, exportZip, parseBackup } from './data/backup'
import { loadState, saveState } from './data/repository'
import type {
  AppState,
  DegreeTab,
  ElapsedCounter,
  Moment,
  MomentKind,
  PageId,
  PhotoAsset,
  RemainingCounter,
  RemainingUnit,
  Stage,
} from './domain/types'
import {
  formatCounterUnit,
  formatDate,
  formatDateWithWeekday,
  formatRelative,
  getDaysRemainingInYear,
  getElapsedBreakdown,
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

function App(): ReactElement {
  const [state, setState] = useState<AppState | null>(null)
  const [page, setPage] = useState<PageId>('now')
  const [degreeTab, setDegreeTab] = useState<DegreeTab>('elapsed')
  const [recorder, setRecorder] = useState<RecorderType | null>(null)
  const [selectedMoment, setSelectedMoment] = useState<Moment | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    void loadState().then(setState)
  }, [])

  useEffect(() => {
    if (state) void saveState(state)
  }, [state])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), 3500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const updateState = useCallback((updater: (current: AppState) => AppState) => {
    setState((current) => (current ? updater(current) : current))
  }, [])

  const handleRecord = useCallback((draft: RecordDraft) => {
    const timestamp = new Date().toISOString()
    updateState((current) => {
      if (draft.type === 'moment') {
        const photoIds = draft.photos.map((photo) => photo.id)
        const moment: Moment = {
          id: makeId('moment'),
          kind: 'first',
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
    setNotice('已经记下来了。')
  }, [updateState])

  const deleteMoment = useCallback((momentId: string) => {
    updateState((current) => {
      const moment = current.moments.find((item) => item.id === momentId)
      const photoIds = new Set(moment?.photoIds ?? [])
      return {
        ...current,
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
      updateState(() => imported)
      setNotice(`已恢复 ${imported.moments.length} 条记录。`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '导入失败，请检查备份文件。')
    }
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
          {page === 'timeline' && <TimelinePage state={state} onOpenMoment={setSelectedMoment} onRecord={() => setRecorder('moment')} />}
          {page === 'degrees' && <DegreesPage state={state} tab={degreeTab} onTabChange={setDegreeTab} onRecord={setRecorder} />}
          {page === 'settings' && <SettingsPage state={state} onExportJson={() => void exportJson(state)} onExportZip={() => void exportZip(state)} onImport={importData} />}
        </div>
      </main>
      {recorder && <RecordDrawer type={recorder} onClose={() => setRecorder(null)} onChangeType={setRecorder} onSave={handleRecord} />}
      {selectedMoment && <MomentDetail moment={selectedMoment} photos={state.photos} onClose={() => setSelectedMoment(null)} onDelete={() => deleteMoment(selectedMoment.id)} />}
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
  const elapsed = state.elapsed[0]
  const remaining = state.remaining[0]
  const memory = state.moments.find((moment) => moment.date < today) ?? state.moments[0]
  const elapsedDays = elapsed ? getElapsedBreakdown(elapsed.startDate).days : 0
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
            <div className="feature-number">{elapsedDays}<small>天</small></div>
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

function TimelinePage({ state, onOpenMoment, onRecord }: { state: AppState; onOpenMoment: (moment: Moment) => void; onRecord: () => void }): ReactElement {
  const moments = [...state.moments].sort((a, b) => b.date.localeCompare(a.date))
  const groups = moments.reduce<Record<string, Moment[]>>((result, moment) => {
    const key = moment.date.slice(0, 7)
    result[key] = [...(result[key] ?? []), moment]
    return result
  }, {})

  return (
    <div className="page page-timeline">
      <PageIntro eyebrow="一生的时间轴" title="时光" description="把发生过的事情，放回它们经过的年月。" action={<button className="quiet-action" onClick={onRecord}><Plus size={16} />记录</button>} />
      <div className="filter-row" role="tablist" aria-label="时间轴筛选">
        <button className="filter-chip is-selected">全部</button>
        <button className="filter-chip">初见</button>
        <button className="filter-chip">今年</button>
        <button className="filter-chip">人生节点</button>
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

function DegreesPage({ state, tab, onTabChange, onRecord }: { state: AppState; tab: DegreeTab; onTabChange: (tab: DegreeTab) => void; onRecord: (type: RecorderType) => void }): ReactElement {
  return (
    <div className="page page-degrees">
      <PageIntro eyebrow="时间的三种方向" title="几度" description="已经走了多少，还能看见多少。" />
      <div className="degree-tabs" role="tablist">
        {([['elapsed', '经年'], ['remaining', '余下'], ['stage', '刻度']] as const).map(([id, label]) => <button key={id} className={tab === id ? 'is-selected' : ''} onClick={() => onTabChange(id)}>{label}</button>)}
      </div>
      {tab === 'elapsed' && <ElapsedList state={state} onRecord={() => onRecord('elapsed')} />}
      {tab === 'remaining' && <RemainingList state={state} onRecord={() => onRecord('remaining')} />}
      {tab === 'stage' && <StageList state={state} onRecord={() => onRecord('stage')} />}
    </div>
  )
}

function ElapsedList({ state, onRecord }: { state: AppState; onRecord: () => void }): ReactElement {
  return <DegreeListShell title="已经经过的时间" action={onRecord} empty={state.elapsed.length === 0} emptyText="还没有一段经年。">
    {state.elapsed.map((item) => {
      const breakdown = getElapsedBreakdown(item.startDate)
      return <article className="degree-row" key={item.id}><div><span className="row-label">{formatDate(item.startDate, 'short')} — 至今</span><h2>{item.title}</h2></div><div className="row-number">{breakdown.days}<small>天</small></div><MoreHorizontal size={18} /></article>
    })}
  </DegreeListShell>
}

function RemainingList({ state, onRecord }: { state: AppState; onRecord: () => void }): ReactElement {
  return <DegreeListShell title="还剩下的具体日子" action={onRecord} empty={state.remaining.length === 0} emptyText="还没有一段余下。">
    {state.remaining.map((item) => {
      const dates = getRemainingDates(item.endDate, item.unit)
      return <article className="degree-row" key={item.id}><div><span className="row-label">截止 · {formatDate(item.endDate, 'short')}</span><h2>{item.title}</h2><span className="row-caption">下一次 · {dates[0] ? `${formatDate(dates[0].date, 'short')} ${getWeekdayLabel(dates[0].date)}` : '已经到了'}</span></div><div className="row-number">{dates.length}<small>{formatCounterUnit(item.unit)}</small></div><MoreHorizontal size={18} /></article>
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

function DegreeListShell({ title, action, empty, emptyText, children }: { title: string; action: () => void; empty: boolean; emptyText: string; children: ReactNode }): ReactElement {
  return <section className="degree-list-shell"><div className="section-heading"><div><span className="eyebrow">几度</span><h2>{title}</h2></div><button className="icon-text-button" onClick={action}><Plus size={16} />新建</button></div>{empty ? <EmptyState title={emptyText} text="从一个明确的日期开始，给时间一个名字。" action={action} /> : <div className="degree-list">{children}</div>}</section>
}

function SettingsPage({ state, onExportJson, onExportZip, onImport }: { state: AppState; onExportJson: () => void; onExportZip: () => void; onImport: (file: File) => void }): ReactElement {
  const fileInputId = 'backup-import'
  return <div className="page page-settings">
    <PageIntro eyebrow="只属于你的资料" title="我的" description="你的记录保存在这台电脑上。" />
    <div className="settings-layout">
      <section className="profile-card"><div className="large-avatar">{state.settings.displayName.slice(0, 1)}</div><div><span className="eyebrow">我的时间册</span><h2>{state.settings.displayName}</h2><p>一份还在继续的个人档案。</p></div></section>
      <section className="stats-strip"><Stat value={state.moments.length} label="个时刻" /><Stat value={state.elapsed.length} label="段经年" /><Stat value={state.remaining.length} label="段余下" /><Stat value={state.stages.length} label="段刻度" /></section>
      <section className="settings-section"><div className="section-heading"><div><span className="eyebrow">数据</span><h2>带走你的时间</h2></div><Archive size={22} strokeWidth={1.5} /></div><p className="section-note">完整备份会包含记录与照片，可以在另一台电脑恢复。</p><div className="data-actions"><button className="outline-action" onClick={onExportJson}><ArrowDownToLine size={16} />导出 JSON</button><button className="dark-action" onClick={onExportZip}><Archive size={16} />导出完整 ZIP</button><label className="outline-action" htmlFor={fileInputId}><ArrowUpFromLine size={16} />导入备份<input id={fileInputId} type="file" accept=".json,.zip,application/json,application/zip" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.currentTarget.value = '' }} /></label></div></section>
      <section className="settings-section muted-section"><div className="section-heading"><div><span className="eyebrow">关于</span><h2>几度 · Memento</h2></div><Sparkles size={22} strokeWidth={1.5} /></div><p className="section-note">v1.0.0 · 本地优先 · 无账号 · 无云端</p></section>
    </div>
  </div>
}

function RecordDrawer({ type, onClose, onChangeType, onSave }: { type: RecorderType; onClose: () => void; onChangeType: (type: RecorderType) => void; onSave: (draft: RecordDraft) => void }): ReactElement {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayIso())
  const [note, setNote] = useState('')
  const [location, setLocation] = useState('')
  const [endDate, setEndDate] = useState(shiftIsoDate(todayIso(), 120))
  const [unit, setUnit] = useState<RemainingUnit>('friday')
  const [photos, setPhotos] = useState<PhotoAsset[]>([])

  const typeLabel = type === 'moment' ? '记录一个时刻' : type === 'elapsed' ? '创建一段经年' : type === 'remaining' ? '创建一段余下' : '创建一段刻度'

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
    if (!title.trim()) return
    onSave({ type, title, date, note, location, endDate, unit, photos })
  }

  return <div className="drawer-layer"><button className="drawer-backdrop" onClick={onClose} aria-label="关闭记录面板" /><aside className="record-drawer" aria-label={typeLabel}><div className="drawer-header"><div><span className="eyebrow">几度</span><h2>{typeLabel}</h2></div><button className="close-button" onClick={onClose} aria-label="关闭"><X size={19} /></button></div><div className="drawer-type-row">{(['moment', 'elapsed', 'remaining', 'stage'] as RecorderType[]).map((item) => <button type="button" key={item} className={item === type ? 'is-selected' : ''} onClick={() => onChangeType(item)}>{item === 'moment' ? '初见' : item === 'elapsed' ? '经年' : item === 'remaining' ? '余下' : '刻度'}</button>)}</div><form className="record-form" onSubmit={submit}><label>名称<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={type === 'moment' ? '例如：第一次一个人旅行' : type === 'elapsed' ? '例如：来到这座城市' : type === 'remaining' ? '例如：毕业以前' : '例如：大学'} autoFocus /></label><label>{type === 'remaining' || type === 'stage' ? '开始日期' : type === 'moment' ? '发生日期' : '开始日期'}<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>{(type === 'remaining' || type === 'stage') && <label>结束日期<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>}{type === 'remaining' && <label>想数什么<select value={unit} onChange={(event) => setUnit(event.target.value as RemainingUnit)}>{Object.entries(UNIT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}{type === 'moment' && <><label>地点 <span className="optional">选填</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="例如：北海道" /></label><label>一句话 <span className="optional">选填</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="那天下午天气很好。" rows={3} /></label><label className="photo-field">照片 <span className="optional">最多 3 张</span><span className="photo-upload"><ImagePlus size={17} /><span>留下一张证据</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} /></span>{photos.length > 0 && <span className="photo-count">已选择 {photos.length} 张</span>}</label></>}<button className="save-record" type="submit">保存这段时间</button></form></aside></div>
}

function MomentDetail({ moment, photos, onClose, onDelete }: { moment: Moment; photos: PhotoAsset[]; onClose: () => void; onDelete: () => void }): ReactElement {
  const momentPhotos = photos.filter((photo) => moment.photoIds.includes(photo.id))
  return <div className="drawer-layer"><button className="drawer-backdrop" onClick={onClose} aria-label="关闭详情" /><aside className="detail-drawer"><div className="detail-toolbar"><span className="eyebrow">{KIND_LABELS[moment.kind]}</span><div><button className="close-button" onClick={onDelete} aria-label="删除"><Trash2 size={17} /></button><button className="close-button" onClick={onClose} aria-label="关闭"><X size={19} /></button></div></div>{momentPhotos[0] ? <img className="detail-photo" src={momentPhotos[0].dataUrl} alt={moment.title} /> : <div className="detail-photo-placeholder"><Archive size={30} strokeWidth={1.4} /><span>为这个时刻留一张照片</span></div>}<div className="detail-copy"><h2>{moment.title}</h2><p className="detail-date">{formatDateWithWeekday(moment.date)}</p>{moment.location && <p className="detail-location">{moment.location}</p>}<p className="detail-note">{moment.note || '有些日子，后来才知道值得记住。'}</p><div className="detail-footnote">这是时间册里的第 {moment.id === 'moment-watermelon' ? '1' : '一'} 个「{KIND_LABELS[moment.kind]}」</div></div></aside></div>
}

function PanelHeading({ label, icon }: { label: string; icon: ReactNode }): ReactElement { return <div className="panel-heading"><span>{icon}{label}</span><MoreHorizontal size={17} /></div> }
function EmptyInline({ text }: { text: string }): ReactElement { return <div className="empty-inline"><span>{text}</span><Plus size={16} /></div> }
function EmptyState({ title, text, action }: { title: string; text: string; action: () => void }): ReactElement { return <div className="empty-state"><div className="empty-symbol">＋</div><h3>{title}</h3><p>{text}</p><button className="outline-action" onClick={action}>从这里开始</button></div> }
function Stat({ value, label }: { value: number; label: string }): ReactElement { return <div className="stat"><strong>{value}</strong><span>{label}</span></div> }

export default App
