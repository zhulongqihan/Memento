export function pickPinned<T extends { id: string }>(items: T[], pinnedId?: string): T | undefined {
  return items.find((item) => item.id === pinnedId) ?? items[0]
}
