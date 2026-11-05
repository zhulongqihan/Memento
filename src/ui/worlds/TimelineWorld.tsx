import { useEffect, useMemo, useRef } from 'react'
import type { KeyboardEvent, ReactElement } from 'react'
import { ChevronRight, Plus, Search, Waves } from 'lucide-react'
import type { AppState, DailyEntry, LibraryCopy, Moment, TimelineFilter } from '../../domain/types'
import { KIND_LABELS } from '../../domain/labels'
import { formatDate, getMonthLabel, todayIso } from '../../domain/time'
import { getTimelineKeyboardTarget, selectTimelineMoments } from '../../domain/timeline'
import { CreativeWorld } from '../creative-worlds'
import { DailyHistory } from './DailyHistory'
import { TimelineStoryFilters } from './shared'
import { getMomentPhoto, SafeImage } from './media'
import './timeline-search.css'

export type TimelineView = 'index' | 'film' | 'daily'

export function getTimelineMonthDistance(laterDate: string, earlierDate: string): number {
  const laterYear = Number(laterDate.slice(0, 4))
  const laterMonth = Number(laterDate.slice(5, 7))
  const earlierYear = Number(earlierDate.slice(0, 4))
  const earlierMonth = Number(earlierDate.slice(5, 7))
  return Math.max(0, (laterYear - earlierYear) * 12 + laterMonth - earlierMonth)
}

export function formatTimelineGap(months: number): string {
  if (months >= 12) {
    const years = Math.floor(months / 12)
    const remainingMonths = months % 12
    return remainingMonths ? `相隔 ${years} 年 ${remainingMonths} 个月` : `相隔 ${years} 年`
  }
  return `相隔 ${months} 个月`
}

function focusTimelineRecord(record: HTMLButtonElement | undefined | null, block: ScrollLogicalPosition = 'nearest'): void {
  if (!record) return
  record.focus({ preventScroll: true })
  record.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block, inline: 'nearest' })
}

function moveTimelineFocus(event: KeyboardEvent<HTMLDivElement>, records: Array<HTMLButtonElement | null>): void {
  if (event.altKey || event.ctrlKey || event.metaKey) return
  const activeIndex = records.findIndex((record) => record === document.activeElement)
  const target = getTimelineKeyboardTarget(records.length, activeIndex, event.key)
  if (target === undefined) return
  event.preventDefault()
  focusTimelineRecord(records[target])
}

export function TimelineIndexView({ state, moments, currentYear, onOpenMoment }: { state: AppState; moments: Moment[]; currentYear: string; onOpenMoment: (moment: Moment) => void }): ReactElement {
  const recordRefs = useRef<Array<HTMLButtonElement | null>>([])
  return <section className="film29-index-panel" aria-label="紧凑时间索引">
    <div className="film29-index-list" role="list" tabIndex={0} onKeyDown={(event) => moveTimelineFocus(event, recordRefs.current.slice(0, moments.length))} aria-label="紧凑记录列表">
      {moments.map((moment, index) => {
        const previous = moments[index - 1]
        const gap = previous ? getTimelineMonthDistance(previous.date, moment.date) : 0
        const year = moment.date.slice(0, 4)
        const month = moment.date.slice(0, 7)
        const isNewYear = index === 0 || previous.date.slice(0, 4) !== year
        const isNewMonth = index === 0 || previous.date.slice(0, 7) !== month
        const photo = getMomentPhoto(state, moment)
        return <div className="film29-index-item" key={moment.id} role="listitem">
          {isNewYear && <div className="film29-index-year"><strong>{year}</strong><span>{year === currentYear ? '今年' : '曾经发生'}</span></div>}
          {gap >= 2 && <div className="film29-index-gap" aria-label={formatTimelineGap(gap)}><span aria-hidden="true" />{formatTimelineGap(gap)}</div>}
          {isNewMonth && <h2 className="film41-index-month">{getMonthLabel(moment.date)}</h2>}
          <button className="film29-index-record" ref={(element) => { recordRefs.current[index] = element }} data-index={index} data-year={year} data-month={month} onClick={() => onOpenMoment(moment)}>
            <span className="film29-index-step">{String(index + 1).padStart(2, '0')}</span>
            <time dateTime={moment.date}>{formatDate(moment.date, 'short')}</time>
            <span className={`film29-index-evidence ${photo ? '' : 'film29-index-evidence--text'}`}>{photo ? <SafeImage src={photo.src} alt={moment.title} fileLabel={photo.name} loading="lazy" /> : <span aria-label="文字记录" />}</span>
            <span className="film29-index-copy"><strong>{moment.title}</strong><small>{KIND_LABELS[moment.kind]}{moment.location ? ` · ${moment.location}` : ''}</small>{moment.note && <p>{moment.note}</p>}</span>
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
      })}
    </div>
  </section>
}

