import type { AssetStore } from './asset-store'
import type { AppState, BackupSummary, PhotoAssetMetadata } from '../domain/types'
import { hydrateAppState, revokePhotoObjectUrl } from './repository'
import type { SaveResult } from './repository'

export interface StagedBackupImport {
  state: AppState
  commit(): void
  rollback(): Promise<void>
}

async function sha256(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('当前环境无法校验照片完整性。')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function newAssetId(): string {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `photo_${suffix}`
}

function makeFile(bytes: Uint8Array, metadata: PhotoAssetMetadata): File {
  return new File([bytes], metadata.name, { type: metadata.mimeType })
}

async function uniqueAssetId(assets: AssetStore, reservedIds: Set<string>): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const id = newAssetId()
    if (reservedIds.has(id)) continue
    try {
      if (await assets.read(id)) continue
    } catch {
      continue
    }
    reservedIds.add(id)
    return id
  }
  throw new Error('无法为冲突照片分配安全编号。')
}

async function removeAddedAssets(assets: AssetStore, ids: string[]): Promise<void> {
  const failures: string[] = []
  for (const id of [...ids].reverse()) {
    try {
      await assets.remove(id)
      revokePhotoObjectUrl(id)
    } catch (error) {
      failures.push(`${id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (failures.length) throw new Error(`以下暂存照片未能回滚：${failures.join('；')}`)
}

/** Validate and stage all assets. Call commit after state persistence or rollback on failure. */
export async function stageBackupImport(summary: BackupSummary, assets: AssetStore): Promise<StagedBackupImport> {
  const incomingIds = new Set<string>()
  for (const asset of summary.assets) {
    if (incomingIds.has(asset.metadata.id)) throw new Error(`备份重复登记了照片资产 ${asset.metadata.id}。`)
    incomingIds.add(asset.metadata.id)
    if (asset.bytes.byteLength !== asset.metadata.sizeBytes || await sha256(asset.bytes) !== asset.metadata.sha256) {
      throw new Error(`照片资产“${asset.metadata.name}”校验失败，当前时间册没有更改。`)
    }
  }

  const referencedIds = new Set(summary.data.moments.flatMap((moment) => moment.photoIds))
  for (const id of referencedIds) {
    if (!incomingIds.has(id)) throw new Error(`备份状态引用了缺失的照片资产 ${id}。`)
  }

  const currentMetadata = new Map((await assets.list()).map((metadata) => [metadata.id, metadata]))
  const reservedIds = new Set([...incomingIds, ...currentMetadata.keys()])
  const remappedIds = new Map<string, string>()
  const addedAssetIds: string[] = []
  try {
    for (const asset of summary.assets) {
      const bytes = asset.bytes
      const hash = asset.metadata.sha256
      const existingMetadata = currentMetadata.get(asset.metadata.id)
      const existingBlob = await assets.read(asset.metadata.id)
      const sameAsset = Boolean(existingMetadata && existingBlob
        && existingMetadata.sha256 === hash
        && existingMetadata.sizeBytes === bytes.byteLength
        && existingBlob.size === bytes.byteLength
        && await sha256(new Uint8Array(await existingBlob.arrayBuffer())) === hash)

      const hasExistingData = Boolean(existingMetadata || existingBlob)
      const id = sameAsset
        ? asset.metadata.id
        : hasExistingData
          ? await uniqueAssetId(assets, reservedIds)
          : asset.metadata.id
      remappedIds.set(asset.metadata.id, id)

      if (!sameAsset) {
        const result = await assets.putWithStatus(makeFile(bytes, { ...asset.metadata, id }), id)
        if (result.created) addedAssetIds.push(id)
        const metadata = result.metadata
        if (metadata.id !== id) throw new Error(`照片资产“${asset.metadata.name}”返回了不匹配的编号。`)
        const stored = await assets.read(id)
        if (!stored || stored.size !== bytes.byteLength || await sha256(new Uint8Array(await stored.arrayBuffer())) !== hash) {
          throw new Error(`照片资产“${asset.metadata.name}”写入后校验失败，当前时间册没有更改。`)
        }
        currentMetadata.set(id, { ...asset.metadata, id })
      }
    }

    const persisted = {
      ...summary.data,
      moments: summary.data.moments.map((moment) => ({
        ...moment,
        photoIds: moment.photoIds.map((id) => remappedIds.get(id) ?? id),
      })),
    }
    const state = await hydrateAppState(persisted, assets)
    let committed = false
    let rolledBack = false
    return {
      state,
      commit() { committed = true },
      async rollback() {
        if (committed || rolledBack) return
        await removeAddedAssets(assets, addedAssetIds)
        rolledBack = true
      },
    }
  } catch (error) {
    try {
      await removeAddedAssets(assets, addedAssetIds)
    } catch (rollbackError) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`${message} ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`)
    }
    throw error
  }
}

/** Persist an imported state and keep staged assets only when persistence succeeds. */
export async function commitStagedBackupImport(
  staged: StagedBackupImport,
  save: () => Promise<SaveResult>,
): Promise<SaveResult> {
  try {
    const result = await save()
    if (result.status === 'failed') throw new Error(result.message)
    staged.commit()
    return result
  } catch (error) {
    try {
      await staged.rollback()
    } catch (rollbackError) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`${message} ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`)
    }
    throw error
  }
}
