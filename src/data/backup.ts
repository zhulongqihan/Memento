import JSZip from 'jszip'
import type { AppState, BackupSummary } from '../domain/types'
import { migrateAppState } from './migration'

interface BackupManifest {
  schemaVersion: number
  appVersion: string
  exportedAt: string
  timezone: string
  momentCount: number
  photoCount: number
}

interface BackupPayload {
  manifest: BackupManifest
  data: AppState
}

function buildPayload(state: AppState): BackupPayload {
  return {
    manifest: {
      schemaVersion: state.schemaVersion,
      appVersion: '2.2.0',
      exportedAt: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      momentCount: state.moments.length,
      photoCount: state.photos.length,
    },
    data: state,
  }
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function exportJson(state: AppState): Promise<void> {
  const payload = buildPayload(state)
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  download(blob, `memento-backup-${new Date().toISOString().slice(0, 10)}.json`)
}

export async function exportZip(state: AppState): Promise<void> {
  const payload = buildPayload(state)
  const zip = new JSZip()
  zip.file('manifest.json', JSON.stringify(payload.manifest, null, 2))
  zip.file('data.json', JSON.stringify(payload.data, null, 2))
  payload.data.photos.forEach((photo) => {
    const base64 = photo.dataUrl.split(',')[1]
    if (base64) zip.file(`assets/${photo.id}`, base64, { base64: true })
  })
  const blob = await zip.generateAsync({ type: 'blob' })
  download(blob, `memento-backup-${new Date().toISOString().slice(0, 10)}.zip`)
}

export async function parseBackup(file: File): Promise<BackupSummary> {
  if (file.name.toLowerCase().endsWith('.zip')) {
    const zip = await JSZip.loadAsync(file)
    const dataFile = zip.file('data.json')
    if (!dataFile) throw new Error('备份中缺少 data.json')
    const data = JSON.parse(await dataFile.async('text')) as AppState
    const manifestFile = zip.file('manifest.json')
    const manifest = manifestFile ? JSON.parse(await manifestFile.async('text')) as BackupManifest : buildPayload(data).manifest
    const migrated = validateBackup(data)
    return { ...manifest, schemaVersion: migrated.schemaVersion, fileName: file.name, data: migrated }
  }

  const parsed = JSON.parse(await file.text()) as BackupPayload | AppState
  const data = 'data' in parsed ? parsed.data : parsed
  const manifest = 'manifest' in parsed ? parsed.manifest : buildPayload(data).manifest
  const migrated = validateBackup(data)
  return { ...manifest, schemaVersion: migrated.schemaVersion, fileName: file.name, data: migrated }
}

function validateBackup(data: AppState): AppState {
  const migrated = migrateAppState(data)
  if (!migrated) {
    throw new Error('无法识别的几度备份格式')
  }
  return migrated
}
