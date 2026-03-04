import type { SpriteEntry } from '../App'
import type { Layer, LayerBlendMode } from './layers'
import { createLayerFromImageData, createLayer } from './layers'

export type Tool = 'draw' | 'erase' | 'fill' | 'eyedropper' | 'line' | 'rectangle' | 'ellipse' | 'selection' | 'replace' | 'text'

export type BrushShape = 'square' | 'circle' | 'dither' | 'custom'

export type SelectionMode = 'box' | 'magic'

export interface AppState {
  image: HTMLImageElement | null
  gridSize: number
  tileCountX: number
  tileCountY: number
  selectedTile: { col: number; row: number } | null
  tileData: ImageData | null
  activeTool: Tool
  activeColor: string
  colorHistory: string[]
  snapToPalette: boolean
  brushSize: number
  brushShape: BrushShape
  customBrush: boolean[][] | null
  selectionMode: SelectionMode
  magicTolerance: number
  sprites: SpriteEntry[]
  editingBankIndex: number | null
  showExportModal: boolean
  showNewProjectModal: boolean
  showAIImportModal: boolean
  showResizeModal: boolean
  // Layers
  layers: Layer[]
  activeLayerId: string | null
}

export const initialState: AppState = {
  image: null,
  gridSize: 32,
  tileCountX: 1,
  tileCountY: 1,
  selectedTile: null,
  tileData: null,
  activeTool: 'draw',
  activeColor: '#000000',
  colorHistory: [],
  snapToPalette: false,
  brushSize: 1,
  brushShape: 'square',
  customBrush: null,
  selectionMode: 'box',
  magicTolerance: 32,
  sprites: [],
  editingBankIndex: null,
  showExportModal: false,
  showNewProjectModal: false,
  showAIImportModal: false,
  showResizeModal: false,
  layers: [],
  activeLayerId: null,
}

export type AppAction =
  | { type: 'SET_IMAGE'; image: HTMLImageElement | null }
  | { type: 'SET_GRID_SIZE'; gridSize: number }
  | { type: 'SET_TILE_COUNT_X'; count: number }
  | { type: 'SET_TILE_COUNT_Y'; count: number }
  | { type: 'SET_SELECTED_TILE'; tile: { col: number; row: number } | null }
  | { type: 'SET_TILE_DATA'; tileData: ImageData | null }
  | { type: 'SET_ACTIVE_TOOL'; tool: Tool }
  | { type: 'SET_ACTIVE_COLOR'; color: string }
  | { type: 'SET_BRUSH_SIZE'; size: number }
  | { type: 'SET_BRUSH_SHAPE'; shape: BrushShape }
  | { type: 'SET_SELECTION_MODE'; mode: SelectionMode }
  | { type: 'SET_MAGIC_TOLERANCE'; tolerance: number }
  | { type: 'SET_SPRITES'; sprites: SpriteEntry[] }
  | { type: 'SET_EDITING_BANK_INDEX'; index: number | null }
  | { type: 'SET_SHOW_EXPORT_MODAL'; show: boolean }
  | { type: 'SET_SHOW_NEW_PROJECT_MODAL'; show: boolean }
  | { type: 'SET_SHOW_AI_IMPORT_MODAL'; show: boolean }
  | { type: 'SET_SHOW_RESIZE_MODAL'; show: boolean }
  | { type: 'SET_SNAP_TO_PALETTE'; enabled: boolean }
  | { type: 'SET_CUSTOM_BRUSH'; brush: boolean[][] | null }
  | { type: 'RESIZE_CANVAS'; width: number; height: number; anchorX: number; anchorY: number }
  | { type: 'SET_SPRITE_DELAY'; id: string; delay: number | undefined }
  | { type: 'LOAD_IMAGE'; image: HTMLImageElement }
  | { type: 'NEW_PROJECT'; tileSize: number; blankData: ImageData }
  | { type: 'SELECT_TILE'; col: number; row: number; tileData: ImageData }
  | { type: 'CLEAR_TILE' }
  | { type: 'SAVE_TO_BANK'; entry: SpriteEntry }
  | { type: 'UPDATE_IN_BANK'; imageData: ImageData }
  | { type: 'REMOVE_SPRITE'; id: string }
  | { type: 'DUPLICATE_SPRITE'; id: string; clone: SpriteEntry }
  | { type: 'SELECT_BANK_SPRITE'; index: number; clonedData: ImageData }
  | { type: 'AI_LOAD_AS_TILESET'; gridSize: number }
  | { type: 'AI_IMPORT'; entries: SpriteEntry[] }
  | { type: 'RENAME_SPRITE'; id: string; name: string }
  | { type: 'REORDER_SPRITES'; fromIndex: number; toIndex: number }
  // Layer actions
  | { type: 'ADD_LAYER' }
  | { type: 'REMOVE_LAYER'; layerId: string }
  | { type: 'SET_ACTIVE_LAYER'; layerId: string }
  | { type: 'SET_LAYER_VISIBILITY'; layerId: string; visible: boolean }
  | { type: 'SET_LAYER_OPACITY'; layerId: string; opacity: number }
  | { type: 'SET_LAYER_NAME'; layerId: string; name: string }
  | { type: 'REORDER_LAYERS'; fromIndex: number; toIndex: number }
  | { type: 'UPDATE_ACTIVE_LAYER'; imageData: ImageData }
  | { type: 'SET_LAYER_BLEND_MODE'; layerId: string; blendMode: LayerBlendMode }
  | { type: 'COMMIT_STROKE' }
  | { type: 'CLEAR_ALL_SPRITES' }

