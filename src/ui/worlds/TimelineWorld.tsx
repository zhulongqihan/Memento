import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { ChevronRight, Plus, Waves } from 'lucide-react'
import type { AppState, DailyEntry, LibraryCopy, Moment, TimelineFilter } from '../../domain/types'
import { KIND_LABELS } from '../../domain/labels'
import { formatDate, getMonthLabel, todayIso } from '../../domain/time'
import { CreativeWorld } from '../creative-worlds'
import { DailyHistory } from './DailyHistory'
import { TimelineStoryFilters } from './shared'
import { getMomentPhoto, SafeImage } from './media'
import summerSample from '../../../docs/design/assets/seasonal-samples/summer-courtyard-table.png'

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

export function TimelineIndexView({ state, moments, currentYear, onOpenMoment }: { state: AppState; moments: Moment[]; currentYear: string; onOpenMoment: (moment: Moment) => void }): ReactElement {
  const recordRefs = useRef<Array<HTMLButtonElement | null>>([])
  const focusRecord = (index: number) => recordRefs.current[index]?.focus()
  const moveRecord = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const activeIndex = recordRefs.current.findIndex((element) => element === document.activeElement)
    const currentIndex = activeIndex >= 0 ? activeIndex : 0
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault()
      focusRecord(Math.min(moments.length - 1, currentIndex + 1))
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault()
      focusRecord(Math.max(0, currentIndex - 1))
    }
    if (event.key === 'Home') {
      event.preventDefault()
      focusRecord(0)
    }
    if (event.key === 'End') {
      event.preventDefault()
      focusRecord(moments.length - 1)
    }
  }

  return <section className="film29-index-panel" aria-label="紧凑时间索引">
    <header className="film29-index-heading"><div><span>QUICK INDEX / CONTENT LED</span><h2>记录随内容生长</h2></div><p>时间的远近用日期说明，不再用空白要求你拖动。</p></header>
    <div className="film29-index-list" role="list" tabIndex={0} onKeyDown={moveRecord} aria-label="紧凑记录列表">
      {moments.map((moment, index) => {
        const previous = moments[index - 1]
        const gap = previous ? getTimelineMonthDistance(previous.date, moment.date) : 0
        const year = moment.date.slice(0, 4)
        const isNewYear = index === 0 || moments[index - 1].date.slice(0, 4) !== year
        const photo = getMomentPhoto(state, moment)
        return <div className="film29-index-item" key={moment.id} role="listitem">
          {isNewYear && <div className="film29-index-year"><strong>{year}</strong><span>{year === currentYear ? '今年' : '曾经发生'}</span></div>}
          {gap >= 2 && <div className="film29-index-gap" aria-label={formatTimelineGap(gap)}><span aria-hidden="true" />{formatTimelineGap(gap)}</div>}
          <button className="film29-index-record" ref={(element) => { recordRefs.current[index] = element }} data-index={index} data-year={year} onClick={() => onOpenMoment(moment)}>
            <span className="film29-index-step">{String(index + 1).padStart(2, '0')}</span>
            <time dateTime={moment.date}>{formatDate(moment.date, 'short')}</time>
            <span className={`film29-index-evidence ${photo ? '' : 'film29-index-evidence--text'}`}>{photo ? <SafeImage src={photo.src} alt={moment.title} fileLabel={photo.name} loading="lazy" /> : <span aria-label="没有照片的文字记录" />}</span>
            <span className="film29-index-copy"><strong>{moment.title}</strong><small>{KIND_LABELS[moment.kind]}{moment.location ? ` · ${moment.location}` : ''}</small>{moment.note && <p>{moment.note}</p>}</span>
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
      })}
    </div>
  </section>
}

