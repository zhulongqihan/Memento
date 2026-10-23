import copyLibraryJson from '../data/copy-library.json'
import type { AppState, DailyEntry, LibraryCopy, NarrationUse } from './types'

export const COPY_LIBRARY = copyLibraryJson as LibraryCopy[]

export function getDailyEntry(state: AppState, date: string): DailyEntry | undefined {
  return state.dailyEntries.find((entry) => entry.date === date)
}

export function getTodayNarrationUse(state: AppState, date: string): NarrationUse | undefined {
  return [...state.narrationUses].filter((entry) => entry.date === date).sort((a, b) => b.displayedAt.localeCompare(a.displayedAt))[0]
}

export function getCopyById(quoteId: string): LibraryCopy | undefined {
  return COPY_LIBRARY.find((copy) => copy.id === quoteId)
}

export function chooseUnreadCopy(state: AppState, random = Math.random()): LibraryCopy | undefined {
  const used = new Set(state.narrationUses.map((entry) => entry.quoteId))
  const unreadAll = COPY_LIBRARY.filter((copy) => !used.has(copy.id))
  const featured = COPY_LIBRARY.slice(0, 30).filter((copy) => !used.has(copy.id))
  const unread = featured.length ? featured : unreadAll
  if (!unread.length) return undefined
  return unread[Math.min(unread.length - 1, Math.floor(Math.max(0, Math.min(0.999999, random)) * unread.length))]
}

export function getNarrationSnapshot(state: AppState, use: NarrationUse | undefined) {
  if (!use) return undefined
  const copy = getCopyById(use.quoteId)
  if (copy) return copy
  const saved = state.savedNarrations.find((item) => item.quoteId === use.quoteId)
  if (!saved) return undefined
  return {
    id: saved.quoteId,
    original: saved.original,
    translationZh: saved.translationZh,
    language: saved.translationZh ? 'unknown' : 'zh',
    author: saved.author,
    sourceName: '已保存的旁白快照',
    sourceUrl: saved.sourceUrl,
    license: 'public-domain' as const,
    licenseUrl: 'https://www.gutenberg.org/policy/license',
    tags: ['记忆'],
  }
}
