import { useRef } from 'react'
import type { KeyboardEvent, ReactElement } from 'react'
import { Plus } from 'lucide-react'
import type { AppState, DegreeTab, ElapsedCounter, ElapsedDisplayMode, ElapsedSort, RemainingCounter, Stage } from '../../domain/types'
import type { RecorderType } from '../../features/records/types'
import { formatCounterUnit, formatDate, formatDisplayNumber, getElapsedBreakdown, getElapsedDisplay, getRemainingDates, getStageProgress, todayIso } from '../../domain/time'
import { pickPinned } from '../../domain/preferences'
import { CreativeWorld } from '../creative-worlds'
import { ModernElapsedList, ModernRemainingList, ModernStageList } from './shared'

export const DEGREE_TAB_NOTES: Record<DegreeTab, string> = {
  elapsed: '已经走过的时间',
  remaining: '还可以遇见的日子',
  stage: '正在经过的阶段',
}

export interface DegreesWorldProps {
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
  onDeleteElapsed: (id: string) => void
  onDeleteRemaining: (id: string) => void
  onEditRemaining: (item: RemainingCounter) => void
  onOpenStage: (stage: Stage) => void
  onRecord: (type: RecorderType) => void
}

export function DegreeScaleV29({ progress, startDate, endDate, currentDate }: { progress: number; startDate: string; endDate: string; currentDate: string }): ReactElement {
  const safeProgress = Math.min(100, Math.max(0, progress))
  const position = 58 + 700 * safeProgress / 100
  const labelX = Math.min(658, Math.max(158, position))
  return <svg className="degree29-scale" viewBox="0 0 816 170" role="img" aria-label={`从 ${startDate} 到 ${endDate}，截至 ${currentDate} 已经过 ${safeProgress.toFixed(1)}%`}><line x1="58" y1="88" x2="758" y2="88" className="degree29-scale-base" /><line x1="58" y1="88" x2={position} y2="88" className="degree29-scale-progress" />{Array.from({ length: 21 }, (_, index) => { const tickX = 58 + index * 35; return <line key={index} x1={tickX} y1={index % 5 === 0 ? 70 : 78} x2={tickX} y2="96" className={index % 5 === 0 ? 'is-major' : ''} /> })}<circle cx={position} cy="88" r="7" className="degree29-scale-point" /><text x="58" y="122">0%</text><text x="408" y="122" textAnchor="middle">50%</text><text x="758" y="122" textAnchor="end">100%</text><text x="58" y="47" className="degree29-scale-label">{startDate}</text><text x="758" y="47" textAnchor="end" className="degree29-scale-label">{endDate}</text><text x={labelX} y="151" textAnchor="middle" className="degree29-scale-current">{safeProgress.toFixed(1)}% · {currentDate}</text></svg>
}

