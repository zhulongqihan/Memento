import { describe, expect, it } from 'vitest'
import { migrateAppState } from './migration'
import { createSeedState } from './seed'

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
    expect(migrated?.settings.visualNarrative).toBe('archive')
    expect(migrated?.stages).toEqual([])
  })

  it('拒绝缺少核心集合的未知数据', () => {
    expect(migrateAppState({ schemaVersion: 1, moments: [] })).toBeNull()
    expect(migrateAppState({ schemaVersion: 3, moments: [], elapsed: [], remaining: [] })).toBeNull()
  })

  it('拒绝记录中的无效日期和不完整字段', () => {
    const state = createSeedState()
    state.moments[0] = { ...state.moments[0], date: '2026-02-30' }
    expect(migrateAppState(state)).toBeNull()

    const elapsed = createSeedState()
    elapsed.elapsed[0] = { ...elapsed.elapsed[0], updatedAt: '' }
    expect(migrateAppState(elapsed)).toBeNull()
  })

  it('归一化超出范围的生活设置和未知显示偏好', () => {
    const state = createSeedState()
    state.settings = { ...state.settings, lifeExpectancyYears: 999, theme: 'unknown' as never, numberFormat: 'unknown' as never }
    const migrated = migrateAppState(state)

    expect(migrated?.settings.lifeExpectancyYears).toBe(150)
    expect(migrated?.settings.theme).toBe('light')
    expect(migrated?.settings.numberFormat).toBe('plain')
  })

  it('未知视觉叙事安全回退到典藏，并保留已知值', () => {
    const unknown = createSeedState()
    unknown.settings = { ...unknown.settings, visualNarrative: 'future' as never }
    expect(migrateAppState(unknown)?.settings.visualNarrative).toBe('archive')

    const instrument = createSeedState()
    instrument.settings = { ...instrument.settings, visualNarrative: 'instrument' }
    expect(migrateAppState(instrument)?.settings.visualNarrative).toBe('instrument')
  })
})
