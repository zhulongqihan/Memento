import { createEmptyState } from './seed'
import { migrateAppState, validatePersistedAppState } from './migration'
import { createAssetStore, type AssetStore } from './asset-store'
import { getSqliteDatabase } from './sqlite-database'
import type { AppState, AppStateV4, LegacyAppState, PhotoAssetView } from '../domain/types'

const STORAGE_KEY = 'memento:app-state:v4'
const LEGACY_STORAGE_KEYS = ['memento:app-state:v2', 'memento:app-state:v1'] as const
const RECOVERY_STORAGE_KEY = 'memento:recovery-snapshot:v4'
const LEGACY_RECOVERY_STORAGE_KEY = 'memento:recovery-snapshot:v2'
const MIGRATION_LOG_KEY = 'memento:asset-migration-log:v1'

export interface RecoverySnapshot {
  createdAt: string
  state: AppState
}

export type SaveResult =
  | { status: 'saved'; savedAt: string }
  | { status: 'recovering'; message: string }
  | { status: 'failed'; message: string }

export interface AppRepository {
  loadState(): Promise<AppState>
  saveState(state: AppState): Promise<SaveResult>
  hasRecoverySnapshot(): Promise<boolean>
  createRecoverySnapshot(state: AppState): Promise<void>
  restoreRecoverySnapshot(): Promise<AppState | null>
  clearRecoverySnapshot(): Promise<void>
}

export interface StateBackend {
  read(id: 'current' | 'recovery'): Promise<string | null>
  write(id: 'current' | 'recovery', payload: string): Promise<void>
  remove(id: 'current' | 'recovery'): Promise<void>
  writeMigrationLog?(id: string, sourceSchema: number, phase: string, status: string, details: Record<string, unknown>): Promise<void>
}

class BrowserStateBackend implements StateBackend {
  constructor(private readonly storage: Storage) {}

  async read(id: 'current' | 'recovery'): Promise<string | null> {
    return this.storage.getItem(id === 'current' ? STORAGE_KEY : RECOVERY_STORAGE_KEY)
  }

  async write(id: 'current' | 'recovery', payload: string): Promise<void> {
    this.storage.setItem(id === 'current' ? STORAGE_KEY : RECOVERY_STORAGE_KEY, payload)
  }

  async remove(id: 'current' | 'recovery'): Promise<void> {
    this.storage.removeItem(id === 'current' ? STORAGE_KEY : RECOVERY_STORAGE_KEY)
  }

  async writeMigrationLog(id: string, sourceSchema: number, phase: string, status: string, details: Record<string, unknown>): Promise<void> {
    const raw = this.storage.getItem(MIGRATION_LOG_KEY)
    const entries = raw ? JSON.parse(raw) as Array<Record<string, unknown>> : []
    const now = new Date().toISOString()
    const previous = entries.find((entry) => entry.id === id)
    const next = { id, operation: 'legacy_to_v4', status, phase, sourceSchema, createdAt: previous?.createdAt ?? now, updatedAt: now, details }
    this.storage.setItem(MIGRATION_LOG_KEY, JSON.stringify([...entries.filter((entry) => entry.id !== id), next]))
  }
}

