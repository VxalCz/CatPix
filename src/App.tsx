import { useRef, useCallback, useEffect, useMemo, useReducer } from 'react'
import { Sidebar } from './components/Sidebar'
import { TilesetViewer } from './components/TilesetViewer'
import { PropertiesPanel } from './components/PropertiesPanel'
import { PixelEditor } from './components/PixelEditor'
import { SpriteBank } from './components/SpriteBank'
import { ExportModal } from './components/ExportModal'
import { NewProjectModal } from './components/NewProjectModal'
import { AnimationPreview } from './components/AnimationPreview'
import { AIImportModal } from './components/AIImportModal'
import { LayerPanel } from './components/LayerPanel'
import { usePalette } from './hooks/usePalette'
import { exportProject, exportCatPixProject, type ExportOptions } from './utils/exportProject'
import { flattenLayers } from './state/layers'
import { saveProject, loadProject, restoreSprites, restoreImage } from './utils/storage'
import { initialState } from './state/appReducer'
import type { AppAction } from './state/appReducer'
import { undoReducer, createUndoState } from './state/undoReducer'
import type { UndoAction } from './state/undoReducer'
import { AppStateContext, AppDispatchContext } from './state/AppContext'

export interface SpriteEntry {
  id: string
  name: string
  width: number
  height: number
  imageData: ImageData
}

let spriteCounter = 0

