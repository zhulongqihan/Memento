import type { AppState, ElapsedCounter, Moment, RemainingCounter, Stage } from '../domain/types'

function mergeByUpdatedAt<T extends { id: string; updatedAt: string }>(current: T[], incoming: T[]): T[] {
  const values = new Map(current.map((item) => [item.id, item]))
  incoming.forEach((item) => {
    const previous = values.get(item.id)
    if (!previous || item.updatedAt >= previous.updatedAt) values.set(item.id, item)
  })
  return [...values.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function mergeState(current: AppState, incoming: AppState): AppState {
  const moments = mergeByUpdatedAt<Moment>(current.moments, incoming.moments)
  const elapsed = mergeByUpdatedAt<ElapsedCounter>(current.elapsed, incoming.elapsed)
  const remaining = mergeByUpdatedAt<RemainingCounter>(current.remaining, incoming.remaining)
  const stages = mergeByUpdatedAt<Stage>(current.stages, incoming.stages)
  const photos = [...new Map([...current.photos, ...incoming.photos].map((photo) => [photo.id, photo])).values()]
  return { ...current, moments, elapsed, remaining, stages, photos }
}