class TauriStateBackend implements StateBackend {
  private writeQueue: Promise<void> = Promise.resolve()

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const next = this.writeQueue.then(operation)
    this.writeQueue = next.then(() => undefined, () => undefined)
    return next
  }

  async read(id: 'current' | 'recovery'): Promise<string | null> {
    const database = await getSqliteDatabase()
    const rows = await database.select<Array<{ payload: string }>>('SELECT payload FROM app_state WHERE id = $1', [id])
    return rows[0]?.payload ?? null
  }

  async write(id: 'current' | 'recovery', payload: string): Promise<void> {
    await this.enqueue(async () => {
      const database = await getSqliteDatabase()
      await database.execute(
        'INSERT INTO app_state (id, payload, updated_at) VALUES ($1, $2, $3) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at',
        [id, payload, new Date().toISOString()],
      )
    })
  }

  async remove(id: 'current' | 'recovery'): Promise<void> {
    await this.enqueue(async () => { await (await getSqliteDatabase()).execute('DELETE FROM app_state WHERE id = $1', [id]) })
  }

  async writeMigrationLog(id: string, sourceSchema: number, phase: string, status: string, details: Record<string, unknown>): Promise<void> {
    const now = new Date().toISOString()
    await this.enqueue(async () => {
      const database = await getSqliteDatabase()
      const previous = await database.select<Array<{ created_at: string }>>('SELECT created_at FROM asset_migration_log WHERE id = $1', [id])
      await database.execute(
        'INSERT INTO asset_migration_log (id, operation, status, phase, source_schema, created_at, updated_at, details_json) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT(id) DO UPDATE SET status = excluded.status, phase = excluded.phase, updated_at = excluded.updated_at, details_json = excluded.details_json',
        [id, 'legacy_to_v4', status, phase, sourceSchema, previous[0]?.created_at ?? now, now, JSON.stringify(details)],
      )
    })
  }
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
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

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function legacyPhotoFile(photo: LegacyAppState['photos'][number]): File {
  const match = /^data:([^;,]+)?;base64,([\s\S]*)$/.exec(photo.dataUrl)
  if (!match) throw new Error(`旧照片“${photo.name}”不是受支持的 base64 图片，原数据已保留。`)
  try {
    return new File([base64ToBytes(match[2])], photo.name, { type: photo.mimeType || match[1] || 'application/octet-stream' })
  } catch {
    throw new Error(`旧照片“${photo.name}”无法解码，原数据已保留。`)
  }
}

