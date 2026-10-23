import { useRef } from 'react'
import type { ReactElement } from 'react'
import { X } from 'lucide-react'
import type { LibraryCopy } from '../domain/types'
import { useFocusTrap } from './focus-trap'

export function NarrationSourceDialog({ copy, onClose }: { copy: LibraryCopy; onClose: () => void }): ReactElement {
  const layerRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  useFocusTrap(layerRef, closeRef)
  return <div ref={layerRef} className="narration-source-overlay" role="dialog" aria-modal="true" aria-label="文案来源"><section className="narration-source-dialog"><header><span>NARRATION / SOURCE NOTE</span><button ref={closeRef} onClick={onClose} aria-label="关闭文案来源"><X size={17} /></button></header><p className="narration-source-original">{copy.original}</p>{copy.translationZh && <p className="narration-source-translation">{copy.translationZh}</p>}<dl><div><dt>作者</dt><dd>{copy.author ?? '佚名'}</dd></div><div><dt>作品</dt><dd>{copy.work ?? '未标注'}</dd></div><div><dt>来源</dt><dd>{copy.sourceName}</dd></div><div><dt>许可</dt><dd>{copy.license === 'cc0' ? 'CC0 1.0' : '公共领域 / Project Gutenberg'}</dd></div></dl><a href={copy.sourceUrl} target="_blank" rel="noreferrer">打开来源页面 ↗</a><p className="narration-source-note">{copy.translationNote ?? '原文与来源信息随本地文案库保存。'}</p></section></div>
}
