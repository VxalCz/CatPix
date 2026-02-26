import type { AppState, AppAction } from './appReducer'
import { appReducer, UNDOABLE_ACTIONS } from './appReducer'

const MAX_HISTORY = 50

/** Lightweight snapshot — only the data that actually matters for undo. */
export interface PartialSnapshot {
  tileData: ImageData | null
  layers: AppState['layers']
  sprites: AppState['sprites']
  activeLayerId: string | null
  editingBankIndex: number | null
}

export interface UndoState {
  past: PartialSnapshot[]
  present: AppState
  future: PartialSnapshot[]
}

export type UndoAction =
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | AppAction

export function createUndoState(initial: AppState): UndoState {
  return { past: [], present: initial, future: [] }
}

function takeSnapshot(state: AppState): PartialSnapshot {
  return {
    tileData: state.tileData,
    layers: state.layers,
    sprites: state.sprites,
    activeLayerId: state.activeLayerId,
    editingBankIndex: state.editingBankIndex,
  }
}

function applySnapshot(state: AppState, snap: PartialSnapshot): AppState {
  return {
    ...state,
    tileData: snap.tileData,
    layers: snap.layers,
    sprites: snap.sprites,
    activeLayerId: snap.activeLayerId,
    editingBankIndex: snap.editingBankIndex,
  }
}

export function undoReducer(state: UndoState, action: UndoAction): UndoState {
  if (action.type === 'UNDO') {
    if (state.past.length === 0) return state
    const previousSnap = state.past[state.past.length - 1]
    return {
      past: state.past.slice(0, -1),
      present: applySnapshot(state.present, previousSnap),
      future: [takeSnapshot(state.present), ...state.future],
    }
  }

  if (action.type === 'REDO') {
    if (state.future.length === 0) return state
    const nextSnap = state.future[0]
    return {
      past: [...state.past, takeSnapshot(state.present)],
      present: applySnapshot(state.present, nextSnap),
      future: state.future.slice(1),
    }
  }

  const newPresent = appReducer(state.present, action)
  if (newPresent === state.present) return state

  // Only snapshot for undoable actions
  if (UNDOABLE_ACTIONS.has(action.type)) {
    const newPast = [...state.past, takeSnapshot(state.present)]
    if (newPast.length > MAX_HISTORY) {
      newPast.shift()
    }
    return {
      past: newPast,
      present: newPresent,
      future: [],
    }
  }

  // Non-undoable actions update present without affecting history
  return { ...state, present: newPresent }
}
