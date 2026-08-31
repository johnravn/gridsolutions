export function addCrewActionLabels(selectedCount: number): {
  add: string
  addAndInvite: string
} {
  if (selectedCount <= 1) {
    return {
      add: 'Add crew member',
      addAndInvite: 'Add and invite crew member',
    }
  }

  return {
    add: `Add ${selectedCount} crew members`,
    addAndInvite: `Add and invite ${selectedCount} crew members`,
  }
}

export function selectedUserIdsToInvite(
  selectedIds: Array<string>,
  currentUserId: string | null | undefined,
): Array<string> {
  return selectedIds.filter((id) => !!id && id !== currentUserId)
}
