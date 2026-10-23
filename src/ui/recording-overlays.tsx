import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactElement } from 'react'
import { Archive, CircleHelp, ImagePlus, Pencil, Pin, Share2, Trash2, X } from 'lucide-react'
import type { BackupSummary, ElapsedCounter, Moment, MomentKind, PhotoAsset, RemainingCounter, RemainingUnit, Stage } from '../domain/types'
import { KIND_LABELS } from '../domain/labels'
import { formatDate, formatDateWithWeekday, getStageProgress, isValidIsoDate, shiftIsoDate, todayIso } from '../domain/time'
import { useFocusTrap } from './focus-trap'
import { SafeImage } from './worlds/media'
import type { DraftPhoto, EditableRecord, RecordDraft, RecorderType } from '../features/records/types'
import { resolveMomentPhotoIds } from '../features/records/photo-selection'

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

const REMAINING_UNIT_HELP = '选择你想数的日子：比如“周五”会计算截止日期前还剩多少个周五；“周末”会计算周六和周日；“自定义星期”可以自己选择。'
const MOMENT_KIND_HELP = '给这个时刻一个轻巧的归类，方便以后在时光里寻找；不影响日期和内容。'
const WEEKDAY_CHOICES: Array<[number, string]> = [[1, '一'], [2, '二'], [3, '三'], [4, '四'], [5, '五'], [6, '六'], [0, '日']]

function makeId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  return `${prefix}-${random}`
}
function HelpHint({ id, label, text }: { id: string; label: string; text: string }): ReactElement {
  return <span className="field-help-inline"><span>{label}</span><button type="button" aria-label={`解释“${label}”`} aria-describedby={id}><CircleHelp size={14} strokeWidth={1.7} aria-hidden="true" /></button><span id={id} className="field-help-tooltip" role="tooltip">{text}</span></span>
}

