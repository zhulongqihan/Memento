import JSZip from 'jszip'
import { createAssetStore, type AssetStore } from './asset-store'
import { migrateAppState, validatePersistedAppState } from './migration'
import type { AppState, AppStateV4, BackupAssetPayload, BackupSummary, LegacyAppState, PhotoAssetMetadata } from '../domain/types'
import { APP_VERSION } from '../version'

const ENCRYPTED_BACKUP_FORMAT = 'memento-encrypted-backup-v1'
const PBKDF2_ITERATIONS = 210_000
const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

interface BackupManifest {
  schemaVersion: number
  appVersion: string
  exportedAt: string
  timezone: string
  momentCount: number
  photoCount: number
  dailyEntryCount: number
  narrationCount: number
  assets?: PhotoAssetMetadata[]
  integritySha256?: string
}

interface JsonAssetPayload {
  metadata: PhotoAssetMetadata
  data: string
}

interface BackupPayloadV4 {
  manifest: BackupManifest
  data: AppStateV4
  assets: JsonAssetPayload[]
}

interface EncryptedBackupEnvelope {
  format: typeof ENCRYPTED_BACKUP_FORMAT
  version: 1
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number }
  cipher: { name: 'AES-GCM'; tagLength: 128 }
  salt: string
  iv: string
  ciphertext: string
}

function getCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) throw new Error('当前环境不支持安全加密，请更新应用后重试。')
  return globalThis.crypto
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function assertPassword(password: string): void {
  if (password.trim().length < 8) throw new Error('加密密码至少需要 8 个字符。')
}

async function deriveKey(password: string, salt: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> {
  const cryptoApi = getCrypto()
  const passwordKey = await cryptoApi.subtle.importKey('raw', textEncoder.encode(password), 'PBKDF2', false, ['deriveKey'])
  return cryptoApi.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    usages,
  )
}

async function sha256(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === 'string' ? textEncoder.encode(value) : value
  const digest = await getCrypto().subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function toPersistedState(state: AppState): AppStateV4 {
  return {
    schemaVersion: 4,
    moments: state.moments,
    elapsed: state.elapsed,
    remaining: state.remaining,
    stages: state.stages,
    dailyEntries: state.dailyEntries,
    narrationUses: state.narrationUses,
    savedNarrations: state.savedNarrations,
    settings: state.settings,
  }
}

async function exportAssets(state: AppState, assetStore: AssetStore): Promise<JsonAssetPayload[]> {
  const payloads: JsonAssetPayload[] = []
  const referencedIds = [...new Set(state.moments.flatMap((moment) => moment.photoIds))]
  for (const assetId of referencedIds) {
    const photo = state.photos.find((item) => item.id === assetId)
    if (!photo) throw new Error(`备份失败：记录引用的照片 ${assetId} 不在资产索引中。请先修复资产存储。`)
    const blob = await assetStore.read(photo.id)
    if (!blob) throw new Error(`备份失败：照片“${photo.name}”文件不存在。请先修复资产存储。`)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    if (bytes.byteLength !== photo.sizeBytes || await sha256(bytes) !== photo.sha256) {
      throw new Error(`备份失败：照片“${photo.name}”完整性校验不符。`)
    }
    const metadata: PhotoAssetMetadata = {
      id: photo.id,
      name: photo.name,
      mimeType: photo.mimeType,
      sizeBytes: photo.sizeBytes,
      sha256: photo.sha256,
      ...(photo.width === undefined ? {} : { width: photo.width }),
      ...(photo.height === undefined ? {} : { height: photo.height }),
      createdAt: photo.createdAt,
      updatedAt: photo.updatedAt,
    }
    payloads.push({ metadata, data: bytesToBase64(bytes) })
  }
  return payloads
}

async function buildPayload(state: AppState, assetStore: AssetStore): Promise<BackupPayloadV4> {
  const data = toPersistedState(state)
  const assets = await exportAssets(state, assetStore)
  const manifest: BackupManifest = {
    schemaVersion: 4,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    momentCount: data.moments.length,
    photoCount: assets.length,
    dailyEntryCount: data.dailyEntries.length,
    narrationCount: data.narrationUses.length,
    assets: assets.map((asset) => asset.metadata),
  }
  manifest.integritySha256 = await sha256(JSON.stringify({ data, assets }))
  return { manifest, data, assets }
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportJson(state: AppState, assetStore = createAssetStore()): Promise<void> {
  const blob = await createJsonBackupBlob(state, assetStore)
  download(blob, `memento-backup-${new Date().toISOString().slice(0, 10)}.json`)
}

export async function createJsonBackupBlob(state: AppState, assetStore = createAssetStore()): Promise<Blob> {
  const payload = await buildPayload(state, assetStore)
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
}

export async function exportZip(state: AppState, assetStore = createAssetStore()): Promise<void> {
  const blob = await createZipBackupBlob(state, assetStore)
  download(blob, `memento-backup-${new Date().toISOString().slice(0, 10)}.zip`)
}

export async function createZipBackupBlob(state: AppState, assetStore = createAssetStore()): Promise<Blob> {
  const payload = await buildPayload(state, assetStore)
  const zip = new JSZip()
  zip.file('manifest.json', JSON.stringify(payload.manifest, null, 2))
  zip.file('data.json', JSON.stringify(payload.data, null, 2))
  for (const asset of payload.assets) zip.file(`assets/${asset.metadata.id}`, base64ToBytes(asset.data))
  return zip.generateAsync({ type: 'blob' })
}

export async function createEncryptedBackupBlob(state: AppState, password: string, assetStore = createAssetStore()): Promise<Blob> {
  assertPassword(password)
  const cryptoApi = getCrypto()
  const salt = cryptoApi.getRandomValues(new Uint8Array(16))
  const iv = cryptoApi.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, ['encrypt'])
  const payload = await buildPayload(state, assetStore)
  const ciphertext = await cryptoApi.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, textEncoder.encode(JSON.stringify(payload)))
  const envelope: EncryptedBackupEnvelope = {
    format: ENCRYPTED_BACKUP_FORMAT,
    version: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS },
    cipher: { name: 'AES-GCM', tagLength: 128 },
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  }
  return new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/octet-stream' })
}

