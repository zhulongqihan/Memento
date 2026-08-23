import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyState } from './seed'
import { loadState, saveState } from './repository'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe('本地状态持久化', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('保存并重新加载视觉叙事偏好，同时保留现有数据语义', async () => {
    vi.stubGlobal('localStorage', new MemoryStorage())
    const state = createEmptyState()
    state.settings.visualNarrative = 'instrument'

    await saveState(state)
    const loaded = await loadState()

    expect(loaded.settings.visualNarrative).toBe('instrument')
    expect(loaded.moments).toEqual(state.moments)
    expect(loaded.photos).toEqual(state.photos)
    expect(loaded.settings.theme).toBe(state.settings.theme)
  })
})