export function TimelineWorldV29({ state, filter, scrollTop, onFilterChange, onScrollPositionChange, onOpenMoment, onRecord, onOpenRiver, narration, onNarrationSource, onSaveDaily, onDeleteDaily }: { state: AppState; filter: TimelineFilter; scrollTop: number; onFilterChange: (filter: TimelineFilter) => void; onScrollPositionChange: (value: number) => void; onOpenMoment: (moment: Moment) => void; onRecord: () => void; onOpenRiver: () => void; narration?: LibraryCopy; onNarrationSource: () => void; onSaveDaily: (entry: DailyEntry, text: string) => void; onDeleteDaily: (entry: DailyEntry) => void }): ReactElement {
  const [timelineView, setTimelineView] = useState<TimelineView>('index')
  const currentYear = todayIso().slice(0, 4)
  const moments = useMemo(() => [...state.moments].filter((moment) => filter === 'all' || (filter === 'this_year' ? moment.date.startsWith(currentYear) : moment.kind === filter)).sort((a, b) => b.date.localeCompare(a.date)), [currentYear, filter, state.moments])
  const groups = useMemo(() => moments.reduce<Record<string, Moment[]>>((result, moment) => { const key = moment.date.slice(0, 7); result[key] = [...(result[key] ?? []), moment]; return result }, {}), [moments])
  const months = Object.keys(groups)
  const years = [...new Set(moments.map((moment) => moment.date.slice(0, 4)))]
  const filters: Array<[TimelineFilter, string]> = [['all', '全部'], ['first', '初见'], ['yearly_first', '今年第一次'], ['milestone', '人生节点'], ['this_year', '今年']]
  useEffect(() => { window.scrollTo({ top: scrollTop, behavior: 'auto' }); return () => onScrollPositionChange(window.scrollY) }, [onScrollPositionChange, scrollTop])
  const jumpTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  const jumpToYear = (year: string) => {
    const selector = timelineView === 'film' ? `.timeline29-month[data-year="${year}"]` : `.film29-index-record[data-year="${year}"]`
    document.querySelector<HTMLElement>(selector)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  }
  const moveTrack = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const records = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('.film29-record'))
    if (!records.length) return
    const activeIndex = records.indexOf(document.activeElement as HTMLButtonElement)
    const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight'
    const backward = event.key === 'ArrowUp' || event.key === 'ArrowLeft'
    if (event.key === 'Home') { event.preventDefault(); records[0].focus(); records[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); return }
    if (event.key === 'End') { event.preventDefault(); records[records.length - 1].focus(); records[records.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' }); return }
    if (!forward && !backward) return
    event.preventDefault()
    const currentIndex = activeIndex >= 0 ? activeIndex : (forward ? -1 : records.length)
    const nextIndex = Math.max(0, Math.min(records.length - 1, currentIndex + (forward ? 1 : -1)))
    records[nextIndex].focus()
    records[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
  return <CreativeWorld kind="film"><div className="world-page world-timeline-v29" data-layout="film-index" data-timeline-view={timelineView}>
    <header className="film29-header"><div><span className="film29-kicker">MEMORY ATLAS / TIME INDEX</span><div className="film29-title-line"><h1>时光</h1><p>沿着年月回到发生过的地方。</p></div></div><div className="film29-header-side"><span><strong>{String(timelineView === 'daily' ? state.dailyEntries.length : moments.length).padStart(2, '0')}</strong> 条证据</span><div className="film29-view-switch" role="group" aria-label="时间轴视图"><button type="button" aria-pressed={timelineView === 'index'} className={timelineView === 'index' ? 'is-selected' : ''} onClick={() => setTimelineView('index')}>索引</button><button type="button" aria-pressed={timelineView === 'film'} className={timelineView === 'film' ? 'is-selected' : ''} onClick={() => setTimelineView('film')}>胶片</button><button type="button" aria-pressed={timelineView === 'daily'} className={timelineView === 'daily' ? 'is-selected' : ''} onClick={() => setTimelineView('daily')}>每日一行</button></div><button onClick={onOpenRiver}><Waves size={15} />漂流一会儿</button><button onClick={onRecord}><Plus size={15} />记一笔</button></div></header>
    <section hidden={timelineView === 'daily'} className="film29-ruler" aria-label="年份定位与筛选"><div className="film29-ruler-title"><span>YEAR INDEX</span><strong>{years.length ? `${years[years.length - 1]} — ${years[0]}` : '还没有年份'}</strong></div><div className="film29-years">{years.length ? years.map((year) => <button key={year} onClick={() => jumpToYear(year)}>{year}</button>) : <span>—</span>}</div><TimelineStoryFilters filters={filters} filter={filter} onFilterChange={onFilterChange} /></section>
    <section hidden={timelineView === 'daily'} className="film29-narration" aria-label="今日旁白"><span>NARRATION / TODAY</span><p>{narration ? narration.translationZh ?? narration.original : '没有旁白时，时间轴只保留真实记录。'}</p><div><button onClick={onNarrationSource} disabled={!narration}>原文与出处</button><button onClick={onOpenRiver}><Waves size={14} />漂流一会儿</button></div></section>
     {timelineView === 'daily' && <DailyHistory entries={state.dailyEntries} onSave={onSaveDaily} onDelete={onDeleteDaily} />}
     <div hidden={timelineView === 'daily'} className={`film29-board film29-board--${timelineView}`}>{timelineView === 'index' && moments.length > 0 && <TimelineIndexView state={state} moments={moments} currentYear={currentYear} onOpenMoment={onOpenMoment} />}{timelineView === 'film' && <><aside className="film29-month-rail" aria-label="月份定位"><span>MONTHS</span>{months.length ? months.map((month) => <button key={month} onClick={() => jumpTo(`timeline29-month-${month}`)}><strong>{month.slice(5)}</strong><small>{getMonthLabel(`${month}-01`)}</small></button>) : <span className="film29-empty-mark">—</span>}</aside><div className="film29-track" tabIndex={0} onKeyDown={moveTrack} aria-label="纵向浏览时光记录">{months.length ? months.map((month) => <section className="timeline29-month" id={`timeline29-month-${month}`} data-year={month.slice(0, 4)} key={month}><header><span>{month.slice(0, 4)}</span><h2>{getMonthLabel(`${month}-01`)}</h2><small>{groups[month].length} 条记录</small></header><div className="film29-record-list">{groups[month].map((moment, index) => { const photo = getMomentPhoto(state, moment); return <button className="film29-record" key={moment.id} onClick={() => onOpenMoment(moment)}><span className="film29-record-index">{String(index + 1).padStart(2, '0')}</span><time>{formatDate(moment.date, 'short')}</time><span className="film29-evidence">{photo ? <SafeImage src={photo.src} alt={moment.title} fileLabel={photo.name} /> : <span><small>TEXT EVIDENCE</small><strong>{moment.title}</strong></span>}</span><span className="film29-record-copy"><strong>{moment.title}</strong><small>{KIND_LABELS[moment.kind]}{moment.location ? ` · ${moment.location}` : ''}</small><p>{moment.note ?? '这一天被时间保存下来。'}</p></span><ChevronRight size={15} /></button> })}</div></section>) : <div className="film29-first-frame"><div><span>FIRST FRAME</span><h2>{state.moments.length ? '这个筛选下还没有记录。' : '第一条记录，会成为时间轴的起点。'}</h2><p>{state.moments.length ? '可以切换「全部」，或记下一件新的事情。' : '从一件最近发生的小事开始，让档案出现第一行字。'}</p><button className="film29-start" onClick={onRecord}>从这里开始 <ChevronRight size={14} /></button></div><div className="film29-first-evidence"><SafeImage src={summerSample} alt="" fileLabel="时间轴辅助样片" loading="eager" /><span>辅助证据 · 不代表用户记录</span></div></div>}</div></>}{timelineView === 'index' && moments.length === 0 && <div className="film29-index-empty"><div><span>FIRST FRAME</span><h2>{state.moments.length ? '这个筛选下还没有记录。' : '第一条记录，会成为时间轴的起点。'}</h2><p>{state.moments.length ? '可以切换「全部」，或记下一件新的事情。' : '从一件最近发生的小事开始，让档案出现第一行字。'}</p><button className="film29-start" onClick={onRecord}>从这里开始 <ChevronRight size={14} /></button></div><div className="film29-first-evidence"><SafeImage src={summerSample} alt="" fileLabel="时间轴辅助样片" loading="eager" /><span>辅助证据 · 不代表用户记录</span></div></div>}</div>
     <div hidden={timelineView === 'daily'} className="film29-key-help"><span>↑ ↓</span> {timelineView === 'index' ? '浏览记录' : '纵向浏览胶片'} <span>HOME / END</span> 定位记录</div>
  </div></CreativeWorld>
}