export function DegreeMeasurementV29({ state, tab }: { state: AppState; tab: DegreeTab }): ReactElement {
  const elapsed = pickPinned(state.elapsed, state.settings.pinnedElapsedId)
  const remaining = pickPinned(state.remaining, state.settings.pinnedRemainingId)
  const stage = state.stages.find((item) => item.enabled)
  const display = elapsed ? getElapsedDisplay(getElapsedBreakdown(elapsed.startDate), state.settings.elapsedDisplayMode ?? 'days') : null
  const today = todayIso()
  const dates = remaining ? getRemainingDates(remaining.endDate, remaining.unit, today, remaining.weekdays) : []
  const progress = stage ? getStageProgress(stage.startDate, stage.endDate) : undefined
  const title = tab === 'elapsed' ? elapsed?.title ?? '还没有一段经年' : tab === 'remaining' ? remaining?.title ?? '还没有一段余下' : stage?.title ?? '还没有一段刻度'
  const dateText = tab === 'elapsed' ? (elapsed ? `${formatDate(elapsed.startDate, 'long')} 起 · 至今` : '等待一个明确的开始日期') : tab === 'remaining' ? (remaining ? `截止 ${formatDate(remaining.endDate, 'long')}` : '等待一个明确的截止日期') : (stage ? `${formatDate(stage.startDate, 'long')} — ${formatDate(stage.endDate, 'long')}` : '等待一段开始与结束日期')
  const value = tab === 'elapsed' ? (display ? formatDisplayNumber(display.value, state.settings.numberFormat ?? 'plain') : '—') : tab === 'remaining' ? (remaining ? formatDisplayNumber(dates.length, state.settings.numberFormat ?? 'plain') : '—') : stage && progress !== undefined ? progress.toFixed(1) : '—'
  const unit = tab === 'elapsed' ? display?.unit ?? '' : tab === 'remaining' ? remaining ? formatCounterUnit(remaining.unit) : '' : stage ? '%' : ''
  const intervalView = tab === 'stage' && stage && progress !== undefined
    ? <DegreeScaleV29 progress={progress} startDate={stage.startDate} endDate={stage.endDate} currentDate={today} />
    : <div className="degree29-scope" aria-label={tab === 'elapsed' ? '经年计算范围' : tab === 'remaining' ? '余下计数范围' : '尚无阶段范围'}>
      {tab === 'elapsed' && elapsed ? <><span>开始日期</span><strong>{formatDate(elapsed.startDate, 'long')}</strong><span>累计到今天</span><strong>{formatDate(today, 'long')}</strong></> : null}
      {tab === 'remaining' && remaining ? <><span>从今天起统计</span><strong>{formatDate(today, 'long')}</strong><span>截止日期</span><strong>{formatDate(remaining.endDate, 'long')}</strong></> : null}
      {tab === 'stage' && !stage ? <p>先建立一段有开始和结束日期的刻度。</p> : null}
      {tab === 'elapsed' && !elapsed ? <p>建立经年后，这里会显示开始日期和累计到今天的实际范围。</p> : null}
      {tab === 'remaining' && !remaining ? <p>建立余下后，这里会显示今天至截止日的统计范围。</p> : null}
    </div>
  return <section className="degree29-measurement" aria-label={`${title}的主测量图`}><div className="degree29-measurement-copy"><span>{tab === 'elapsed' ? 'PAST / 经年' : tab === 'remaining' ? 'FUTURE / 余下' : 'PASSAGE / 刻度'}</span><h2>{title}</h2><p>{dateText}</p><small>{tab === 'elapsed' ? '从开始日期起，累计实际经过的时间。' : tab === 'remaining' ? '截止日期以前还会遇见的具体日子。' : stage ? '百分比按照明确的开始和结束日期计算。' : '建立有明确起止日期的刻度后，显示真实区间比例。'}</small></div>{intervalView}<div className="degree29-reading"><strong>{value}</strong><span>{unit}</span><small>{tab === 'stage' && stage ? `${stage.startDate} 至 ${stage.endDate}` : '真实记录 · 实际数量'}</small></div></section>
}

