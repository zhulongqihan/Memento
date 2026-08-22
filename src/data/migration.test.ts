import { describe, expect, it } from 'vitest'
import { migrateAppState } from './migration'

describe('数据 schema 迁移', () => {
  it('把 v1 数据升级到 v2 并补齐新设置', () => {
    const migrated = migrateAppState({
      schemaVersion: 1,
      moments: [],
      elapsed: [],
      remaining: [],
      settings: { displayName: '旧时间册', displayLifeProgress: false },
    })
    expect(migrated?.schemaVersion).toBe(2)
    expect(migrated?.settings.displayName).toBe('旧时间册')
    expect(migrated?.settings.elapsedDisplayMode).toBe('days')
    expect(migrated?.stages).toEqual([])
  })

  it('拒绝缺少核心集合的未知数据', () => {
    expect(migrateAppState({ schemaVersion: 1, moments: [] })).toBeNull()
    expect(migrateAppState({ schemaVersion: 3, moments: [], elapsed: [], remaining: [] })).toBeNull()
  })
})
