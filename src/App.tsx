import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Sidebar, type Tool } from './components/Sidebar'
import { TilesetViewer } from './components/TilesetViewer'
import { PropertiesPanel } from './components/PropertiesPanel'
import { PixelEditor } from './components/PixelEditor'
import { SpriteBank } from './components/SpriteBank'
import { ExportModal } from './components/ExportModal'
import { NewProjectModal } from './components/NewProjectModal'
import { AnimationPreview } from './components/AnimationPreview'
import { usePalette } from './hooks/usePalette'
import { exportProject, type ExportOptions } from './utils/exportProject'

export interface SpriteEntry {
  id: string
  name: string
  width: number
  height: number
  imageData: ImageData
}

let spriteCounter = 0

function App() {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [gridSize, setGridSize] = useState(32)
  const [selectedTile, setSelectedTile] = useState<{ col: number; row: number } | null>(null)
  const [tileData, setTileData] = useState<ImageData | null>(null)
  const [activeTool, setActiveTool] = useState<Tool>('draw')
  const [activeColor, setActiveColor] = useState('#000000')
  const [sprites, setSprites] = useState<SpriteEntry[]>([])
  const [editingBankIndex, setEditingBankIndex] = useState<number | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { colors: palette, truncated: paletteTruncated, totalUnique: paletteTotalUnique } = usePalette(image)

  // Onion skin: previous sprite in bank relative to currently edited one
  const onionSkinData = useMemo(() => {
    if (editingBankIndex === null || editingBankIndex <= 0) return null
    return sprites[editingBankIndex - 1]?.imageData ?? null
  }, [editingBankIndex, sprites])

  useEffect(() => {
    if (palette.length > 0) {
      setActiveColor(palette[0].hex)
    }
  }, [palette])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'd' || e.key === 'D') setActiveTool('draw')
      if (e.key === 'e' || e.key === 'E') setActiveTool('erase')
      if (e.key === 'Escape') {
        setShowExportModal(false)
        setShowNewProjectModal(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

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
        setImage(img)
        setSelectedTile(null)
        setTileData(null)
        setEditingBankIndex(null)
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [])

  const handleNewProject = useCallback((tileSize: number) => {
    setShowNewProjectModal(false)
    setGridSize(tileSize)
    setImage(null)
    setSelectedTile(null)
    setEditingBankIndex(null)

    const blank = new ImageData(tileSize, tileSize)
    setTileData(blank)
  }, [])

  const handleTileSelect = useCallback(
    (col: number, row: number) => {
      if (!image) return

      setSelectedTile({ col, row })
      setEditingBankIndex(null)

      const offscreen = document.createElement('canvas')
      offscreen.width = image.width
      offscreen.height = image.height
      const ctx = offscreen.getContext('2d')!
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(image, 0, 0)

      const extracted = ctx.getImageData(
        col * gridSize,
        row * gridSize,
        gridSize,
        gridSize,
      )
      setTileData(extracted)
    },
    [image, gridSize],
  )

  const handleClearTile = useCallback(() => {
    setTileData(null)
    setSelectedTile(null)
    setEditingBankIndex(null)
  }, [])

  const handleTileDataChange = useCallback((data: ImageData) => {
    setTileData(data)
  }, [])

  const handleSaveToBank = useCallback(() => {
    if (!tileData) return

    const cloned = new ImageData(
      new Uint8ClampedArray(tileData.data),
      tileData.width,
      tileData.height,
    )

    spriteCounter++
    const entry: SpriteEntry = {
      id: `sprite_${spriteCounter}_${Date.now()}`,
      name: `sprite_${String(spriteCounter).padStart(3, '0')}`,
      width: tileData.width,
      height: tileData.height,
      imageData: cloned,
    }

    setSprites((prev) => {
      const next = [...prev, entry]
      // Set editing index to the newly added sprite
      setEditingBankIndex(next.length - 1)
      return next
    })
  }, [tileData])

  const handleUpdateInBank = useCallback(() => {
    if (!tileData || editingBankIndex === null) return

    const cloned = new ImageData(
      new Uint8ClampedArray(tileData.data),
      tileData.width,
      tileData.height,
    )

    setSprites((prev) => {
      if (editingBankIndex < 0 || editingBankIndex >= prev.length) return prev
      const next = [...prev]
      next[editingBankIndex] = {
        ...next[editingBankIndex],
        imageData: cloned,
      }
      return next
    })
  }, [tileData, editingBankIndex])

  const handleRemoveSprite = useCallback((id: string) => {
    setSprites((prev) => {
      const next = prev.filter((s) => s.id !== id)
      setEditingBankIndex((idx) => {
        if (idx === null) return null
        const removedIdx = prev.findIndex((s) => s.id === id)
        if (removedIdx === idx) return null
        if (removedIdx < idx) return idx - 1
        return idx
      })
      return next
    })
  }, [])

  const handleDuplicateSprite = useCallback((id: string) => {
    setSprites((prev) => {
      const sourceIdx = prev.findIndex((s) => s.id === id)
      if (sourceIdx === -1) return prev
      const source = prev[sourceIdx]

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

      const next = [...prev]
      next.splice(sourceIdx + 1, 0, clone)
      return next
    })
  }, [])

  const handleSelectBankSprite = useCallback((index: number) => {
    if (index < 0 || index >= sprites.length) return
    const sprite = sprites[index]
    setEditingBankIndex(index)
    setSelectedTile(null)

    // Load a clone into the editor
    const cloned = new ImageData(
      new Uint8ClampedArray(sprite.imageData.data),
      sprite.width,
      sprite.height,
    )
    setTileData(cloned)
  }, [sprites])

  const handleExport = useCallback(
    (options: ExportOptions) => {
      setShowExportModal(false)
      exportProject(sprites, options)
    },
    [sprites],
  )

  return (
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
          onGridSizeChange={setGridSize}
          onUpload={handleUpload}
          onNewProject={() => setShowNewProjectModal(true)}
          activeTool={activeTool}
          onToolChange={setActiveTool}
          activeColor={activeColor}
          onColorChange={setActiveColor}
          palette={palette}
          paletteTruncated={paletteTruncated}
          paletteTotalUnique={paletteTotalUnique}
        />

        <TilesetViewer
          image={image}
          gridSize={gridSize}
          selectedTile={selectedTile}
          onTileSelect={handleTileSelect}
        />

        {/* Right panel */}
        <div className="w-72 bg-bg-panel border-l border-border-default flex flex-col overflow-y-auto">
          <PropertiesPanel image={image} gridSize={gridSize} />
          <PixelEditor
            tileData={tileData}
            gridSize={gridSize}
            activeTool={activeTool}
            activeColor={activeColor}
            onionSkinData={onionSkinData}
            isEditingBank={editingBankIndex !== null}
            onClear={handleClearTile}
            onTileDataChange={handleTileDataChange}
            onSaveToBank={handleSaveToBank}
            onUpdateInBank={handleUpdateInBank}
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
        onOpenExport={() => setShowExportModal(true)}
      />

      {/* Modals */}
      {showNewProjectModal && (
        <NewProjectModal
          onConfirm={handleNewProject}
          onClose={() => setShowNewProjectModal(false)}
        />
      )}
      {showExportModal && sprites.length > 0 && (
        <ExportModal
          spriteCount={sprites.length}
          tileWidth={sprites[0].width}
          tileHeight={sprites[0].height}
          onExport={handleExport}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  )
}

export default App