export async function exportEncryptedBackup(state: AppState, password: string, assetStore = createAssetStore()): Promise<void> {
  const blob = await createEncryptedBackupBlob(state, password, assetStore)
  download(blob, `memento-encrypted-${new Date().toISOString().slice(0, 10)}.memento`)
}

function isEncryptedEnvelope(value: unknown): value is EncryptedBackupEnvelope {
  return isRecord(value) && value.format === ENCRYPTED_BACKUP_FORMAT && value.version === 1
}

function validMetadata(value: unknown): value is PhotoAssetMetadata {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value.id)
    && typeof value.name === 'string' && typeof value.mimeType === 'string'
    && Number.isSafeInteger(value.sizeBytes) && (value.sizeBytes as number) >= 0
    && typeof value.sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.sha256)
    && typeof value.createdAt === 'string' && !Number.isNaN(Date.parse(value.createdAt))
    && typeof value.updatedAt === 'string' && !Number.isNaN(Date.parse(value.updatedAt))
    && (value.width === undefined || (typeof value.width === 'number' && Number.isFinite(value.width)))
    && (value.height === undefined || (typeof value.height === 'number' && Number.isFinite(value.height)))
}

function decodeLegacyDataUrl(value: string): Uint8Array {
  const match = /^data:[^;,]+;base64,([\s\S]*)$/.exec(value)
  if (!match) throw new Error('旧备份中的照片不是有效的 base64 数据。')
  try { return base64ToBytes(match[1]) } catch { throw new Error('旧备份中的照片无法解码。') }
}

async function metadataForLegacy(photo: LegacyAppState['photos'][number], bytes: Uint8Array): Promise<PhotoAssetMetadata> {
  const now = new Date().toISOString()
  return {
    id: photo.id,
    name: photo.name,
    mimeType: photo.mimeType || 'application/octet-stream',
    sizeBytes: bytes.byteLength,
    sha256: await sha256(bytes),
    ...(photo.width === undefined ? {} : { width: photo.width }),
    ...(photo.height === undefined ? {} : { height: photo.height }),
    createdAt: now,
    updatedAt: now,
  }
}

