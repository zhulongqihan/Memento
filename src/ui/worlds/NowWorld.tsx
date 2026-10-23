import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { Bookmark, ChevronRight, ClipboardCopy, Plus, RefreshCw, Waves } from 'lucide-react'
import type { AppState, DailyEntry, LibraryCopy, Moment } from '../../domain/types'
import { formatCounterUnit, formatDate, formatDateWithWeekday, formatDisplayNumber, getDaysRemainingInYear, getElapsedBreakdown, getElapsedDisplay, getRemainingDates, getYearProgress, todayIso } from '../../domain/time'
import { pickPinned } from '../../domain/preferences'
import { CreativeWorld } from '../creative-worlds'
import { getMomentPhoto, SafeImage } from './media'

export function NowWorldV29({ state, onRecord, onOpenMoment, dailyEntry, narration, narrationSaved, dailyEditing, dailyDraft, onDailyDraftChange, onDailyEdit, onDailyCancel, onDailySave, onDailyDelete, onNarrationSave, onNarrationCopy, onNarrationConvert, onNarrationSource, onNarrationNext, onOpenRiver }: { state: AppState; onRecord: () => void; onOpenMoment: (moment: Moment) => void; dailyEntry?: DailyEntry; narration?: LibraryCopy; narrationSaved: boolean; dailyEditing: boolean; dailyDraft: string; onDailyDraftChange: (value: string) => void; onDailyEdit: () => void; onDailyCancel: () => void; onDailySave: (value: string) => void; onDailyDelete: () => void; onNarrationSave: () => void; onNarrationCopy: () => void; onNarrationConvert: () => void; onNarrationSource: () => void; onNarrationNext: () => void; onOpenRiver: () => void }): ReactElement {
  const today = todayIso()
  const [currentTime, setCurrentTime] = useState(() => new Date())
  useEffect(() => {
    let timer: number | undefined
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer)
      timer = undefined
    }
    const syncVisibility = () => {
      if (document.visibilityState === 'visible') {
        setCurrentTime(new Date())
        if (timer === undefined) timer = window.setInterval(() => setCurrentTime(new Date()), 1_000)
      } else stop()
    }
    syncVisibility()
    document.addEventListener('visibilitychange', syncVisibility)
    return () => {
      document.removeEventListener('visibilitychange', syncVisibility)
      stop()
    }
  }, [])
  const year = today.slice(0, 4)
  const timeLabel = currentTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  const secondsLabel = String(currentTime.getSeconds()).padStart(2, '0')
  const dayProgress = ((currentTime.getHours() * 60 + currentTime.getMinutes()) / 1440) * 100
  const yearProgress = getYearProgress(today)
  const elapsed = pickPinned(state.elapsed, state.settings.pinnedElapsedId)
  const remaining = pickPinned(state.remaining, state.settings.pinnedRemainingId)
  const memory = pickPinned(state.moments, state.settings.pinnedMomentId) ?? state.moments.find((moment) => moment.date < today)
  const photo = memory ? getMomentPhoto(state, memory) : undefined
  const elapsedDisplay = getElapsedDisplay(elapsed ? getElapsedBreakdown(elapsed.startDate) : { days: 0, weeks: 0, months: 0, years: 0 }, state.settings.elapsedDisplayMode ?? 'days')
  const remainingDates = remaining ? getRemainingDates(remaining.endDate, remaining.unit, today, remaining.weekdays) : []

  return <CreativeWorld kind="present"><div className="world-page world-now-v29" data-layout="darkroom-live-time">
    <header className="now29-header"><div className="now29-breadcrumb"><span>MEMENTO / LIVE TIME</span><time dateTime={today}>{formatDateWithWeekday(today)}</time></div><div className="now29-actions"><span className="now29-live"><i aria-hidden="true" />正在发生</span><button onClick={onOpenRiver}><Waves size={15} />漂流一会儿</button><button onClick={onRecord}><Plus size={15} />记一笔</button></div></header>
    <div className="now29-layout">
      <section className="now29-time-column" aria-label={`当前时间 ${timeLabel}`}><div className="now29-kicker">LOCAL TIME <span>{year} / {today.slice(5)}</span></div><h1>此刻<sup>NOW</sup></h1><div className="now29-time-readout"><strong>{timeLabel}</strong><span>:{secondsLabel}</span><small>北京时间 · 正在发生</small></div><p className="now29-thought">今天先被看见，才会成为记忆。</p><div className="now29-rule-metric"><div><span>今日位置</span><strong>{dayProgress.toFixed(1)}%</strong></div><div className="now29-meter"><i style={{ transform: `scaleX(${dayProgress / 100})` }} /></div><div className="now29-metric-foot"><span>00:00</span><span>24:00</span></div></div><div className="now29-rule-metric"><div><span>年度位置</span><strong>{yearProgress.toFixed(1)}%</strong></div><div className="now29-meter now29-meter-year"><i style={{ transform: `scaleX(${yearProgress / 100})` }} /></div><div className="now29-metric-foot"><span>01 / 01</span><span>还剩 {getDaysRemainingInYear(today)} 天</span><span>12 / 31</span></div></div><button className="now29-record-link" onClick={onRecord}><Plus size={15} />记录正在发生的事</button></section>
      <figure className="now29-aperture"><div className="now29-aperture-head"><span>OBSERVATION / {today.slice(5).replace('-', '·')}</span><span>{memory ? 'USER EVIDENCE' : 'EMPTY OBSERVATION'}</span></div>{photo ? <SafeImage className="now29-aperture-image" src={photo.src} alt={memory?.title ?? photo.name} fileLabel={photo.name} loading="eager" /> : <div className="now29-empty-observation"><span>今天还没有照片</span><strong>{formatDate(today, 'long')}</strong><p>文字、日期和一件小事，也可以成为完整的观察。</p><button onClick={onRecord}>打开记录入口 <ChevronRight size={14} /></button></div>}{memory && <figcaption><strong>{memory.title}</strong><span>{formatDate(memory.date, 'long')}{memory.location ? ` · ${memory.location}` : ''}</span></figcaption>}</figure>
      <aside className="now29-note-rail"><span className="now29-note-label">A SMALL RECORD</span><p>{memory?.note ?? '从一件正在发生的小事开始，让今天拥有一个可以回来的位置。'}</p><button className="now29-note-link" onClick={() => memory ? onOpenMoment(memory) : onRecord()}>{memory ? '打开这段时光' : '记下第一件事'} <ChevronRight size={14} /></button><div className="now29-note-meta"><span>经年</span><strong>{elapsed ? `${formatDisplayNumber(elapsedDisplay.value, state.settings.numberFormat ?? 'plain')}${elapsedDisplay.unit}` : '—'}</strong><small>{elapsed?.title ?? '还没有一段经年'}</small></div><div className="now29-note-meta"><span>余下</span><strong>{remaining ? `${formatDisplayNumber(remainingDates.length, state.settings.numberFormat ?? 'plain')}${formatCounterUnit(remaining.unit)}` : '—'}</strong><small>{remaining?.title ?? '还没有一段余下'}</small></div></aside>
    </div>
    <section className="now29-daily-dock" aria-label="今日一行"><div className="now29-daily-label"><span>DAILY LINE / LOCAL</span><strong>今天的一行</strong></div>{dailyEditing ? <div className="now29-daily-editor"><textarea aria-label="今日一行内容" value={dailyDraft} onChange={(event) => onDailyDraftChange(event.target.value)} placeholder="留下一句今天想保存的话" autoFocus /><div className="now29-daily-actions"><button onClick={() => onDailySave(dailyDraft)}>保存</button><button onClick={onDailyCancel}>取消</button>{dailyEntry && <button onClick={onDailyDelete}>删除</button>}</div></div> : <><div className="now29-daily-copy">{dailyEntry ? <>{dailyEntry.text}{dailyEntry.sourceNarrationId && <em> · 来自旁白</em>}</> : <span>今天还没有留下文字，时间也允许你安静经过。</span>}</div><div className="now29-daily-actions"><button onClick={onDailyEdit}>{dailyEntry ? '编辑' : '写下一行'}</button>{dailyEntry && <button onClick={onDailyDelete}>删除</button>}</div></>}</section>
    <section className="now29-narration" aria-label="今日旁白"><div className="now29-daily-label"><span>NARRATION / 03.1</span><strong>今日旁白</strong></div>{narration ? <><div><p className="now29-narration-quote">{narration.translationZh ?? narration.original}</p><p className="now29-narration-original">{narration.translationZh ? narration.original : `${narration.author ?? '佚名'} · ${narration.work ?? narration.sourceName}`}</p><button className="now29-narration-source" onClick={onNarrationSource}>查看原文与出处</button></div><div className="now29-narration-actions"><button onClick={onNarrationSave}><Bookmark size={13} />{narrationSaved ? '取消收藏' : '收藏'}</button><button onClick={onNarrationConvert}>转为一行</button><button onClick={onNarrationCopy}><ClipboardCopy size={13} />复制</button><button onClick={onNarrationNext}><RefreshCw size={13} />换一条</button></div></> : <div className="now29-narration-empty">文案库已经走完，今天可以留下自己的话。</div>}</section>
    <footer className="now29-footer"><span>LOCAL ARCHIVE / 01</span><div className="now29-footer-line"><i style={{ transform: `scaleX(${dayProgress / 100})` }} /><b style={{ left: `${dayProgress}%` }} /></div><span>{today} · {timeLabel}</span></footer>
  </div></CreativeWorld>
}