async function hashBlob(blob: Blob): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('当前环境无法校验照片完整性。')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function hashText(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const objectUrls = new Map<string, { sha256: string; url: string }>()

export function revokePhotoObjectUrl(assetId: string): void {
  const entry = objectUrls.get(assetId)
  if (!entry) return
  URL.revokeObjectURL(entry.url)
  objectUrls.delete(assetId)
}

export function disposePhotoObjectUrls(): void {
  for (const entry of objectUrls.values()) URL.revokeObjectURL(entry.url)
  objectUrls.clear()
}

export async function hydrateAppState(persisted: AppStateV4, assets = getAssetStore()): Promise<AppState> {
  const report = await assets.verify()
  const assetIssues = {
    missingAssetIds: [...report.missingAssetIds],
    corruptAssetIds: [...report.corruptAssetIds],
    orphanedAssetIds: [...report.orphanedAssetIds],
  }
  if (report.missingAssetIds.length || report.corruptAssetIds.length || report.orphanedAssetIds.length) {
    console.warn('照片资产检查发现需要处理的项目；未自动删除照片文件。', report)
  }
  const photos: PhotoAssetView[] = []
  const metadataList = await assets.list()
  const metadataIds = new Set(metadataList.map((item) => item.id))
  const referencedIds = new Set(persisted.moments.flatMap((moment) => moment.photoIds))
  for (const id of referencedIds) {
    if (!metadataIds.has(id) && !assetIssues.missingAssetIds.includes(id)) assetIssues.missingAssetIds.push(id)
  }
  for (const metadata of metadataList) {
    let blob: Blob | null
    try { blob = await assets.read(metadata.id) } catch (error) {
      console.warn(`无法读取照片资产 ${metadata.id}。`, error)
      if (!assetIssues.corruptAssetIds.includes(metadata.id)) assetIssues.corruptAssetIds.push(metadata.id)
      continue
    }
    if (!blob) {
      console.warn(`照片资产 ${metadata.id} 缺失；文件与索引均未删除。`)
      if (!assetIssues.missingAssetIds.includes(metadata.id)) assetIssues.missingAssetIds.push(metadata.id)
      continue
    }
    if (blob.size !== metadata.sizeBytes || await hashBlob(blob) !== metadata.sha256) {
      console.warn(`照片资产 ${metadata.id} 校验失败；文件与索引均未删除。`)
      if (!assetIssues.corruptAssetIds.includes(metadata.id)) assetIssues.corruptAssetIds.push(metadata.id)
      continue
    }
    let cached = objectUrls.get(metadata.id)
    if (cached && cached.sha256 !== metadata.sha256) {
      revokePhotoObjectUrl(metadata.id)
      cached = undefined
    }
    if (!cached) {
      cached = { sha256: metadata.sha256, url: URL.createObjectURL(blob) }
      objectUrls.set(metadata.id, cached)
    }
    photos.push({ ...metadata, src: cached.url })
  }
  const hasIssues = Object.values(assetIssues).some((ids) => ids.length > 0)
  return { ...persisted, photos, ...(hasIssues ? { assetIssues } : {}) }
}

class PersistentAppRepository implements AppRepository {
  private saveQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly backend: StateBackend,
    private readonly assets: AssetStore,
    private readonly mirror: Storage | null,
  ) {}

  private async mirrorWrite(id: 'current' | 'recovery', payload: string): Promise<void> {
    if (!this.mirror) return
    try { this.mirror.setItem(id === 'current' ? STORAGE_KEY : RECOVERY_STORAGE_KEY, payload) } catch (error) {
      if (!isTauriRuntime()) throw error
      console.warn('Unable to update the browser fallback mirror.', error)
    }
  }

  private async write(id: 'current' | 'recovery', payload: string): Promise<void> {
    await this.backend.write(id, payload)
    if (!(this.backend instanceof BrowserStateBackend)) await this.mirrorWrite(id, payload)
  }

  private async recoveryAssetIds(): Promise<Set<string> | null> {
    try {
      let raw = await this.backend.read('recovery')
      if (raw === null) raw = this.mirror?.getItem(RECOVERY_STORAGE_KEY) ?? this.mirror?.getItem(LEGACY_RECOVERY_STORAGE_KEY) ?? null
      if (!raw) return new Set()
      const parsed = JSON.parse(raw) as { assetIds?: unknown; state?: unknown }
      const ids = new Set(Array.isArray(parsed.assetIds) && parsed.assetIds.every((id) => typeof id === 'string') ? parsed.assetIds as string[] : [])
      const v4 = validatePersistedAppState(parsed.state)
      if (v4) {
        v4.moments.flatMap((moment) => moment.photoIds).forEach((id) => ids.add(id))
        return ids
      }
      const legacy = migrateAppState(parsed.state)
      legacy?.photos.map((photo) => photo.id).forEach((id) => ids.add(id))
      return legacy || ids.size > 0 ? ids : null
    } catch {
      return null
    }
  }

  private async readCurrent(): Promise<{ raw: string | null; source: 'backend' | 'mirror' | 'legacy' }> {
    const raw = await this.backend.read('current')
    if (raw !== null) return { raw, source: 'backend' }
    const mirrorRaw = this.mirror?.getItem(STORAGE_KEY) ?? null
    if (mirrorRaw !== null) return { raw: mirrorRaw, source: 'mirror' }
    for (const key of LEGACY_STORAGE_KEYS) {
      const legacy = this.mirror?.getItem(key)
      if (legacy !== null && legacy !== undefined) return { raw: legacy, source: 'legacy' }
    }
    return { raw: null, source: 'backend' }
  }

  private async recordMigration(id: string, sourceSchema: number, phase: string, status: string, details: Record<string, unknown>): Promise<void> {
    try { await this.backend.writeMigrationLog?.(id, sourceSchema, phase, status, details) } catch (error) {
      console.warn('Unable to update photo migration journal.', error)
    }
  }

  private async migrateLegacy(raw: string, legacy: LegacyAppState, sourceSchema: number): Promise<AppState> {
    const migrationId = `legacy-v${sourceSchema}-${(await hashText(raw)).slice(0, 20)}`
    const assetIds: string[] = []
    let phase = 'staging_assets'
    let migratedState: AppStateV4 | null = null
    const declaredIds = new Set<string>()
    for (const photo of legacy.photos) {
      if (declaredIds.has(photo.id)) throw new Error(`旧状态重复登记了照片 ${photo.id}；原状态已保留。`)
      declaredIds.add(photo.id)
    }
    for (const id of new Set(legacy.moments.flatMap((moment) => moment.photoIds))) {
      if (!declaredIds.has(id)) throw new Error(`旧状态引用了缺失照片 ${id}；原状态已保留。`)
    }
    await this.recordMigration(migrationId, sourceSchema, 'staging_assets', 'in_progress', { assetIds })
    try {
      for (const photo of legacy.photos) {
        await this.assets.put(legacyPhotoFile(photo), photo.id)
        assetIds.push(photo.id)
        await this.recordMigration(migrationId, sourceSchema, phase, 'in_progress', { assetIds: [...assetIds] })
      }

      phase = 'validating_assets'
      await this.recordMigration(migrationId, sourceSchema, phase, 'in_progress', { assetIds: [...assetIds] })
      const stagedMetadata = new Map((await this.assets.list()).map((item) => [item.id, item]))
      for (const photo of legacy.photos) {
        const metadata = stagedMetadata.get(photo.id)
        if (!metadata) throw new Error(`照片“${photo.name}”的元数据缺失，旧状态尚未升级。`)
        const blob = await this.assets.read(photo.id)
        if (!blob || blob.size !== metadata.sizeBytes || await hashBlob(blob) !== metadata.sha256) {
          throw new Error(`照片“${photo.name}”的文件校验失败，旧状态尚未升级。`)
        }
      }

      migratedState = {
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
      phase = 'committing_recovery_snapshot'
      await this.recordMigration(migrationId, sourceSchema, phase, 'in_progress', { assetIds: [...assetIds] })
      await this.createRecoverySnapshot(await this.hydrate(migratedState))
      phase = 'committing_state'
      await this.recordMigration(migrationId, sourceSchema, phase, 'in_progress', { assetIds: [...assetIds] })
      await this.write('current', JSON.stringify(migratedState))
      await this.recordMigration(migrationId, sourceSchema, 'completed', 'committed', { assetIds: [...assetIds] })
      for (const key of LEGACY_STORAGE_KEYS) {
        try { this.mirror?.removeItem(key) } catch { /* Successful v4 state and verified assets remain authoritative. */ }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '照片迁移失败。'
      await this.recordMigration(migrationId, sourceSchema, phase, 'failed', { assetIds: [...assetIds], error: message })
      throw new Error(`${message}旧时间册仍然保留；修复存储空间后可以重试。`)
    }
    if (!migratedState) throw new Error('迁移没有生成有效的 v4 状态；旧时间册仍然保留。')
    return this.hydrate(migratedState)
  }

  private async hydrate(persisted: AppStateV4): Promise<AppState> {
    return hydrateAppState(persisted, this.assets)
  }

  async loadState(): Promise<AppState> {
    const { raw } = await this.readCurrent()
    if (!raw) return createEmptyState()
    let value: unknown
    try { value = JSON.parse(raw) as unknown } catch { throw new Error('本地状态文件无法解析；原始文件已保留。') }

    const persisted = validatePersistedAppState(value)
    if (persisted) return this.hydrate(persisted)
    const legacy = migrateAppState(value)
    if (legacy) return this.migrateLegacy(raw, legacy, (value as { schemaVersion: number }).schemaVersion)
    throw new Error('本地状态格式无法识别；原始文件已保留，未进行覆盖。')
  }

  async saveState(state: AppState): Promise<SaveResult> {
    try {
      const persisted = toPersistedState(state)
      if (!validatePersistedAppState(persisted)) return { status: 'failed', message: '当前状态不符合 v4 数据格式，未保存。' }
      let cleanupPending = false
      const next = this.saveQueue.then(async () => {
        const currentRaw = await this.backend.read('current')
        let previous: AppStateV4 | null = null
        if (currentRaw) {
          try { previous = validatePersistedAppState(JSON.parse(currentRaw) as unknown) } catch { previous = null }
        }
        await this.write('current', JSON.stringify(persisted))
        const currentIds = new Set(persisted.moments.flatMap((moment) => moment.photoIds))
        const previousIds = new Set(previous?.moments.flatMap((moment) => moment.photoIds) ?? [])
        const recoveryIds = await this.recoveryAssetIds()
        const removedIds = [...previousIds].filter((id) => !currentIds.has(id) && recoveryIds && !recoveryIds.has(id))
        let assetReport: Awaited<ReturnType<AssetStore['verify']>> | null = null
        let knownAssetIds = new Set<string>()
        if (removedIds.length > 0) {
          try {
            assetReport = await this.assets.verify()
            knownAssetIds = new Set((await this.assets.list()).map((asset) => asset.id))
          } catch (error) {
            console.warn('照片资产检查失败；相关资产不会自动清理。', error)
            cleanupPending = true
          }
        }
        for (const id of previousIds) {
          if (!currentIds.has(id) && recoveryIds && !recoveryIds.has(id)) {
            const unsafeIds = assetReport
              ? new Set([...assetReport.missingAssetIds, ...assetReport.corruptAssetIds])
              : null
            if (!assetReport || !knownAssetIds.has(id) || unsafeIds?.has(id)) {
              cleanupPending = true
              continue
            }
            try {
              await this.assets.remove(id)
              revokePhotoObjectUrl(id)
            } catch (error) {
              console.warn(`照片资产 ${id} 尚未清理；当前状态已经保存。`, error)
              cleanupPending = true
            }
          }
        }
      })
      this.saveQueue = next.then(() => undefined, () => undefined)
      await next
      if (cleanupPending) return { status: 'recovering', message: '记录已经保存，但有照片资产无法安全清理；相关索引或文件已保留以便恢复。' }
      return { status: 'saved', savedAt: new Date().toISOString() }
    } catch (error) {
      return { status: 'failed', message: error instanceof Error ? error.message : '保存失败。' }
    }
  }

  async createRecoverySnapshot(state: AppState): Promise<void> {
    const persisted = toPersistedState(state)
    await this.verifyRequiredAssets(persisted)
    const snapshot = {
      version: 4,
      createdAt: new Date().toISOString(),
      assetIds: [...new Set(persisted.moments.flatMap((moment) => moment.photoIds))],
      state: persisted,
    }
    await this.write('recovery', JSON.stringify(snapshot))
  }

  async restoreRecoverySnapshot(): Promise<AppState | null> {
    let raw = await this.backend.read('recovery')
    if (raw === null) raw = this.mirror?.getItem(RECOVERY_STORAGE_KEY) ?? this.mirror?.getItem(LEGACY_RECOVERY_STORAGE_KEY) ?? null
    if (!raw) return null
    let parsed: unknown
    try { parsed = JSON.parse(raw) as unknown } catch { throw new Error('恢复快照无法解析；快照文件已保留。') }
    if (!parsed || typeof parsed !== 'object' || !('state' in parsed)) throw new Error('恢复快照格式无法识别；快照文件已保留。')
    const snapshot = parsed as { createdAt?: unknown; state: unknown }
    const persisted = validatePersistedAppState(snapshot.state)
    if (persisted) {
      await this.verifyRequiredAssets(persisted)
      return this.hydrate(persisted)
    }
    const legacy = migrateAppState(snapshot.state)
    if (legacy) {
      const migrated = await this.migrateLegacySnapshot(legacy)
      await this.verifyRequiredAssets(migrated)
      return this.hydrate(migrated)
    }
    throw new Error('恢复快照中的状态无法识别；快照文件已保留。')
  }

  async hasRecoverySnapshot(): Promise<boolean> {
    try {
      const raw = await this.backend.read('recovery')
      if (raw !== null) return true
    } catch (error) {
      console.warn('恢复快照索引暂时无法读取。', error)
    }
    return Boolean(this.mirror?.getItem(RECOVERY_STORAGE_KEY) ?? this.mirror?.getItem(LEGACY_RECOVERY_STORAGE_KEY))
  }

  private async verifyRequiredAssets(state: AppStateV4): Promise<void> {
    const requiredIds = new Set(state.moments.flatMap((moment) => moment.photoIds))
    if (requiredIds.size === 0) return
    const metadata = new Map((await this.assets.list()).map((asset) => [asset.id, asset]))
    for (const id of requiredIds) {
      const asset = metadata.get(id)
      const blob = await this.assets.read(id)
      if (!asset || !blob || blob.size !== asset.sizeBytes || await hashBlob(blob) !== asset.sha256) {
        throw new Error(`恢复快照引用的照片 ${id} 缺失或损坏；当前时间册未更改，快照仍保留。`)
      }
    }
  }

  async clearRecoverySnapshot(): Promise<void> {
    let raw = await this.backend.read('recovery')
    if (raw === null) raw = this.mirror?.getItem(RECOVERY_STORAGE_KEY) ?? this.mirror?.getItem(LEGACY_RECOVERY_STORAGE_KEY) ?? null
    const recoveryIds = raw ? this.recoveryAssetIds() : Promise.resolve(new Set<string>())
    const ids = await recoveryIds
    const currentRaw = await this.backend.read('current')
    let currentIds: Set<string> | null = null
    if (currentRaw) {
      try {
        const current = validatePersistedAppState(JSON.parse(currentRaw) as unknown)
        if (current) currentIds = new Set(current.moments.flatMap((moment) => moment.photoIds))
      } catch { currentIds = null }
    }
    await this.backend.remove('recovery')
    if (this.mirror) {
      this.mirror.removeItem(RECOVERY_STORAGE_KEY)
      this.mirror.removeItem(LEGACY_RECOVERY_STORAGE_KEY)
    }
    if (!currentIds) return
    for (const id of ids ?? []) {
      if (currentIds.has(id)) continue
      try {
        await this.assets.remove(id)
        revokePhotoObjectUrl(id)
      } catch (error) {
        console.warn(`清除恢复快照后，照片资产 ${id} 仍需清理。`, error)
      }
    }
  }

  private async migrateLegacySnapshot(legacy: LegacyAppState): Promise<AppStateV4> {
    for (const photo of legacy.photos) {
      const metadata = await this.assets.put(legacyPhotoFile(photo), photo.id)
      const blob = await this.assets.read(photo.id)
      if (!blob || await hashBlob(blob) !== metadata.sha256) throw new Error(`恢复照片“${photo.name}”校验失败。`)
    }
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
}

let repository: AppRepository | null = null
let assetStore: AssetStore | null = null

export function getAssetStore(): AssetStore {
  if (!assetStore) assetStore = createAssetStore()
  return assetStore
}

export function createAppRepository(storage: Storage, assets: AssetStore): AppRepository {
  return new PersistentAppRepository(new BrowserStateBackend(storage), assets, storage)
}

export function createAppRepositoryWithBackend(backend: StateBackend, assets: AssetStore, mirror: Storage | null = null): AppRepository {
  return new PersistentAppRepository(backend, assets, mirror)
}

export function getAppRepository(): AppRepository {
  if (repository) return repository
  const assets = getAssetStore()
  repository = isTauriRuntime()
    ? new PersistentAppRepository(new TauriStateBackend(), assets, typeof localStorage === 'undefined' ? null : localStorage)
    : new PersistentAppRepository(new BrowserStateBackend(localStorage), assets, localStorage)
  return repository
}

export async function loadState(): Promise<AppState> {
  return getAppRepository().loadState()
}

export async function saveState(state: AppState): Promise<SaveResult> {
  return getAppRepository().saveState(state)
}

export async function saveRecoverySnapshot(state: AppState): Promise<void> {
  return getAppRepository().createRecoverySnapshot(state)
}

export async function loadRecoverySnapshot(): Promise<RecoverySnapshot | null> {
  const state = await getAppRepository().restoreRecoverySnapshot()
  return state ? { createdAt: new Date().toISOString(), state } : null
}

export async function hasRecoverySnapshot(): Promise<boolean> {
  return getAppRepository().hasRecoverySnapshot()
}

export async function clearRecoverySnapshot(): Promise<void> {
  await getAppRepository().clearRecoverySnapshot()
}
