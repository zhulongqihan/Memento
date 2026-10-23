/** Displayable assets are only a projection: unreadable references survive edits. */
export function resolveMomentPhotoIds(
  originalIds: readonly string[],
  selectedPhotos: readonly { id: string }[],
  removedIds: readonly string[],
): string[] {
  const removed = new Set(removedIds)
  return [...new Set([...originalIds, ...selectedPhotos.map((photo) => photo.id)])]
    .filter((id) => !removed.has(id))
}
