import { invoke } from '@tauri-apps/api/core'
import { getSqliteDatabase } from './sqlite-database'
import type { PhotoAssetMetadata } from '../domain/types'

const ASSET_DATA_PREFIX = 'memento:asset-data:v1:'
const ASSET_INDEX_KEY = 'memento:asset-index:v1'

export interface AssetRepairReport {
  missingAssetIds: string[]
  orphanedAssetIds: string[]
  corruptAssetIds: string[]
}

export interface AssetPutResult {
  metadata: PhotoAssetMetadata
  /** True only when this operation created the asset bytes. */
  created: boolean
}

export interface AssetStore {
  put(file: File, assetId?: string): Promise<PhotoAssetMetadata>
  putWithStatus(file: File, assetId?: string): Promise<AssetPutResult>
  read(assetId: string): Promise<Blob | null>
  remove(assetId: string): Promise<void>
  list(): Promise<PhotoAssetMetadata[]>
  verify(): Promise<AssetRepairReport>
}

const assetWriteQueues = new Map<string, Promise<void>>()

function withAssetWriteLock<T>(assetId: string, operation: () => Promise<T>): Promise<T> {
  const previous = assetWriteQueues.get(assetId) ?? Promise.resolve()
  const result = previous.then(operation)
  const settled = result.then(() => undefined, () => undefined)
  assetWriteQueues.set(assetId, settled)
  void settled.then(() => {
    if (assetWriteQueues.get(assetId) === settled) assetWriteQueues.delete(assetId)
  })
  return result
}

export class AssetStoreError extends Error {
  constructor(message: string, readonly code: 'invalid_asset_id' | 'asset_id_conflict' | 'local_storage' | 'corrupt_metadata') {
    super(message)
    this.name = 'AssetStoreError'
  }
}

