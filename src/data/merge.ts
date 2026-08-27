import type { AppState, DailyEntry, ElapsedCounter, Moment, NarrationUse, RemainingCounter, Stage } from '../domain/types'

function mergeByUpdatedAt<T extends { id: string; updatedAt: string }>(current: T[], incoming: T[]): T[] {
  const values = new Map(current.map((item) => [item.id, item]))
  incoming.forEach((item) => {
    const previous = values.get(item.id)
    if (!previous || item.updatedAt >= previous.updatedAt) values.set(item.id, item)
  })
  return [...values.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function mergeDailyEntries(current: DailyEntry[], incoming: DailyEntry[]): DailyEntry[] {
  const values = new Map<string, DailyEntry>()
  for (const entry of [...current, ...incoming]) {
    const previous = values.get(entry.date)
    if (!previous || entry.updatedAt >= previous.updatedAt) values.set(entry.date, entry)
  }
  return [...values.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function mergeState(current: AppState, incoming: AppState): AppState {
  const moments = mergeByUpdatedAt<Moment>(current.moments, incoming.moments)
  const elapsed = mergeByUpdatedAt<ElapsedCounter>(current.elapsed, incoming.elapsed)
  const remaining = mergeByUpdatedAt<RemainingCounter>(current.remaining, incoming.remaining)
  const stages = mergeByUpdatedAt<Stage>(current.stages, incoming.stages)
  const photos = [...new Map([...current.photos, ...incoming.photos].map((photo) => [photo.id, photo])).values()]
  const dailyEntries = mergeDailyEntries(current.dailyEntries, incoming.dailyEntries)
  const narrationUses = [...new Map([...current.narrationUses, ...incoming.narrationUses].map((item) => [item.id, item])).values()].sort((a, b) => b.displayedAt.localeCompare(a.displayedAt))
  const savedNarrations = [...new Map([...current.savedNarrations, ...incoming.savedNarrations].map((item) => [item.quoteId, item])).values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt))
  return { ...current, moments, elapsed, remaining, stages, photos, dailyEntries, narrationUses, savedNarrations }
}