function App() {
  const [undoState, dispatch] = useReducer(undoReducer, initialState, createUndoState)
  const state = undoState.present
  const canUndo = undoState.past.length > 0
  const canRedo = undoState.future.length > 0

  const {
    image, gridSize, tileCountX, tileCountY,
    selectedTile, tileData, activeTool, activeColor,
    sprites, editingBankIndex,
    showExportModal, showNewProjectModal, showAIImportModal,
    layers, activeLayerId,
  } = state

  // Active layer's imageData for the pixel editor
  const activeLayer = useMemo(() => layers.find((l) => l.id === activeLayerId) ?? null, [layers, activeLayerId])
  const activeLayerData = activeLayer?.imageData ?? null

  // Flattened composite of all layers for display
  const compositeTileData = useMemo(() => {
    if (layers.length === 0) return tileData
    return flattenLayers(layers, compositorCanvasRef.current)
  }, [layers, tileData])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const compositorCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))

  // Type-safe dispatch wrapper that handles both undo actions and app actions
  const appDispatch = useCallback((action: UndoAction) => {
    dispatch(action)
  }, [])

  const { colors: palette, truncated: paletteTruncated, totalUnique: paletteTotalUnique } = usePalette(image)

  const onionSkinData = useMemo(() => {
    if (editingBankIndex === null || editingBankIndex <= 0) return null
    return sprites[editingBankIndex - 1]?.imageData ?? null
  }, [editingBankIndex, sprites])

  useEffect(() => {
    if (palette.length > 0) {
      dispatch({ type: 'SET_ACTIVE_COLOR', color: palette[0].hex })
    }
  }, [palette])

  // Keyboard shortcuts effect is placed after handler definitions below

  const handleUpload = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const img = new window.Image()
      img.onload = () => {
        dispatch({ type: 'LOAD_IMAGE', image: img })
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [])

  const handleNewProject = useCallback((tileSize: number) => {
    const blank = new ImageData(tileSize * state.tileCountX, tileSize * state.tileCountY)
    dispatch({ type: 'NEW_PROJECT', tileSize, blankData: blank })
  }, [state.tileCountX, state.tileCountY])

  const handleTileSelect = useCallback(
    (col: number, row: number) => {
      if (!image) return

      const offscreen = document.createElement('canvas')
      offscreen.width = image.width
      offscreen.height = image.height
      const ctx = offscreen.getContext('2d')!
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(image, 0, 0)

      const extractW = Math.min(gridSize * tileCountX, image.width - col * gridSize)
      const extractH = Math.min(gridSize * tileCountY, image.height - row * gridSize)

      const extracted = ctx.getImageData(
        col * gridSize,
        row * gridSize,
        extractW,
        extractH,
      )
      dispatch({ type: 'SELECT_TILE', col, row, tileData: extracted })
    },
    [image, gridSize, tileCountX, tileCountY],
  )

  const handleClearTile = useCallback(() => {
    dispatch({ type: 'CLEAR_TILE' })
  }, [])

  const handleTileDataChange = useCallback((data: ImageData) => {
    // Update active layer, and also sync tileData (which is the composite)
    if (activeLayerId && layers.length > 0) {
      dispatch({ type: 'UPDATE_ACTIVE_LAYER', imageData: data })
    }
    dispatch({ type: 'SET_TILE_DATA', tileData: data })
  }, [activeLayerId, layers.length])

  const handleStrokeCommit = useCallback(() => {
    dispatch({ type: 'COMMIT_STROKE' })
  }, [])

  const handleSaveToBank = useCallback(() => {
    // Flatten all layers for saving
    const flat = layers.length > 0 ? flattenLayers(layers) : tileData
    if (!flat) return

    const cloned = new ImageData(
      new Uint8ClampedArray(flat.data),
      flat.width,
      flat.height,
    )

    spriteCounter++
    const entry: SpriteEntry = {
      id: `sprite_${spriteCounter}_${Date.now()}`,
      name: `sprite_${String(spriteCounter).padStart(3, '0')}`,
      width: flat.width,
      height: flat.height,
      imageData: cloned,
    }

    dispatch({ type: 'SAVE_TO_BANK', entry })
  }, [tileData, layers])

  const handleUpdateInBank = useCallback(() => {
    if (editingBankIndex === null) return
    const flat = layers.length > 0 ? flattenLayers(layers) : tileData
    if (!flat) return

    const cloned = new ImageData(
      new Uint8ClampedArray(flat.data),
      flat.width,
      flat.height,
    )

    dispatch({ type: 'UPDATE_IN_BANK', imageData: cloned })
  }, [tileData, editingBankIndex, layers])

  const handleRemoveSprite = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_SPRITE', id })
  }, [])

  const handleClearAllSprites = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL_SPRITES' })
  }, [])

  const handleDuplicateSprite = useCallback((id: string) => {
    const source = sprites.find((s) => s.id === id)
    if (!source) return

    spriteCounter++
    const clone: SpriteEntry = {
      id: `sprite_${spriteCounter}_${Date.now()}`,
      name: `${source.name}_copy`,
      width: source.width,
      height: source.height,
      imageData: new ImageData(
        new Uint8ClampedArray(source.imageData.data),
        source.width,
        source.height,
      ),
    }

    dispatch({ type: 'DUPLICATE_SPRITE', id, clone })
  }, [sprites])

  const handleSelectBankSprite = useCallback((index: number) => {
    if (index < 0 || index >= sprites.length) return
    const sprite = sprites[index]

    const cloned = new ImageData(
      new Uint8ClampedArray(sprite.imageData.data),
      sprite.width,
      sprite.height,
    )
    dispatch({ type: 'SELECT_BANK_SPRITE', index, clonedData: cloned })
  }, [sprites])

  const handleExport = useCallback(
    (options: ExportOptions) => {
      dispatch({ type: 'SET_SHOW_EXPORT_MODAL', show: false })
      exportProject(sprites, options)
    },
    [sprites],
  )

  const handleAILoadAsTileset = useCallback((imageData: ImageData, tileSize: number) => {
    dispatch({ type: 'AI_LOAD_AS_TILESET', gridSize: tileSize })

    const canvas = document.createElement('canvas')
    canvas.width = imageData.width
    canvas.height = imageData.height
    const ctx = canvas.getContext('2d')!
    ctx.putImageData(imageData, 0, 0)
    const dataUrl = canvas.toDataURL('image/png')
    const img = new window.Image()
    img.onload = () => dispatch({ type: 'SET_IMAGE', image: img })
    img.src = dataUrl
  }, [])

  const handleAIImport = useCallback((tiles: ImageData[]) => {
    const newEntries: SpriteEntry[] = tiles.map((tile) => {
      spriteCounter++
      return {
        id: `sprite_${spriteCounter}_${Date.now()}`,
        name: `sprite_${String(spriteCounter).padStart(3, '0')}`,
        width: tile.width,
        height: tile.height,
        imageData: tile,
      }
    })
    dispatch({ type: 'AI_IMPORT', entries: newEntries })
  }, [])

  const handleRenameSprite = useCallback((id: string, name: string) => {
    dispatch({ type: 'RENAME_SPRITE', id, name })
  }, [])

  const handleReorderSprites = useCallback((fromIndex: number, toIndex: number) => {
    dispatch({ type: 'REORDER_SPRITES', fromIndex, toIndex })
  }, [])

  const handleUndo = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const handleRedo = useCallback(() => dispatch({ type: 'REDO' }), [])

  // Project persistence
  const handleSaveProject = useCallback(async () => {
    await saveProject(sprites, gridSize, tileCountX, tileCountY, image)
  }, [sprites, gridSize, tileCountX, tileCountY, image])

  const handleLoadProject = useCallback(async () => {
    const data = await loadProject()
    if (!data) return

    const restoredSprites = restoreSprites(data)
    const restoredImage = await restoreImage(data)

    // Reset state and load
    if (restoredImage) {
      dispatch({ type: 'LOAD_IMAGE', image: restoredImage })
    }
    dispatch({ type: 'SET_GRID_SIZE', gridSize: data.gridSize })
    dispatch({ type: 'SET_TILE_COUNT_X', count: data.tileCountX })
    dispatch({ type: 'SET_TILE_COUNT_Y', count: data.tileCountY })
    dispatch({ type: 'SET_SPRITES', sprites: restoredSprites })
  }, [])

  const handleExportCatPix = useCallback(async () => {
    let imageDataUrl: string | null = null
    if (image) {
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(image, 0, 0)
      imageDataUrl = canvas.toDataURL('image/png')
    }
    await exportCatPixProject(sprites, gridSize, imageDataUrl)
  }, [sprites, gridSize, image])

  // Auto-save debounce
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (sprites.length === 0) return
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      saveProject(sprites, gridSize, tileCountX, tileCountY, image)
    }, 2000)
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [sprites, gridSize, tileCountX, tileCountY, image])

  // Restore on mount
  useEffect(() => {
    loadProject().then(async (data) => {
      if (!data || data.sprites.length === 0) return
      const restoredSprites = restoreSprites(data)
      const restoredImage = await restoreImage(data)
      if (restoredImage) {
        dispatch({ type: 'LOAD_IMAGE', image: restoredImage })
      }
      dispatch({ type: 'SET_GRID_SIZE', gridSize: data.gridSize })
      dispatch({ type: 'SET_TILE_COUNT_X', count: data.tileCountX })
      dispatch({ type: 'SET_TILE_COUNT_Y', count: data.tileCountY })
      dispatch({ type: 'SET_SPRITES', sprites: restoredSprites })
    })
  }, [])

  // beforeunload warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (sprites.length > 0) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [sprites.length])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault()
          dispatch({ type: 'UNDO' })
          return
        }
        if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
          e.preventDefault()
          dispatch({ type: 'REDO' })
          return
        }
        if (e.key === 's') {
          e.preventDefault()
          if (editingBankIndex !== null && tileData) {
            handleUpdateInBank()
          } else if (tileData) {
            handleSaveToBank()
          }
          return
        }
      }

      // Tool shortcuts
      if (e.key === 'd' || e.key === 'D') dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'draw' })
      if (e.key === 'e' || e.key === 'E') dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'erase' })
      if (e.key === 'f' || e.key === 'F') dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'fill' })
      if (e.key === 'i' || e.key === 'I') dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'eyedropper' })
      if (e.key === 'l' || e.key === 'L') dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'line' })
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'rectangle' })
      if (e.key === 'm' || e.key === 'M') dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'selection' })

      // Navigate sprites with [ and ]
      if (e.key === '[' && sprites.length > 0) {
        const idx = editingBankIndex !== null ? Math.max(0, editingBankIndex - 1) : 0
        handleSelectBankSprite(idx)
      }
      if (e.key === ']' && sprites.length > 0) {
        const idx = editingBankIndex !== null ? Math.min(sprites.length - 1, editingBankIndex + 1) : sprites.length - 1
        handleSelectBankSprite(idx)
      }

      if (e.key === 'Escape') {
        dispatch({ type: 'SET_SHOW_EXPORT_MODAL', show: false })
        dispatch({ type: 'SET_SHOW_NEW_PROJECT_MODAL', show: false })
        dispatch({ type: 'SET_SHOW_AI_IMPORT_MODAL', show: false })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editingBankIndex, tileData, sprites.length, handleSaveToBank, handleUpdateInBank, handleSelectBankSprite])

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={appDispatch as React.Dispatch<AppAction>}>
        <div className="flex flex-col h-full">
          {/* Main area */}
          <div className="flex flex-1 min-h-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />

            <Sidebar
              gridSize={gridSize}
              onGridSizeChange={(size) => dispatch({ type: 'SET_GRID_SIZE', gridSize: size })}
              tileCountX={tileCountX}
              tileCountY={tileCountY}
              onTileCountXChange={(count) => dispatch({ type: 'SET_TILE_COUNT_X', count })}
              onTileCountYChange={(count) => dispatch({ type: 'SET_TILE_COUNT_Y', count })}
              onUpload={handleUpload}
              onNewProject={() => dispatch({ type: 'SET_SHOW_NEW_PROJECT_MODAL', show: true })}
              onAIImport={() => dispatch({ type: 'SET_SHOW_AI_IMPORT_MODAL', show: true })}
              activeTool={activeTool}
              onToolChange={(tool) => dispatch({ type: 'SET_ACTIVE_TOOL', tool })}
              activeColor={activeColor}
              onColorChange={(color) => dispatch({ type: 'SET_ACTIVE_COLOR', color })}
              palette={palette}
              paletteTruncated={paletteTruncated}
              paletteTotalUnique={paletteTotalUnique}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onSaveProject={handleSaveProject}
              onLoadProject={handleLoadProject}
              onExportCatPix={handleExportCatPix}
            />

            <TilesetViewer
              image={image}
              gridSize={gridSize}
              tileCountX={tileCountX}
              tileCountY={tileCountY}
              selectedTile={selectedTile}
              onTileSelect={handleTileSelect}
            />

            {/* Right panel */}
            <div className="w-72 bg-bg-panel border-l border-border-default flex flex-col overflow-y-auto">
              <PropertiesPanel image={image} gridSize={gridSize} />
              <PixelEditor
                tileData={activeLayerData ?? tileData}
                compositeData={compositeTileData}
                activeTool={activeTool}
                activeColor={activeColor}
                onionSkinData={onionSkinData}
                isEditingBank={editingBankIndex !== null}
                onClear={handleClearTile}
                onTileDataChange={handleTileDataChange}
                onStrokeCommit={handleStrokeCommit}
                onColorChange={(color) => dispatch({ type: 'SET_ACTIVE_COLOR', color })}
                onToolChange={(tool) => dispatch({ type: 'SET_ACTIVE_TOOL', tool })}
                onSaveToBank={handleSaveToBank}
                onUpdateInBank={handleUpdateInBank}
              />
              <LayerPanel
                layers={layers}
                activeLayerId={activeLayerId}
                onAddLayer={() => dispatch({ type: 'ADD_LAYER' })}
                onRemoveLayer={(id) => dispatch({ type: 'REMOVE_LAYER', layerId: id })}
                onSetActiveLayer={(id) => dispatch({ type: 'SET_ACTIVE_LAYER', layerId: id })}
                onSetVisibility={(id, visible) => dispatch({ type: 'SET_LAYER_VISIBILITY', layerId: id, visible })}
                onSetOpacity={(id, opacity) => dispatch({ type: 'SET_LAYER_OPACITY', layerId: id, opacity })}
                onSetName={(id, name) => dispatch({ type: 'SET_LAYER_NAME', layerId: id, name })}
                onReorder={(from, to) => dispatch({ type: 'REORDER_LAYERS', fromIndex: from, toIndex: to })}
              />
              <AnimationPreview sprites={sprites} />
            </div>
          </div>

          {/* Sprite Bank (bottom bar) */}
          <SpriteBank
            sprites={sprites}
            editingBankIndex={editingBankIndex}
            onRemove={handleRemoveSprite}
            onDuplicate={handleDuplicateSprite}
            onSelectSprite={handleSelectBankSprite}
            onRename={handleRenameSprite}
            onReorder={handleReorderSprites}
            onClearAll={handleClearAllSprites}
            onOpenExport={() => dispatch({ type: 'SET_SHOW_EXPORT_MODAL', show: true })}
          />

          {/* Modals */}
          {showNewProjectModal && (
            <NewProjectModal
              onConfirm={handleNewProject}
              onClose={() => dispatch({ type: 'SET_SHOW_NEW_PROJECT_MODAL', show: false })}
            />
          )}
          {showAIImportModal && (
            <AIImportModal
              gridSize={gridSize}
              onImport={handleAIImport}
              onLoadAsTileset={handleAILoadAsTileset}
              onClose={() => dispatch({ type: 'SET_SHOW_AI_IMPORT_MODAL', show: false })}
            />
          )}
          {showExportModal && sprites.length > 0 && (
            <ExportModal
              spriteCount={sprites.length}
              tileWidth={sprites[0].width}
              tileHeight={sprites[0].height}
              onExport={handleExport}
              onClose={() => dispatch({ type: 'SET_SHOW_EXPORT_MODAL', show: false })}
            />
          )}
        </div>
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  )
}

export default App
