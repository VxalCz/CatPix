import { useState, useCallback } from 'react'

/**
 * Reusable hook for inline rename/edit state.
 * Used by SpriteBank and LayerPanel for double-click-to-rename patterns.
 */
export function useEditableField(onCommit: (id: string, value: string) => void) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')

  const startEditing = useCallback((id: string, currentValue: string) => {
    setEditingId(id)
    setEditingValue(currentValue)
  }, [])

  const commitEditing = useCallback(() => {
    if (editingId && editingValue.trim()) {
      onCommit(editingId, editingValue.trim())
    }
    setEditingId(null)
  }, [editingId, editingValue, onCommit])

  const cancelEditing = useCallback(() => {
    setEditingId(null)
  }, [])

  return {
    editingId,
    editingValue,
    setEditingValue,
    startEditing,
    commitEditing,
    cancelEditing,
  }
}
