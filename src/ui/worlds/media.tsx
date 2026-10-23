import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import type { AppState, Moment, PhotoAsset } from '../../domain/types'

export function SafeImage({ src, alt, fileLabel, className, loading = 'lazy' }: { src: string; alt: string; fileLabel: string; className?: string; loading?: 'eager' | 'lazy' }): ReactElement {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])

  if (failed) return <div className={`photo-media-error${className ? ` ${className}` : ''}`} role="img" aria-label={`${fileLabel}无法读取`}><span>图片暂时无法读取</span><small>{fileLabel}</small><button type="button" onClick={() => setFailed(false)}>重新加载</button></div>
  return <img className={className} src={src} alt={alt} loading={loading} decoding="async" onError={() => setFailed(true)} onLoad={(event) => { const image = event.currentTarget; if (typeof image.decode === 'function') image.decode().catch(() => setFailed(true)) }} />
}

export function getMomentPhoto(state: AppState, moment: Moment): PhotoAsset | undefined {
  return moment.photoIds.map((id) => state.photos.find((photo) => photo.id === id)).find((photo): photo is PhotoAsset => Boolean(photo))
}