// Actions that represent "significant" changes worth snapshotting for undo
export const UNDOABLE_ACTIONS = new Set<AppAction['type']>([
  'COMMIT_STROKE',
  'SAVE_TO_BANK',
  'UPDATE_IN_BANK',
  'REMOVE_SPRITE',
  'DUPLICATE_SPRITE',
  'CLEAR_TILE',
  'NEW_PROJECT',
  'AI_IMPORT',
  'RENAME_SPRITE',
  'REORDER_SPRITES',
  'ADD_LAYER',
  'REMOVE_LAYER',
  'REORDER_LAYERS',
  'CLEAR_ALL_SPRITES',
  'SET_LAYER_VISIBILITY',
  'SET_LAYER_OPACITY',
  'SET_LAYER_BLEND_MODE',
  'SET_LAYER_NAME',
  'RESIZE_CANVAS',
  'SET_SPRITE_DELAY',
])

function initLayersFromTileData(tileData: ImageData): { layers: Layer[]; activeLayerId: string } {
  const layer = createLayerFromImageData(tileData, 'Layer 1')
  return { layers: [layer], activeLayerId: layer.id }
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_IMAGE':
      return { ...state, image: action.image }
    case 'SET_GRID_SIZE':
      return { ...state, gridSize: action.gridSize }
    case 'SET_TILE_COUNT_X':
      return { ...state, tileCountX: action.count }
    case 'SET_TILE_COUNT_Y':
      return { ...state, tileCountY: action.count }
    case 'SET_SELECTED_TILE':
      return { ...state, selectedTile: action.tile }
    case 'SET_TILE_DATA':
      return { ...state, tileData: action.tileData }
    case 'SET_ACTIVE_TOOL':
      return { ...state, activeTool: action.tool }
    case 'SET_ACTIVE_COLOR': {
      const prev = state.colorHistory
      const deduped = [action.color, ...prev.filter((c) => c !== action.color)].slice(0, 16)
      return { ...state, activeColor: action.color, colorHistory: deduped }
    }
    case 'SET_BRUSH_SIZE':
      return { ...state, brushSize: action.size }
    case 'SET_BRUSH_SHAPE':
      return { ...state, brushShape: action.shape }
    case 'SET_SELECTION_MODE':
      return { ...state, selectionMode: action.mode }
    case 'SET_MAGIC_TOLERANCE':
      return { ...state, magicTolerance: action.tolerance }
    case 'SET_SPRITES':
      return { ...state, sprites: action.sprites }
    case 'SET_EDITING_BANK_INDEX':
      return { ...state, editingBankIndex: action.index }
    case 'SET_SHOW_EXPORT_MODAL':
      return { ...state, showExportModal: action.show }
    case 'SET_SHOW_NEW_PROJECT_MODAL':
      return { ...state, showNewProjectModal: action.show }
    case 'SET_SHOW_AI_IMPORT_MODAL':
      return { ...state, showAIImportModal: action.show }
    case 'SET_SHOW_RESIZE_MODAL':
      return { ...state, showResizeModal: action.show }
    case 'SET_SNAP_TO_PALETTE':
      return { ...state, snapToPalette: action.enabled }
    case 'SET_CUSTOM_BRUSH':
      return { ...state, customBrush: action.brush }
    case 'SET_SPRITE_DELAY': {
      const next = state.sprites.map((s) =>
        s.id === action.id ? { ...s, delay: action.delay } : s
      )
      return { ...state, sprites: next }
    }

    case 'LOAD_IMAGE':
      return {
        ...state,
        image: action.image,
        selectedTile: null,
        tileData: null,
        editingBankIndex: null,
        layers: [],
        activeLayerId: null,
      }

    case 'NEW_PROJECT': {
      const { layers, activeLayerId } = initLayersFromTileData(action.blankData)
      return {
        ...state,
        showNewProjectModal: false,
        gridSize: action.tileSize,
        image: null,
        selectedTile: null,
        editingBankIndex: null,
        tileData: action.blankData,
        layers,
        activeLayerId,
      }
    }

    case 'SELECT_TILE': {
      const { layers, activeLayerId } = initLayersFromTileData(action.tileData)
      return {
        ...state,
        selectedTile: { col: action.col, row: action.row },
        editingBankIndex: null,
        tileData: action.tileData,
        layers,
        activeLayerId,
      }
    }

    case 'CLEAR_TILE':
      return {
        ...state,
        tileData: null,
        selectedTile: null,
        editingBankIndex: null,
        layers: [],
        activeLayerId: null,
      }

    case 'SAVE_TO_BANK': {
      const next = [...state.sprites, action.entry]
      return {
        ...state,
        sprites: next,
        editingBankIndex: next.length - 1,
      }
    }

    case 'UPDATE_IN_BANK': {
      if (state.editingBankIndex === null) return state
      const idx = state.editingBankIndex
      if (idx < 0 || idx >= state.sprites.length) return state
      const next = [...state.sprites]
      next[idx] = { ...next[idx], imageData: action.imageData }
      return { ...state, sprites: next }
    }

    case 'REMOVE_SPRITE': {
      const removedIdx = state.sprites.findIndex((s) => s.id === action.id)
      const next = state.sprites.filter((s) => s.id !== action.id)
      let newEditIdx = state.editingBankIndex
      if (newEditIdx !== null) {
        if (removedIdx === newEditIdx) newEditIdx = null
        else if (removedIdx < newEditIdx) newEditIdx = newEditIdx - 1
      }
      return { ...state, sprites: next, editingBankIndex: newEditIdx }
    }

    case 'DUPLICATE_SPRITE': {
      const sourceIdx = state.sprites.findIndex((s) => s.id === action.id)
      if (sourceIdx === -1) return state
      const next = [...state.sprites]
      next.splice(sourceIdx + 1, 0, action.clone)
      return { ...state, sprites: next }
    }

    case 'SELECT_BANK_SPRITE': {
      const { layers, activeLayerId } = initLayersFromTileData(action.clonedData)
      return {
        ...state,
        editingBankIndex: action.index,
        selectedTile: null,
        tileData: action.clonedData,
        layers,
        activeLayerId,
      }
    }

    case 'AI_LOAD_AS_TILESET':
      return {
        ...state,
        showAIImportModal: false,
        gridSize: action.gridSize,
        selectedTile: null,
        tileData: null,
        editingBankIndex: null,
        layers: [],
        activeLayerId: null,
      }

    case 'AI_IMPORT':
      return {
        ...state,
        showAIImportModal: false,
        sprites: [...state.sprites, ...action.entries],
      }

    case 'RENAME_SPRITE': {
      const next = state.sprites.map((s) =>
        s.id === action.id ? { ...s, name: action.name } : s,
      )
      return { ...state, sprites: next }
    }

    case 'REORDER_SPRITES': {
      const next = [...state.sprites]
      const [moved] = next.splice(action.fromIndex, 1)
      next.splice(action.toIndex, 0, moved)
      let newEditIdx = state.editingBankIndex
      if (newEditIdx !== null) {
        if (newEditIdx === action.fromIndex) {
          newEditIdx = action.toIndex
        } else {
          if (action.fromIndex < newEditIdx && action.toIndex >= newEditIdx) {
            newEditIdx--
          } else if (action.fromIndex > newEditIdx && action.toIndex <= newEditIdx) {
            newEditIdx++
          }
        }
      }
      return { ...state, sprites: next, editingBankIndex: newEditIdx }
    }

    // Layer actions
    case 'ADD_LAYER': {
      if (state.layers.length === 0 || !state.tileData) return state
      const w = state.tileData.width
      const h = state.tileData.height
      if (state.layers.length >= 8) return state
      const newLayer = createLayer(w, h)
      return {
        ...state,
        layers: [...state.layers, newLayer],
        activeLayerId: newLayer.id,
      }
    }

    case 'REMOVE_LAYER': {
      if (state.layers.length <= 1) return state
      const filtered = state.layers.filter((l) => l.id !== action.layerId)
      const newActiveId = state.activeLayerId === action.layerId
        ? filtered[filtered.length - 1].id
        : state.activeLayerId
      return { ...state, layers: filtered, activeLayerId: newActiveId }
    }

    case 'SET_ACTIVE_LAYER':
      return { ...state, activeLayerId: action.layerId }

    case 'SET_LAYER_VISIBILITY':
      return {
        ...state,
        layers: state.layers.map((l) =>
          l.id === action.layerId ? { ...l, visible: action.visible } : l,
        ),
      }

    case 'SET_LAYER_OPACITY':
      return {
        ...state,
        layers: state.layers.map((l) =>
          l.id === action.layerId ? { ...l, opacity: action.opacity } : l,
        ),
      }

    case 'SET_LAYER_NAME':
      return {
        ...state,
        layers: state.layers.map((l) =>
          l.id === action.layerId ? { ...l, name: action.name } : l,
        ),
      }

    case 'REORDER_LAYERS': {
      const newLayers = [...state.layers]
      const [movedLayer] = newLayers.splice(action.fromIndex, 1)
      newLayers.splice(action.toIndex, 0, movedLayer)
      return { ...state, layers: newLayers }
    }

    case 'UPDATE_ACTIVE_LAYER': {
      if (!state.activeLayerId) return state
      return {
        ...state,
        layers: state.layers.map((l) =>
          l.id === state.activeLayerId
            ? { ...l, imageData: action.imageData }
            : l,
        ),
      }
    }

    case 'SET_LAYER_BLEND_MODE':
      return {
        ...state,
        layers: state.layers.map((l) =>
          l.id === action.layerId ? { ...l, blendMode: action.blendMode } : l,
        ),
      }

    case 'RESIZE_CANVAS': {
      if (state.layers.length === 0 || !state.tileData) return state
      const { width: newW, height: newH, anchorX, anchorY } = action
      const oldW = state.tileData.width
      const oldH = state.tileData.height
      // Compute offset based on anchor (0=left/top, 1=center, 2=right/bottom)
      const offsetX = anchorX === 0 ? 0 : anchorX === 1 ? Math.floor((newW - oldW) / 2) : newW - oldW
      const offsetY = anchorY === 0 ? 0 : anchorY === 1 ? Math.floor((newH - oldH) / 2) : newH - oldH
      const newLayers = state.layers.map((l) => {
        const newData = new ImageData(newW, newH)
        const src = l.imageData.data
        const dst = newData.data
        for (let y = 0; y < oldH; y++) {
          for (let x = 0; x < oldW; x++) {
            const nx = x + offsetX
            const ny = y + offsetY
            if (nx >= 0 && nx < newW && ny >= 0 && ny < newH) {
              const si = (y * oldW + x) * 4
              const di = (ny * newW + nx) * 4
              dst[di] = src[si]
              dst[di + 1] = src[si + 1]
              dst[di + 2] = src[si + 2]
              dst[di + 3] = src[si + 3]
            }
          }
        }
        return { ...l, imageData: newData }
      })
      const newTileData = new ImageData(newW, newH)
      return {
        ...state,
        showResizeModal: false,
        layers: newLayers,
        tileData: newTileData,
      }
    }

    case 'COMMIT_STROKE':
      // No-op: exists solely as a snapshot trigger for undo
      return state

    case 'CLEAR_ALL_SPRITES':
      return { ...state, sprites: [], editingBankIndex: null }

    default:
      return state
  }
}