export function DegreesWorldV29({ state, tab, onTabChange, onPinElapsed, onPinRemaining, onElapsedDisplayMode, onElapsedSort, onShareElapsed, onShareRemaining, onEditElapsed, onEditRemaining, onDeleteElapsed, onDeleteRemaining, onOpenStage, onRecord }: DegreesWorldProps): ReactElement {
  const tabRefs = useRef<Partial<Record<DegreeTab, HTMLButtonElement | null>>>({})
  const activeStage = state.stages.find((item) => item.enabled)
  const instrumentProgress = tab === 'stage' && activeStage ? getStageProgress(activeStage.startDate, activeStage.endDate) : undefined
  const tabs: Array<[DegreeTab, string]> = [['elapsed', '经年'], ['remaining', '余下'], ['stage', '刻度']]
  const selectTab = (next: DegreeTab) => {
    onTabChange(next)
    tabRefs.current[next]?.focus()
  }
  const moveTab = (current: DegreeTab, direction: -1 | 1) => {
    const index = tabs.findIndex(([id]) => id === current)
    selectTab(tabs[(index + direction + tabs.length) % tabs.length][0])
  }
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, id: DegreeTab) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') { event.preventDefault(); moveTab(id, 1) }
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') { event.preventDefault(); moveTab(id, -1) }
    else if (event.key === 'Home') { event.preventDefault(); selectTab('elapsed') }
    else if (event.key === 'End') { event.preventDefault(); selectTab('stage') }
  }

  return <CreativeWorld kind="instrument" progress={instrumentProgress}>
    <div className={'world-page world-degrees-v29 degree29-page--' + tab} data-layout="precision-instrument">
      <header className="degree29-topline"><span>几度 / TIME MEASUREMENT</span><time>{todayIso()}</time></header>
      <div className="degree29-shell">
        <aside className="degree29-index">
          <div className="degree29-index-title"><strong>几度</strong><span>MEASURE<br />WHAT PASSES</span></div>
          <nav role="tablist" aria-label="时间方向">
            {tabs.map(([id, label], index) => <button key={id} id={'degree29-tab-' + id} ref={(element) => { tabRefs.current[id] = element }} role="tab" aria-selected={tab === id} aria-controls={'degree29-panel-' + id} tabIndex={tab === id ? 0 : -1} className={tab === id ? 'is-selected' : ''} onClick={() => selectTab(id)} onKeyDown={(event) => handleTabKeyDown(event, id)}><span>0{index + 1}</span><strong>{label}</strong><small>{DEGREE_TAB_NOTES[id]}</small></button>)}
          </nav>
          <button className="degree29-new" onClick={() => onRecord(tab)}><Plus size={14} />新建</button>
        </aside>
        <section className="degree29-main" aria-label="几度内容">
          <div className="degree29-heading"><div><span>CALIBRATION / {tab === 'elapsed' ? 'PAST' : tab === 'remaining' ? 'NEXT' : 'PASSAGE'}</span><h1>时间测量台</h1></div><p>只显示真实记录，不制造额外的仪表数据。</p></div>
          <DegreeMeasurementV29 state={state} tab={tab} />
          <section id="degree29-panel-elapsed" role="tabpanel" aria-labelledby="degree29-tab-elapsed" tabIndex={0} hidden={tab !== 'elapsed'} className="degree29-list" aria-label="经年记录列表">
            <ModernElapsedList state={state} pinnedId={state.settings.pinnedElapsedId} displayMode={state.settings.elapsedDisplayMode ?? 'days'} sort={state.settings.elapsedSort ?? 'recent'} onPin={onPinElapsed} onShare={onShareElapsed} onEdit={onEditElapsed} onDelete={onDeleteElapsed} onDisplayModeChange={onElapsedDisplayMode} onSortChange={onElapsedSort} onRecord={() => onRecord('elapsed')} />
          </section>
          <section id="degree29-panel-remaining" role="tabpanel" aria-labelledby="degree29-tab-remaining" tabIndex={0} hidden={tab !== 'remaining'} className="degree29-list" aria-label="余下记录列表">
            <ModernRemainingList state={state} pinnedId={state.settings.pinnedRemainingId} onPin={onPinRemaining} onShare={onShareRemaining} onEdit={onEditRemaining} onDelete={onDeleteRemaining} onRecord={() => onRecord('remaining')} />
          </section>
          <section id="degree29-panel-stage" role="tabpanel" aria-labelledby="degree29-tab-stage" tabIndex={0} hidden={tab !== 'stage'} className="degree29-list" aria-label="阶段记录列表">
            <ModernStageList state={state} onOpenStage={onOpenStage} onRecord={() => onRecord('stage')} />
          </section>
        </section>
      </div>
    </div>
  </CreativeWorld>
}
