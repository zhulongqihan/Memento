import type { AppState, VisualNarrative } from './types'

export function pickPinned<T extends { id: string }>(items: T[], pinnedId?: string): T | undefined {
  return items.find((item) => item.id === pinnedId) ?? items[0]
}

export function normalizeVisualNarrative(value: unknown): VisualNarrative {
  return value === 'light' || value === 'instrument' ? value : 'archive'
}

export function updateVisualNarrative(state: AppState, visualNarrative: VisualNarrative): AppState {
  return { ...state, settings: { ...state.settings, visualNarrative } }
}
