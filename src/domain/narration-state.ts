import type { AppState, DailyEntry, NarrationUse } from './types'

export function getDailyEntry(state: AppState, date: string): DailyEntry | undefined {
  return state.dailyEntries.find((entry) => entry.date === date)
}

export function getTodayNarrationUse(state: AppState, date: string): NarrationUse | undefined {
  return [...state.narrationUses].filter((entry) => entry.date === date).sort((a, b) => b.displayedAt.localeCompare(a.displayedAt))[0]
}
