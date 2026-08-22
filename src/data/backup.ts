import JSZip from 'jszip'
import type { AppState, BackupSummary } from '../domain/types'
import { migrateAppState } from './migration'

const APP_VERSION = '2.5.0'
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
  integritySha256?: string
}

interface BackupPayload {
  manifest: BackupManifest
  data: AppState
}

interface EncryptedBackupEnvelope {
  format: typeof ENCRYPTED_BACKUP_FORMAT
  version: 1
  kdf: {
    name: 'PBKDF2'
    hash: 'SHA-256'
    iterations: number
  }
  cipher: {
    name: 'AES-GCM'
    tagLength: 128
  }
  salt: string
  iv: string
  ciphertext: string
}

function getCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) throw new Error('当前环境不支持安全加密，请更新应用后重试。')
  return globalThis.crypto
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
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

async function sha256(value: string): Promise<string> {
  const digest = await getCrypto().subtle.digest('SHA-256', textEncoder.encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function buildPayload(state: AppState): Promise<BackupPayload> {
  const data = state
  return {
    manifest: {
      schemaVersion: state.schemaVersion,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      momentCount: state.moments.length,
      photoCount: state.photos.length,
      integritySha256: await sha256(JSON.stringify(data)),
    },
    data,
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
  const payload = await buildPayload(state)
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  download(blob, `memento-backup-${new Date().toISOString().slice(0, 10)}.json`)
}

export async function exportZip(state: AppState): Promise<void> {
  const payload = await buildPayload(state)
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

export async function createEncryptedBackupBlob(state: AppState, password: string): Promise<Blob> {
  assertPassword(password)
  const cryptoApi = getCrypto()
  const salt = cryptoApi.getRandomValues(new Uint8Array(16))
  const iv = cryptoApi.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, ['encrypt'])
  const payload = await buildPayload(state)
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

export async function exportEncryptedBackup(state: AppState, password: string): Promise<void> {
  const blob = await createEncryptedBackupBlob(state, password)
  download(blob, `memento-encrypted-${new Date().toISOString().slice(0, 10)}.memento`)
}

function isEncryptedEnvelope(value: unknown): value is EncryptedBackupEnvelope {
  return isRecord(value) && value.format === ENCRYPTED_BACKUP_FORMAT && value.version === 1
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
    if (error instanceof Error && error.message.includes('完整性校验')) throw error
    throw new Error('密码错误或加密备份已损坏，未读取任何数据。')
  }
}

export async function parseEncryptedBackup(file: File, password: string): Promise<BackupSummary> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text()) as unknown
  } catch {
    throw new Error('加密备份文件不是有效的 JSON 容器。')
  }
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
    return summarizeBackup({ data, manifest }, file.name)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text()) as unknown
  } catch {
    throw new Error('备份文件不是有效的 JSON。')
  }
  if (isEncryptedEnvelope(parsed)) return parseEncryptedPayload(parsed, file.name, password)
  return summarizeBackup(parsed, file.name)
}

async function summarizeBackup(parsed: unknown, fileName: string): Promise<BackupSummary> {
  const payload = isRecord(parsed) && 'data' in parsed
    ? { data: parsed.data as AppState, manifest: parsed.manifest as BackupManifest | undefined }
    : { data: parsed as AppState, manifest: undefined }
  const migrated = await validateBackup(payload.data, payload.manifest)
  const manifest = payload.manifest ?? (await buildPayload(migrated)).manifest
  return { ...manifest, schemaVersion: migrated.schemaVersion, fileName, data: migrated }
}

async function validateBackup(data: AppState, manifest?: BackupManifest): Promise<AppState> {
  if (manifest?.integritySha256) {
    const actual = await sha256(JSON.stringify(data))
    if (actual !== manifest.integritySha256) throw new Error('备份完整性校验失败，文件可能被修改。')
  }
  const migrated = migrateAppState(data)
  if (!migrated) throw new Error('无法识别的几度备份格式')
  return migrated
}