type SqlAssetRow = {
  id: string
  name: string
  mime_type: string
  size_bytes: number
  sha256: string
  width: number | null
  height: number | null
  created_at: string
  updated_at: string
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function isSafeAssetId(assetId: string): boolean {
  return /^[a-zA-Z0-9_-]{1,128}$/.test(assetId)
}

function isPhotoMetadata(value: unknown): value is PhotoAssetMetadata {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<PhotoAssetMetadata>
  return typeof item.id === 'string' && isSafeAssetId(item.id)
    && typeof item.name === 'string' && typeof item.mimeType === 'string'
    && Number.isSafeInteger(item.sizeBytes) && (item.sizeBytes ?? -1) >= 0
    && typeof item.sha256 === 'string' && /^[a-f0-9]{64}$/.test(item.sha256)
    && typeof item.createdAt === 'string' && !Number.isNaN(Date.parse(item.createdAt))
    && typeof item.updatedAt === 'string' && !Number.isNaN(Date.parse(item.updatedAt))
    && (item.width === undefined || (typeof item.width === 'number' && Number.isFinite(item.width)))
    && (item.height === undefined || (typeof item.height === 'number' && Number.isFinite(item.height)))
}

function createAssetId(): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `photo_${random}`
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function hashBytes(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('当前环境无法校验照片完整性。')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function imageDimensions(file: File): Promise<{ width?: number; height?: number }> {
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') return {}
  try {
    const bitmap = await createImageBitmap(file)
    const dimensions = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return dimensions
  } catch {
    return {}
  }
}

async function makeMetadata(file: File, assetId: string): Promise<PhotoAssetMetadata> {
  if (!isSafeAssetId(assetId)) throw new AssetStoreError('照片编号格式无效。', 'invalid_asset_id')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const dimensions = await imageDimensions(file)
  const now = new Date().toISOString()
  return {
    id: assetId,
    name: file.name || `${assetId}.bin`,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: bytes.byteLength,
    sha256: await hashBytes(bytes),
    ...dimensions,
    createdAt: now,
    updatedAt: now,
  }
}

function mapSqlAsset(row: SqlAssetRow): PhotoAssetMetadata {
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    sha256: row.sha256,
    ...(row.width === null ? {} : { width: row.width }),
    ...(row.height === null ? {} : { height: row.height }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function metadataEqual(left: PhotoAssetMetadata, right: PhotoAssetMetadata): boolean {
  return left.sha256 === right.sha256 && left.sizeBytes === right.sizeBytes
}

function localMetadata(): PhotoAssetMetadata[] {
  const raw = localStorage.getItem(ASSET_INDEX_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || !parsed.every(isPhotoMetadata)) {
      throw new Error('metadata shape')
    }
    return parsed as PhotoAssetMetadata[]
  } catch {
    throw new AssetStoreError('本地照片索引无法读取。原始照片文件已保留。', 'corrupt_metadata')
  }
}

export class BrowserAssetStore implements AssetStore {
  async put(file: File, assetId = createAssetId()): Promise<PhotoAssetMetadata> {
    return (await this.putWithStatus(file, assetId)).metadata
  }

  async putWithStatus(file: File, assetId = createAssetId()): Promise<AssetPutResult> {
    return withAssetWriteLock(assetId, async () => {
    const metadata = await makeMetadata(file, assetId)
    const entries = localMetadata()
    const existing = entries.find((item) => item.id === assetId)
    if (existing) {
      if (metadataEqual(existing, metadata)) return { metadata: existing, created: false }
      throw new AssetStoreError('这个照片编号已经对应另一张照片，原照片没有被覆盖。', 'asset_id_conflict')
    }

    const key = `${ASSET_DATA_PREFIX}${assetId}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const orphan = localStorage.getItem(key)
    if (orphan !== null) {
      try {
        const orphanHash = await hashBytes(base64ToBytes(orphan))
        if (orphanHash !== metadata.sha256) throw new Error('conflict')
        localStorage.setItem(ASSET_INDEX_KEY, JSON.stringify([...localMetadata(), metadata]))
        return { metadata, created: false }
      } catch (error) {
        if (error instanceof AssetStoreError) throw error
        throw new AssetStoreError('发现内容不同或损坏的同名照片文件，未覆盖该文件。', 'asset_id_conflict')
      }
    }
    const encoded = bytesToBase64(bytes)
    try {
      localStorage.setItem(key, encoded)
      // Other asset IDs may have committed while arrayBuffer/hash awaited.
      // Read and update the shared index synchronously at the commit boundary.
      localStorage.setItem(ASSET_INDEX_KEY, JSON.stringify([...localMetadata(), metadata]))
      return { metadata, created: true }
    } catch (error) {
      if (localStorage.getItem(key) === encoded) localStorage.removeItem(key)
      throw new AssetStoreError(
        error instanceof Error ? `浏览器本地空间写入失败，照片未保存：${error.message}` : '浏览器本地空间写入失败，照片未保存。',
        'local_storage',
      )
    }
    })
  }

  async read(assetId: string): Promise<Blob | null> {
    if (!isSafeAssetId(assetId)) throw new AssetStoreError('照片编号格式无效。', 'invalid_asset_id')
    const encoded = localStorage.getItem(`${ASSET_DATA_PREFIX}${assetId}`)
    if (encoded === null) return null
    const metadata = localMetadata().find((item) => item.id === assetId)
    return new Blob([base64ToBytes(encoded)], { type: metadata?.mimeType ?? 'application/octet-stream' })
  }

  async remove(assetId: string): Promise<void> {
    if (!isSafeAssetId(assetId)) throw new AssetStoreError('照片编号格式无效。', 'invalid_asset_id')
    const entries = localMetadata()
    localStorage.removeItem(`${ASSET_DATA_PREFIX}${assetId}`)
    localStorage.setItem(ASSET_INDEX_KEY, JSON.stringify(entries.filter((item) => item.id !== assetId)))
  }

  async list(): Promise<PhotoAssetMetadata[]> {
    return localMetadata()
  }

  async verify(): Promise<AssetRepairReport> {
    const metadata = localMetadata()
    const knownIds = new Set(metadata.map((item) => item.id))
    const missingAssetIds: string[] = []
    const corruptAssetIds: string[] = []
    for (const item of metadata) {
      let blob: Blob | null
      try {
        blob = await this.read(item.id)
      } catch {
        corruptAssetIds.push(item.id)
        continue
      }
      if (!blob) {
        missingAssetIds.push(item.id)
        continue
      }
      if (await hashBytes(new Uint8Array(await blob.arrayBuffer())) !== item.sha256) corruptAssetIds.push(item.id)
    }
    const fileIds: string[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key?.startsWith(ASSET_DATA_PREFIX)) fileIds.push(key.slice(ASSET_DATA_PREFIX.length))
    }
    return {
      missingAssetIds,
      corruptAssetIds,
      orphanedAssetIds: fileIds.filter((id) => !knownIds.has(id)),
    }
  }
}

export class TauriAssetStore implements AssetStore {
  async put(file: File, assetId = createAssetId()): Promise<PhotoAssetMetadata> {
    return (await this.putWithStatus(file, assetId)).metadata
  }

  async putWithStatus(file: File, assetId = createAssetId()): Promise<AssetPutResult> {
    return withAssetWriteLock(assetId, async () => {
    const metadata = await makeMetadata(file, assetId)
    const database = await getSqliteDatabase()
    const rows = await database.select<SqlAssetRow[]>('SELECT * FROM photo_assets WHERE id = $1', [assetId])
    if (rows[0]) {
      const existing = mapSqlAsset(rows[0])
      if (metadataEqual(existing, metadata)) return { metadata: existing, created: false }
      throw new AssetStoreError('这个照片编号已经对应另一张照片，原照片没有被覆盖。', 'asset_id_conflict')
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const existingBytes = await this.read(assetId)
    let created = false
    if (existingBytes) {
      const existingHash = await hashBytes(new Uint8Array(await existingBytes.arrayBuffer()))
      if (existingHash !== metadata.sha256) throw new AssetStoreError('发现内容不同的同名照片文件，未覆盖该文件。', 'asset_id_conflict')
    } else {
      try {
        await invoke<void>('memento_store_asset_bytes', bytes, { headers: { 'x-memento-asset-id': assetId } })
        created = true
      } catch (error) {
        const racedBlob = await this.read(assetId).catch(() => null)
        if (!racedBlob || racedBlob.size !== metadata.sizeBytes || await hashBytes(new Uint8Array(await racedBlob.arrayBuffer())) !== metadata.sha256) throw error
      }
    }
    try {
      await database.execute(
        'INSERT INTO photo_assets (id, name, mime_type, size_bytes, sha256, width, height, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT(id) DO NOTHING',
        [metadata.id, metadata.name, metadata.mimeType, metadata.sizeBytes, metadata.sha256, metadata.width ?? null, metadata.height ?? null, metadata.createdAt, metadata.updatedAt],
      )
      const storedRows = await database.select<SqlAssetRow[]>('SELECT * FROM photo_assets WHERE id = $1', [assetId])
      const storedMetadata = storedRows[0] ? mapSqlAsset(storedRows[0]) : null
      if (!storedMetadata || !metadataEqual(storedMetadata, metadata)) {
        throw new AssetStoreError('这个照片编号已经登记了另一份资产元数据，原内容没有被覆盖。', 'asset_id_conflict')
      }
      return { metadata: storedMetadata, created }
    } catch (error) {
      if (created) {
        try { await database.execute('DELETE FROM photo_assets WHERE id = $1 AND sha256 = $2', [assetId, metadata.sha256]) } catch { /* Preserve the original write error. */ }
        try { await invoke<void>('memento_remove_asset_file', { assetId }) } catch { /* Verification will report any incomplete cleanup. */ }
      }
      throw error
    }
    })
  }

  async read(assetId: string): Promise<Blob | null> {
    if (!isSafeAssetId(assetId)) throw new AssetStoreError('照片编号格式无效。', 'invalid_asset_id')
    try {
      const result = await invoke<ArrayBuffer | Uint8Array | number[]>('memento_read_asset_bytes', { assetId })
      const bytes = result instanceof ArrayBuffer
        ? new Uint8Array(result)
        : result instanceof Uint8Array
          ? result
          : Uint8Array.from(result)
      const metadata = (await this.list()).find((item) => item.id === assetId)
      return new Blob([bytes], { type: metadata?.mimeType ?? 'application/octet-stream' })
    } catch (error) {
      const message = typeof error === 'string' ? error : error instanceof Error ? error.message : String(error)
      if (message.includes('ASSET_NOT_FOUND')) return null
      throw error
    }
  }

  async remove(assetId: string): Promise<void> {
    if (!isSafeAssetId(assetId)) throw new AssetStoreError('照片编号格式无效。', 'invalid_asset_id')
    await invoke<void>('memento_remove_asset_file', { assetId })
    const database = await getSqliteDatabase()
    await database.execute('DELETE FROM photo_assets WHERE id = $1', [assetId])
  }

  async list(): Promise<PhotoAssetMetadata[]> {
    const database = await getSqliteDatabase()
    const rows = await database.select<SqlAssetRow[]>('SELECT * FROM photo_assets ORDER BY created_at, id')
    return rows.map(mapSqlAsset)
  }

  async verify(): Promise<AssetRepairReport> {
    const metadata = await this.list()
    const fileIds = await invoke<string[]>('memento_list_asset_ids')
    const files = new Set(fileIds)
    const knownIds = new Set(metadata.map((item) => item.id))
    const missingAssetIds: string[] = []
    const corruptAssetIds: string[] = []
    for (const item of metadata) {
      let blob: Blob | null
      try { blob = await this.read(item.id) } catch {
        corruptAssetIds.push(item.id)
        continue
      }
      if (!files.has(item.id) || !blob) {
        missingAssetIds.push(item.id)
        continue
      }
      if (await hashBytes(new Uint8Array(await blob.arrayBuffer())) !== item.sha256) corruptAssetIds.push(item.id)
    }
    return {
      missingAssetIds,
      corruptAssetIds,
      orphanedAssetIds: fileIds.filter((id) => !knownIds.has(id)),
    }
  }
}

export function createAssetStore(): AssetStore {
  return isTauriRuntime() ? new TauriAssetStore() : new BrowserAssetStore()
}