export function TimelineWorldV29({ state, filter, timelineView, onViewChange, query, onQueryChange, scrollTop, onFilterChange, onScrollPositionChange, onOpenMoment, onRecord, onOpenRiver, narration, onNarrationSource, onSaveDaily, onDeleteDaily }: { state: AppState; filter: TimelineFilter; timelineView: TimelineView; onViewChange: (view: TimelineView) => void; query: string; onQueryChange: (query: string) => void; scrollTop: number; onFilterChange: (filter: TimelineFilter) => void; onScrollPositionChange: (value: number) => void; onOpenMoment: (moment: Moment) => void; onRecord: () => void; onOpenRiver: () => void; narration?: LibraryCopy; onNarrationSource: () => void; onSaveDaily: (entry: DailyEntry, text: string) => void; onDeleteDaily: (entry: DailyEntry) => void }): ReactElement {
  const searchRef = useRef<HTMLInputElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const currentYear = todayIso().slice(0, 4)
  const moments = useMemo(() => selectTimelineMoments(state.moments, { filter, currentYear, query }), [currentYear, filter, query, state.moments])
  const groups = useMemo(() => {
    const result: Record<string, Moment[]> = {}
    for (const moment of moments) (result[moment.date.slice(0, 7)] ??= []).push(moment)
    return result
  }, [moments])
  const months = Object.keys(groups)
  const years = [...new Set(moments.map((moment) => moment.date.slice(0, 4)))]
  const filters: Array<[TimelineFilter, string]> = [['all', '全部'], ['first', '初见'], ['yearly_first', '今年第一次'], ['milestone', '人生节点'], ['this_year', '今年']]
  const hasConditions = Boolean(query.trim()) || filter !== 'all'

  useEffect(() => { window.scrollTo({ top: scrollTop, behavior: 'auto' }); return () => onScrollPositionChange(window.scrollY) }, [onScrollPositionChange, scrollTop])

  const jumpToPeriod = (period: string, type: 'year' | 'month') => {
    const recordClass = timelineView === 'film' ? 'film29-record' : 'film29-index-record'
    focusTimelineRecord(boardRef.current?.querySelector<HTMLButtonElement>(`.${recordClass}[data-${type}="${period}"]`), 'center')
  }
  const clearSearch = () => {
    onQueryChange('')
    searchRef.current?.focus()
  }
  const clearConditions = () => {
    onQueryChange('')
    onFilterChange('all')
    searchRef.current?.focus()
  }

  return <CreativeWorld kind="film"><div className="world-page world-timeline-v29" data-layout="film-index" data-timeline-view={timelineView}>
    <header className="film29-header">
      <div><span className="film29-kicker">MEMORY ATLAS / TIME INDEX</span><div className="film29-title-line"><h1>时光</h1><p>沿着年月回到发生过的地方。</p></div></div>
      <div className="film29-header-side">
        <span><strong>{String(timelineView === 'daily' ? state.dailyEntries.length : state.moments.length).padStart(2, '0')}</strong>{timelineView === 'daily' ? ' 天记录' : ' 条记录'}</span>
        <div className="film29-view-switch" role="group" aria-label="时间轴视图">
          {([['index', '索引'], ['film', '胶片'], ['daily', '每日一行']] as const).map(([view, label]) => <button key={view} type="button" aria-pressed={timelineView === view} className={timelineView === view ? 'is-selected' : ''} onClick={() => onViewChange(view)}>{label}</button>)}
        </div>
        <button onClick={onOpenRiver}><Waves size={15} />漂流一会儿</button><button onClick={onRecord}><Plus size={15} />记一笔</button>
      </div>
    </header>

    <section hidden={timelineView === 'daily'} className="film29-ruler film41-ruler" aria-label="年份定位与筛选">
      <nav className="film29-years film41-year-nav" aria-label="年份定位"><span>年份</span>{years.length ? years.map((year) => <button key={year} onClick={() => jumpToPeriod(year, 'year')}>{year}</button>) : <span>—</span>}</nav>
      <TimelineStoryFilters filters={filters} filter={filter} onFilterChange={onFilterChange} />
    </section>
    <section hidden={timelineView === 'daily'} className="film41-tools" aria-label="查找时光记录">
      <div className="film41-search" role="search">
        <label htmlFor="timeline-search"><Search size={15} aria-hidden="true" />查找</label>
        <input id="timeline-search" ref={searchRef} type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="标题、笔记或地点" aria-label="搜索时光记录" />
        {query && <button type="button" onClick={clearSearch} aria-label="清除搜索">清除</button>}
      </div>
      <p className="film41-search-status" role="status" aria-live="polite" aria-atomic="true">{hasConditions ? `${moments.length} 条结果 · 全部 ${state.moments.length} 条记录` : '按日期从近到远'}</p>
    </section>

    {timelineView === 'daily' && <DailyHistory entries={state.dailyEntries} onSave={onSaveDaily} onDelete={onDeleteDaily} />}
    <div ref={boardRef} hidden={timelineView === 'daily'} className={`film29-board film41-board film29-board--${timelineView}`}>
      <nav className="film29-month-rail film41-month-rail" aria-label="月份定位">
        <span>月份</span>
        {months.length ? months.map((month) => <button key={month} type="button" onClick={() => jumpToPeriod(month, 'month')} aria-label={`跳到 ${month.slice(0, 4)} 年 ${Number(month.slice(5))} 月`}><strong>{Number(month.slice(5))} 月</strong><small>{month.slice(0, 4)}</small></button>) : <span className="film29-empty-mark">—</span>}
      </nav>

      {timelineView === 'index' && moments.length > 0 && <TimelineIndexView state={state} moments={moments} currentYear={currentYear} onOpenMoment={onOpenMoment} />}
      {timelineView === 'film' && moments.length > 0 && <div className="film29-track" tabIndex={0} onKeyDown={(event) => moveTimelineFocus(event, Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('.film29-record')))} aria-label="纵向浏览时光记录">
        {months.map((month) => <section className="timeline29-month" id={`timeline29-month-${month}`} data-year={month.slice(0, 4)} key={month}>
          <header><span>{month.slice(0, 4)}</span><h2>{getMonthLabel(`${month}-01`)}</h2><small>{groups[month].length} 条记录</small></header>
          <div className="film29-record-list">{groups[month].map((moment, index) => {
            const photo = getMomentPhoto(state, moment)
            return <button className={`film29-record${photo ? '' : ' film41-record--text'}`} key={moment.id} data-year={moment.date.slice(0, 4)} data-month={month} onClick={() => onOpenMoment(moment)}>
              <span className="film29-record-index">{String(index + 1).padStart(2, '0')}</span><time dateTime={moment.date}>{formatDate(moment.date, 'short')}</time>
              {photo ? <span className="film29-evidence"><SafeImage src={photo.src} alt={moment.title} fileLabel={photo.name} /></span> : <span className="film41-text-mark" aria-label="文字记录">文字</span>}
              <span className="film29-record-copy"><strong>{moment.title}</strong><small>{KIND_LABELS[moment.kind]}{moment.location ? ` · ${moment.location}` : ''}</small>{moment.note && <p>{moment.note}</p>}</span><ChevronRight size={15} aria-hidden="true" />
            </button>
          })}</div>
        </section>)}
      </div>}

      {timelineView !== 'daily' && moments.length === 0 && <div className="film41-empty">
        <h2>{state.moments.length ? query.trim() ? '没有找到匹配的记录。' : '这个分类下还没有记录。' : '第一条记录，会成为时间轴的起点。'}</h2>
        <p>{state.moments.length ? '可以换一个关键词，或清除查找条件，回看全部记录。' : '从一件最近发生的小事开始，留下日期和一句话。'}</p>
        <button className="film29-start" onClick={state.moments.length ? clearConditions : onRecord}>{state.moments.length ? '清除查找条件' : '记下第一条记录'}<ChevronRight size={14} aria-hidden="true" /></button>
      </div>}
    </div>
    <div hidden={timelineView === 'daily'} className="film29-key-help"><span>↑ ↓</span> {timelineView === 'index' ? '浏览记录' : '纵向浏览胶片'} <span>HOME / END</span> 定位记录</div>
    <section hidden={timelineView === 'daily'} className="film29-narration" aria-label="今日旁白"><span>今日旁白</span><p>{narration ? narration.translationZh ?? narration.original : '今天也可以留下自己的话。'}</p><div><button onClick={onNarrationSource} disabled={!narration}>原文与出处</button><button onClick={onOpenRiver}><Waves size={14} />漂流一会儿</button></div></section>
  </div></CreativeWorld>
}