function legacyToV4(legacy: LegacyAppState): AppStateV4 {
  return {
    schemaVersion: 4,
    moments: legacy.moments,
    elapsed: legacy.elapsed,
    remaining: legacy.remaining,
    stages: legacy.stages,
    dailyEntries: legacy.dailyEntries,
    narrationUses: legacy.narrationUses,
    savedNarrations: legacy.savedNarrations,
    settings: legacy.settings,
  }
}

async function summarizeBackup(parsed: unknown, fileName: string, zipAssets?: Map<string, Uint8Array>): Promise<BackupSummary> {
  if (!isRecord(parsed)) throw new Error('无法识别的几度备份格式。')
  const wrapped = 'data' in parsed
  const rawData = wrapped ? parsed.data : parsed
  const manifest = wrapped && isRecord(parsed.manifest) ? parsed.manifest as unknown as BackupManifest : undefined
  let jsonAssets = wrapped && Array.isArray(parsed.assets) ? parsed.assets : []
  if (!rawData || typeof rawData !== 'object') throw new Error('备份缺少状态数据。')

  if (zipAssets && manifest?.schemaVersion === 4 && Array.isArray(manifest.assets)) {
    jsonAssets = manifest.assets.map((metadata) => {
      if (!validMetadata(metadata)) throw new Error('ZIP 清单中的照片元数据无效。')
      const bytes = zipAssets.get(metadata.id)
      if (!bytes) throw new Error(`ZIP 中缺少照片资产 ${metadata.id}。`)
      return { metadata, data: bytesToBase64(bytes) }
    })
  }

  if (manifest?.integritySha256) {
    const legacyDigest = manifest.schemaVersion < 4
      ? await sha256(JSON.stringify(rawData))
      : await sha256(JSON.stringify({ data: rawData, assets: jsonAssets }))
    if (legacyDigest !== manifest.integritySha256) throw new Error('备份完整性校验失败，文件可能被修改。')
  }

  let data: AppStateV4
  let assetPayloads: BackupAssetPayload[]
  const v4 = validatePersistedAppState(rawData)
  if (v4) {
    data = v4
    const metadataValues = manifest?.assets ?? jsonAssets.map((asset) => isRecord(asset) ? asset.metadata : undefined)
    if (!Array.isArray(metadataValues) || metadataValues.some((item) => !validMetadata(item))) {
      if (manifest?.photoCount) throw new Error('v4 备份缺少有效的照片元数据。')
      assetPayloads = []
    } else {
      const metadata = metadataValues as PhotoAssetMetadata[]
      const byId = new Map<string, Uint8Array>()
      if (zipAssets) for (const [id, bytes] of zipAssets) byId.set(id, bytes)
      for (const item of jsonAssets) {
        if (!isRecord(item) || !validMetadata(item.metadata) || typeof item.data !== 'string') throw new Error('备份包含无效的照片资产。')
        byId.set(item.metadata.id, base64ToBytes(item.data))
      }
      assetPayloads = []
      for (const item of metadata) {
        const bytes = byId.get(item.id)
        if (!bytes) throw new Error(`备份缺少照片资产 ${item.id}。`)
        if (bytes.byteLength !== item.sizeBytes || await sha256(bytes) !== item.sha256) throw new Error(`照片资产 ${item.id} 的完整性校验失败。`)
        assetPayloads.push({ metadata: item, bytes })
      }
      if (byId.size !== metadata.length) throw new Error('备份包含未登记的照片资产。')
    }
  } else {
    const legacy = migrateAppState(rawData)
    if (!legacy) throw new Error('无法识别的几度备份格式。')
    data = legacyToV4(legacy)
    assetPayloads = []
    for (const photo of legacy.photos) {
      const dataUrlBytes = decodeLegacyDataUrl(photo.dataUrl)
      const zipBytes = zipAssets?.get(photo.id)
      if (zipAssets && (!zipBytes || zipBytes.byteLength !== dataUrlBytes.byteLength || await sha256(zipBytes) !== await sha256(dataUrlBytes))) {
        throw new Error(`旧 ZIP 中照片“${photo.name}”与状态数据不一致。`)
      }
      assetPayloads.push({ metadata: await metadataForLegacy(photo, dataUrlBytes), bytes: zipBytes ?? dataUrlBytes })
    }
    if (zipAssets && zipAssets.size !== legacy.photos.length) throw new Error('旧 ZIP 包含未在状态中登记的照片资产。')
  }

  const availableAssetIds = new Set(assetPayloads.map((asset) => asset.metadata.id))
  for (const id of new Set(data.moments.flatMap((moment) => moment.photoIds))) {
    if (!availableAssetIds.has(id)) throw new Error(`备份状态引用了缺失的照片资产 ${id}。`)
  }

  const exportedAt = typeof manifest?.exportedAt === 'string' && !Number.isNaN(Date.parse(manifest.exportedAt)) ? manifest.exportedAt : new Date().toISOString()
  return {
    fileName,
    schemaVersion: 4,
    appVersion: typeof manifest?.appVersion === 'string' ? manifest.appVersion : 'legacy',
    exportedAt,
    timezone: typeof manifest?.timezone === 'string' ? manifest.timezone : 'UTC',
    momentCount: data.moments.length,
    photoCount: assetPayloads.length,
    dailyEntryCount: data.dailyEntries.length,
    narrationCount: data.narrationUses.length,
    data,
    assets: assetPayloads,
  }
}

