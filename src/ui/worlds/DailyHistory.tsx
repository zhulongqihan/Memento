import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import type { DailyEntry } from '../../domain/types'
import { formatDateWithWeekday } from '../../domain/time'

export function DailyHistory({ entries, onSave, onDelete }: {
  entries: DailyEntry[]
  onSave: (entry: DailyEntry, text: string) => void
  onDelete: (entry: DailyEntry) => void
}): ReactElement {
  const [month, setMonth] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const sectionRef = useRef<HTMLElement>(null)
  const editButtons = useRef(new Map<string, HTMLButtonElement>())
  const restoreFocusId = useRef<string | null>(null)
  useEffect(() => {
    if (editingId === null && restoreFocusId.current) {
      editButtons.current.get(restoreFocusId.current)?.focus()
      restoreFocusId.current = null
    }
  }, [editingId])
  const visibleEntries = useMemo(() => [...entries]
    .filter((entry) => !month || entry.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date)), [entries, month])

  return <section ref={sectionRef} tabIndex={-1} className="daily-history" aria-label="每日一行历史">
    <header className="daily-history-heading">
      <div><h2>那些天，留下的一行</h2><p>共 {entries.length} 天。日期留在原处，文字可以慢慢补全。</p></div>
      <div className="daily-history-filter"><label>按月份查找<input type="month" aria-label="按月份查找每日一行" value={month} onChange={(event) => { setMonth(event.target.value); setEditingId(null) }} /></label>{month && <button className="outline-action" onClick={() => setMonth('')}>查看全部日期</button>}</div>
    </header>
    {visibleEntries.length === 0 && <p className="daily-history-empty">{month ? '这个月还没有留下的一行。可以查看其他月份。' : '还没有每日一行。可以从「此刻」记下今天。'}</p>}
    <ol className="daily-history-list">
      {visibleEntries.map((entry) => <li key={entry.id}>
        <time dateTime={entry.date}>{formatDateWithWeekday(entry.date)}</time>
        {editingId === entry.id ? <form onSubmit={(event) => {
          event.preventDefault()
          if (!draft.trim()) { setError('请写下一行文字，或取消后选择删除。'); return }
          onSave(entry, draft.trim())
          restoreFocusId.current = entry.id
          setEditingId(null)
        }}>
          <label>修改 {entry.date} 的一行<textarea autoFocus aria-describedby={error ? `daily-error-${entry.id}` : undefined} value={draft} onChange={(event) => { setDraft(event.target.value); setError('') }} rows={3} /></label>
          {error && <p id={`daily-error-${entry.id}`} role="alert" className="form-error">{error}</p>}
          <div className="daily-history-actions"><button type="submit" className="dark-action">保存这一行</button><button type="button" className="outline-action" onClick={() => { restoreFocusId.current = entry.id; setEditingId(null) }}>取消修改</button></div>
        </form> : <><p className="daily-history-text">{entry.text}</p><div className="daily-history-actions"><button ref={(element) => { if (element) editButtons.current.set(entry.id, element); else editButtons.current.delete(entry.id) }} className="outline-action" aria-label={`编辑 ${entry.date} 的一行`} onClick={() => { setEditingId(entry.id); setDraft(entry.text); setError('') }}>编辑</button><button className="outline-action danger-action" aria-label={`删除 ${entry.date} 的一行`} onClick={() => { onDelete(entry); sectionRef.current?.focus() }}>删除</button></div></>}
      </li>)}
    </ol>
  </section>
}
