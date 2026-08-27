import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import { ArrowLeft, ArrowRight, ExternalLink, Pause, Play, X } from 'lucide-react'

export interface RiverDriftItem {
  id: string
  kind: 'moment' | 'daily' | 'narration' | 'measure'
  eyebrow: string
  title: string
  body: string
  meta: string
  actionLabel?: string
  onOpen?: () => void
  onSource?: () => void
}

function drawRiver(canvas: HTMLCanvasElement, pointer: { x: number; y: number }, reduced: boolean, elapsed: number): void {
  const bounds = canvas.getBoundingClientRect()
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const width = Math.max(1, bounds.width)
  const height = Math.max(1, bounds.height)
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
  }
  const context = canvas.getContext('2d')
  if (!context) return
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.clearRect(0, 0, width, height)
  const shift = reduced ? 0 : Math.sin(elapsed / 1900) * 12 + (pointer.x - 0.5) * 22
  const center = height * 0.58 + (pointer.y - 0.5) * 18
  const paths = [
    { offset: -82, color: 'rgba(197, 110, 69, .34)', width: 1.4 },
    { offset: 0, color: 'rgba(235, 210, 151, .72)', width: 2.1 },
    { offset: 96, color: 'rgba(144, 176, 139, .32)', width: 1.2 },
  ]
  paths.forEach(({ offset, color, width: lineWidth }, index) => {
    context.beginPath()
    context.moveTo(-40, center + offset + 34)
    context.bezierCurveTo(width * 0.24, center + offset - 52 + shift, width * 0.5, center + offset + 72 - shift, width + 40, center + offset - 14)
    context.strokeStyle = color
    context.lineWidth = lineWidth
    context.setLineDash(index === 1 ? [] : [3, 13])
    context.stroke()
  })
  context.setLineDash([])
  if (!reduced) {
    const rippleX = pointer.x * width
    const rippleY = pointer.y * height
    for (let ring = 0; ring < 3; ring += 1) {
      const radius = 16 + ring * 18 + ((elapsed / 45 + ring * 11) % 24)
      context.beginPath()
      context.arc(rippleX, rippleY, radius, 0, Math.PI * 2)
      context.strokeStyle = `rgba(226, 174, 105, ${0.11 - ring * 0.025})`
      context.lineWidth = 1
      context.stroke()
    }
  }
}

export function RiverDriftOverlay({ items, onClose }: { items: RiverDriftItem[]; onClose: () => void }): ReactElement | null {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [windowFocused, setWindowFocused] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [pointer, setPointer] = useState({ x: 0.52, y: 0.52 })
  const item = items[index]

  useEffect(() => {
    closeRef.current?.focus()
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => setReducedMotion(media.matches)
    updateMotion()
    media.addEventListener('change', updateMotion)
    const handleVisibility = () => setWindowFocused(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      media.removeEventListener('change', updateMotion)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key === 'ArrowLeft' && items.length > 0) { event.preventDefault(); setIndex((value) => (value - 1 + items.length) % items.length); return }
      if (event.key === 'ArrowRight' && items.length > 0) { event.preventDefault(); setIndex((value) => (value + 1) % items.length); return }
      if (event.key === ' ') { event.preventDefault(); setPaused((value) => !value); return }
      if (event.key === 'Enter') { event.preventDefault(); item?.onOpen?.() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [item, items.length, onClose])

  useEffect(() => {
    if (reducedMotion || paused || hovered || focused || !windowFocused || items.length < 2) return
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % items.length), 4_800)
    return () => window.clearInterval(timer)
  }, [focused, hovered, items.length, paused, reducedMotion, windowFocused])

  useEffect(() => {
    let frame = 0
    const started = performance.now()
    const render = (now: number) => {
      if (canvasRef.current) drawRiver(canvasRef.current, pointer, reducedMotion, now - started)
      if (!reducedMotion) frame = window.requestAnimationFrame(render)
    }
    render(started)
    return () => window.cancelAnimationFrame(frame)
  }, [pointer, reducedMotion])

  if (!item) return <div className="river-drift-overlay river-drift-overlay--empty" role="dialog" aria-modal="true" aria-label="河流漂流"><button ref={closeRef} className="river-drift-close" onClick={onClose} aria-label="关闭漂流"><X size={18} /></button><div className="river-drift-empty-reading"><span>RIVER / QUIET WATER</span><h1>今天还没有可以漂流的片段。</h1><p>留下第一条记录，或打开每日旁白，再回来看看。</p></div></div>
  const style = { '--river-x': `${pointer.x * 100}%`, '--river-y': `${pointer.y * 100}%` } as CSSProperties
  return <div className="river-drift-overlay" role="dialog" aria-modal="true" aria-label="河流漂流" style={style} onMouseMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setPointer({ x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }) }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
    <canvas ref={canvasRef} className="river-drift-canvas" aria-hidden="true" />
    <svg className="river-drift-svg" viewBox="0 0 1200 800" preserveAspectRatio="none" aria-hidden="true"><path d="M-30 520 C 280 300 420 690 720 480 S 1020 350 1230 510" /><path d="M-30 550 C 280 330 420 720 720 510 S 1020 380 1230 540" /><path d="M-30 490 C 280 270 420 660 720 450 S 1020 320 1230 480" /></svg>
    <header className="river-drift-header"><span>RIVER / PERSONAL CURRENT</span><span>{String(index + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}</span><button ref={closeRef} className="river-drift-close" onClick={onClose} aria-label="关闭漂流"><X size={18} /></button></header>
    <main className="river-drift-stage"><div className="river-drift-index"><span>漂流索引</span><strong>{String(index + 1).padStart(2, '0')}</strong><small>{item.kind === 'moment' ? 'MOMENT' : item.kind === 'daily' ? 'DAILY LINE' : item.kind === 'narration' ? 'NARRATION' : 'MEASURE'}</small></div><article className="river-drift-reading" key={item.id}><span className="river-drift-eyebrow">{item.eyebrow}</span><h1>{item.title}</h1><p>{item.body}</p><footer><span>{item.meta}</span>{item.actionLabel && <button onClick={item.onOpen}>{item.actionLabel}<ExternalLink size={14} /></button>}</footer>{item.onSource && <button className="river-drift-source" onClick={item.onSource}>查看文案来源</button>}</article></main>
    <footer className="river-drift-controls"><button onClick={() => setIndex((value) => (value - 1 + items.length) % items.length)} aria-label="上一段"><ArrowLeft size={17} /></button><button onClick={() => setPaused((value) => !value)} disabled={reducedMotion} aria-label={reducedMotion ? '低动态模式，自动播放已关闭' : paused ? '继续自动播放' : '暂停自动播放'}>{paused ? <Play size={16} /> : <Pause size={16} />}</button><button onClick={() => setIndex((value) => (value + 1) % items.length)} aria-label="下一段"><ArrowRight size={17} /></button><span>{reducedMotion ? '已按低动态模式显示' : paused ? '已暂停' : '鼠标停留或聚焦时自动暂停'}</span></footer>
  </div>
}