export function RecordDrawer({ type, existingRecord, availablePhotos, onClose, onChangeType, onSave }: { type: RecorderType; existingRecord?: EditableRecord; availablePhotos: PhotoAsset[]; onClose: () => void; onChangeType: (type: RecorderType) => void; onSave: (draft: RecordDraft) => void | Promise<void> }): ReactElement {
  const existingMoment = type === 'moment' ? existingRecord as Moment | undefined : undefined
  const existingElapsed = type === 'elapsed' ? existingRecord as ElapsedCounter | undefined : undefined
  const existingRemaining = type === 'remaining' ? existingRecord as RemainingCounter | undefined : undefined
  const existingStage = type === 'stage' ? existingRecord as Stage | undefined : undefined
  const [title, setTitle] = useState(() => existingRecord?.title ?? '')
  const [date, setDate] = useState(() => existingMoment?.date ?? existingElapsed?.startDate ?? existingStage?.startDate ?? todayIso())
  const [note, setNote] = useState(() => existingMoment?.note ?? '')
  const [location, setLocation] = useState(() => existingMoment?.location ?? '')
  const [endDate, setEndDate] = useState(existingRemaining?.endDate ?? existingStage?.endDate ?? shiftIsoDate(todayIso(), 120))
  const [unit, setUnit] = useState<RemainingUnit>(existingRemaining?.unit ?? 'friday')
  const [weekdays, setWeekdays] = useState<number[]>(() => existingRemaining?.weekdays ? [...existingRemaining.weekdays] : [])
  const [momentKind, setMomentKind] = useState<MomentKind>(() => existingMoment?.kind ?? 'first')
  const [photos, setPhotos] = useState<DraftPhoto[]>(() => existingMoment ? existingMoment.photoIds.map((id) => availablePhotos.find((photo) => photo.id === id)).filter((photo): photo is PhotoAsset => Boolean(photo)) : [])
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([])
  const selectedPhotoIds = resolveMomentPhotoIds(existingMoment?.photoIds ?? [], photos, removedPhotoIds)
  const unavailablePhotoIds = selectedPhotoIds.filter((id) => !photos.some((photo) => photo.id === id))
  const removePhoto = (id: string) => {
    const photo = photos.find((item) => item.id === id)
    if (photo?.file) { URL.revokeObjectURL(photo.src); draftObjectUrls.current.delete(photo.src) }
    setPhotos((current) => current.filter((item) => item.id !== id))
    setRemovedPhotoIds((current) => [...current, id])
  }
  const [validationError, setValidationError] = useState<string | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const endDateInputRef = useRef<HTMLInputElement>(null)
  const unitSelectRef = useRef<HTMLSelectElement>(null)
  const drawerRef = useRef<HTMLElement | null>(null)
    const draftObjectUrls = useRef(new Set<string>())

    useEffect(() => () => {
      for (const url of draftObjectUrls.current) URL.revokeObjectURL(url)
      draftObjectUrls.current.clear()
    }, [])

  const typeLabel = type === 'moment' ? (existingMoment ? '编辑这段时光' : '记录一个时刻') : type === 'elapsed' ? (existingElapsed ? '编辑这段经年' : '创建一段经年') : type === 'remaining' ? (existingRemaining ? '编辑这段余下' : '创建一段余下') : (existingStage ? '编辑这段刻度' : '创建一段刻度')

  useFocusTrap(drawerRef, titleInputRef)

  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || selectedPhotoIds.length >= 3) return
      const src = URL.createObjectURL(file)
      draftObjectUrls.current.add(src)
      const now = new Date().toISOString()
      setPhotos((current) => [...current, { id: makeId('photo'), src, name: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size, sha256: 'pending', createdAt: now, updatedAt: now, file }])
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
    onSave({ type, existingId: existingRecord?.id, existingMomentId: existingMoment?.id, momentKind, title, date, note, location, endDate, unit, weekdays, photos, removedPhotoIds })
  }

  return <div className="drawer-layer"><button className="drawer-backdrop" onClick={onClose} aria-label="关闭记录面板" /><aside ref={drawerRef} className="record-drawer" role="dialog" aria-modal="true" aria-label={typeLabel}><div className="drawer-header"><div><span className="eyebrow">几度</span><h2>{typeLabel}</h2></div><button className="close-button" onClick={onClose} aria-label="关闭"><X size={19} /></button></div><div className="drawer-type-row">{(['moment', 'elapsed', 'remaining', 'stage'] as RecorderType[]).map((item) => <button type="button" key={item} className={item === type ? 'is-selected' : ''} title={RECORD_TYPE_HELP[item]} aria-pressed={item === type} onClick={() => onChangeType(item)}>{item === 'moment' ? '初见' : item === 'elapsed' ? '经年' : item === 'remaining' ? '余下' : '刻度'}</button>)}</div><p className="drawer-type-hint">{RECORD_TYPE_HELP[type]}</p><form className="record-form" aria-describedby={validationError ? 'record-form-error' : undefined} onSubmit={submit}><div className="record-form-fields"><label>名称<input ref={titleInputRef} name="title" aria-required="true" value={title} onChange={(event) => { setTitle(event.target.value); setValidationError(null) }} placeholder={type === 'moment' ? '例如：第一次一个人旅行' : type === 'elapsed' ? '例如：来到这座城市' : type === 'remaining' ? '例如：毕业以前' : '例如：大学'} /></label>{validationError && <p id="record-form-error" className="form-error" role="alert">{validationError}</p>}{type !== 'remaining' && <label>{type === 'stage' ? '开始日期' : type === 'moment' ? '发生日期' : '开始日期'}<input ref={dateInputRef} name="date" aria-required="true" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>}{(type === 'remaining' || type === 'stage') && <label>{type === 'remaining' ? '截止日期' : '结束日期'}<input ref={endDateInputRef} name="endDate" aria-required="true" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>}{type === 'remaining' && <><div><label htmlFor="remaining-unit"><HelpHint id="remaining-unit-help" label="想数什么" text={REMAINING_UNIT_HELP} /><select ref={unitSelectRef} id="remaining-unit" name="remainingUnit" value={unit} onChange={(event) => { setUnit(event.target.value as RemainingUnit); setValidationError(null) }}>{Object.entries(UNIT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>{unit === 'custom' && <div className="weekday-picker" role="group" aria-label="选择星期"><span>每周选择</span><div>{WEEKDAY_CHOICES.map(([day, label]) => <button type="button" key={day} className={weekdays.includes(day) ? 'is-selected' : ''} onClick={() => { setWeekdays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day]); setValidationError(null) }}>周{label}</button>)}</div></div>}</div></>}{type === 'moment' && <><label><HelpHint id="moment-kind-help" label="类型" text={MOMENT_KIND_HELP} /><select id="moment-kind" name="momentKind" aria-label="时刻类型" value={momentKind} onChange={(event) => setMomentKind(event.target.value as MomentKind)}>{Object.entries(KIND_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>地点 <span className="optional">选填</span><input name="location" autoComplete="street-address" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="例如：北海道" /></label><label>一句话 <span className="optional">选填</span><textarea name="note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="那天下午天气很好。" rows={3} /></label><label className="photo-field">照片 <span className="optional">最多 3 张</span><span className="photo-upload"><ImagePlus size={17} /><span>{selectedPhotoIds.length >= 3 ? '照片已满' : '留下一张证据'}</span><input disabled={selectedPhotoIds.length >= 3} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} /></span>{photos.length > 0 && <span className="photo-preview-list">{photos.map((photo) => <span className="photo-thumb" key={photo.id}><img src={photo.src} alt={photo.name} /><button type="button" onClick={() => removePhoto(photo.id)} aria-label={`移除${photo.name}`}><X size={12} /></button></span>)}</span>}{unavailablePhotoIds.length > 0 && <span className="unavailable-photos"><span>有 {unavailablePhotoIds.length} 张照片暂不可用，原关联仍保留。只修改文字不会移除照片。</span>{unavailablePhotoIds.map((id, index) => <span className="unavailable-photo" key={id}><span>暂不可用照片 {index + 1}</span><button type="button" onClick={() => removePhoto(id)} aria-label={`移除第 ${index + 1} 张暂不可用照片`}>移除关联</button></span>)}</span>}</label></>}</div><div className="record-actions"><button className="save-record" type="submit">{existingRecord ? '保存修改' : '保存这段时间'}</button></div></form></aside></div>
}

export function MomentDetail({ moment, photos, isPinned, onPin, onShare, onClose, onEdit, onDelete }: { moment: Moment; photos: PhotoAsset[]; isPinned: boolean; onPin: () => void; onShare: () => void; onClose: () => void; onEdit: () => void; onDelete: () => void }): ReactElement {
  const momentPhotos = moment.photoIds.map((id) => ({ id, photo: photos.find((photo) => photo.id === id) }))
  const layerRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  useFocusTrap(layerRef, closeRef)
  return <div ref={layerRef} className="drawer-layer"><button className="drawer-backdrop" onClick={onClose} aria-label="关闭详情" /><aside className="detail-drawer" role="dialog" aria-modal="true" aria-label={`${moment.title}详情`}><div className="detail-toolbar"><span className="eyebrow">{KIND_LABELS[moment.kind]}</span><div><button className={`close-button ${isPinned ? 'is-pinned' : ''}`} onClick={onPin} aria-label={isPinned ? '取消首页置顶' : '置顶到首页'}><Pin size={16} /></button><button className="close-button" onClick={onShare} aria-label="生成 Moment 分享卡"><Share2 size={16} /></button><button className="close-button" onClick={onEdit} aria-label="编辑"><Pencil size={16} /></button><button className="close-button" onClick={onDelete} aria-label="删除"><Trash2 size={17} /></button><button ref={closeRef} className="close-button" onClick={onClose} aria-label="关闭"><X size={19} /></button></div></div>{momentPhotos.length ? <section className="detail-photos" aria-label="这段时光的照片">{momentPhotos.map(({ id, photo }, index) => <figure key={id}>{photo ? <SafeImage className="detail-photo" src={photo.src} alt={`${moment.title} · 照片 ${index + 1}`} fileLabel={photo.name} /> : <div className="detail-photo-placeholder"><Archive size={30} aria-hidden="true" /><span>这张照片暂不可用，原关联仍保留。</span></div>}<figcaption>照片 {index + 1} / {momentPhotos.length}{photo ? ` · ${photo.name}` : ''}</figcaption></figure>)}</section> : <div className="detail-photo-placeholder"><Archive size={30} strokeWidth={1.4} /><span>为这个时刻留一张照片</span></div>}<div className="detail-copy"><h2>{moment.title}</h2><p className="detail-date">{formatDateWithWeekday(moment.date)}</p>{moment.location && <p className="detail-location">{moment.location}</p>}<p className="detail-note">{moment.note || '有些日子，后来才知道值得记住。'}</p><div className="detail-footnote">这是时间册里的第 {moment.id === 'moment-watermelon' ? '1' : '一'} 个「{KIND_LABELS[moment.kind]}」</div></div></aside></div>
}

export function StageDetail({ stage, onClose, onEdit, onToggle, onDelete }: { stage: Stage; onClose: () => void; onEdit: () => void; onToggle: () => void; onDelete: () => void }): ReactElement {
  const isLife = stage.kind === 'life'
  const progress = getStageProgress(stage.startDate, stage.endDate)
  const layerRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  useFocusTrap(layerRef, closeRef)
  return <div ref={layerRef} className="drawer-layer"><button className="drawer-backdrop" onClick={onClose} aria-label="关闭阶段详情" /><aside className="detail-drawer stage-detail-drawer" role="dialog" aria-modal="true" aria-label={`${stage.title}阶段详情`}><div className="detail-toolbar"><span className="eyebrow">阶段详情</span><div>{!isLife && <button className="close-button" onClick={onEdit} aria-label={`编辑${stage.title}`}><Pencil size={16} /></button>}<button ref={closeRef} className="close-button" onClick={onClose} aria-label="关闭"><X size={19} /></button></div></div><div className="stage-detail-copy"><span className="row-label">{formatDate(stage.startDate, 'long')} — {formatDate(stage.endDate, 'long')}</span><h2>{stage.title}</h2><div className="stage-detail-number">{progress.toFixed(1)}<small>%</small></div><div className="progress-rail"><span style={{ transform: `scaleX(${progress / 100})` }} /></div><p>{isLife ? '这是根据生日和预期年限计算的人生进度，不会修改你的其他阶段记录。' : stage.enabled ? '这段刻度正在你的时间里经过。' : '这段刻度已暂停展示。'}</p></div>{!isLife && <div className="stage-detail-actions"><button className="outline-action" onClick={onToggle}>{stage.enabled ? '暂停展示' : '重新启用'}</button><button className="outline-action danger-action" onClick={onDelete}>删除这段刻度</button></div>}</aside></div>
}

export function ImportDialog({ summary, onCancel, onChoose }: { summary: BackupSummary; onCancel: () => void; onChoose: (mode: 'merge' | 'replace') => void }): ReactElement {
  const layerRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  useFocusTrap(layerRef, closeRef)
  return <div ref={layerRef} className="dialog-layer"><button ref={closeRef} className="dialog-backdrop" onClick={onCancel} aria-label="关闭导入预览" /><section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title"><div className="dialog-icon"><Archive size={20} /></div><div className="eyebrow">备份预览</div><h2 id="import-title">带回一段时间</h2><p className="dialog-file">{summary.fileName}</p><div className="import-summary"><span><strong>{summary.momentCount}</strong> 个时刻</span><span><strong>{summary.photoCount}</strong> 张照片</span><span>{summary.timezone}</span></div><p className="dialog-note">合并会保留本机和备份中的不同记录；替换会用备份内容覆盖本机时间册。</p><div className="dialog-actions"><button className="outline-action" onClick={onCancel}>取消</button><button className="outline-action" onClick={() => onChoose('merge')}>合并导入</button><button className="dark-action" onClick={() => onChoose('replace')}>替换本机数据</button></div></section></div>
}