async function parseEncryptedPayload(envelope: EncryptedBackupEnvelope, fileName: string, password: string): Promise<BackupSummary> {
  assertPassword(password)
  if (!envelope.salt || !envelope.iv || !envelope.ciphertext) throw new Error('加密备份缺少必要字段。')
  try {
    const cryptoApi = getCrypto()
    const salt = base64ToBytes(envelope.salt)
    const iv = base64ToBytes(envelope.iv)
    const key = await deriveKey(password, salt, ['decrypt'])
    const plaintext = await cryptoApi.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: envelope.cipher?.tagLength ?? 128 }, key, base64ToBytes(envelope.ciphertext))
    const parsed = JSON.parse(textDecoder.decode(plaintext)) as unknown
    return await summarizeBackup(parsed, fileName)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('完整性校验') || error.message.includes('照片资产'))) throw error
    throw new Error('密码错误或加密备份已损坏，未读取任何数据。')
  }
}

export async function parseEncryptedBackup(file: File, password: string): Promise<BackupSummary> {
  let parsed: unknown
  try { parsed = JSON.parse(await file.text()) as unknown } catch { throw new Error('加密备份文件不是有效的 JSON 容器。') }
  if (!isEncryptedEnvelope(parsed)) throw new Error('这不是几度的加密备份文件。')
  return parseEncryptedPayload(parsed, file.name, password)
}

export async function parseBackup(file: File, password = ''): Promise<BackupSummary> {
  if (file.name.toLowerCase().endsWith('.zip')) {
    const zip = await JSZip.loadAsync(file)
    const dataFile = zip.file('data.json')
    if (!dataFile) throw new Error('备份中缺少 data.json')
    const data = JSON.parse(await dataFile.async('text')) as unknown
    const manifestFile = zip.file('manifest.json')
    const manifest = manifestFile ? JSON.parse(await manifestFile.async('text')) as BackupManifest : undefined
    const zipAssets = new Map<string, Uint8Array>()
    const assetPrefix = 'assets/'
    for (const path of Object.keys(zip.files)) {
      if (!path.startsWith(assetPrefix) || zip.files[path].dir) continue
      const id = path.slice(assetPrefix.length)
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || id.includes('/')) throw new Error('ZIP 中含有无效的照片路径。')
      zipAssets.set(id, await zip.files[path].async('uint8array'))
    }
    return summarizeBackup({ data, manifest }, file.name, zipAssets)
  }

  let parsed: unknown
  try { parsed = JSON.parse(await file.text()) as unknown } catch { throw new Error('备份文件不是有效的 JSON。') }
  if (isEncryptedEnvelope(parsed)) return parseEncryptedPayload(parsed, file.name, password)
  return summarizeBackup(parsed, file.name)
}
