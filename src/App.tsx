import { useState, useRef, useCallback, useEffect } from 'react'
import { Sidebar, type Tool } from './components/Sidebar'
import { TilesetViewer } from './components/TilesetViewer'
import { PropertiesPanel } from './components/PropertiesPanel'
import { PixelEditor } from './components/PixelEditor'
import { SpriteBank } from './components/SpriteBank'
import { ExportModal } from './components/ExportModal'
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
  const [showExportModal, setShowExportModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { colors: palette, truncated: paletteTruncated, totalUnique: paletteTotalUnique } = usePalette(image)

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
      if (e.key === 'Escape') setShowExportModal(false)
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
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [])

  const handleTileSelect = useCallback(
    (col: number, row: number) => {
      if (!image) return

      setSelectedTile({ col, row })

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

    setSprites((prev) => [...prev, entry])
  }, [tileData])

  const handleRemoveSprite = useCallback((id: string) => {
    setSprites((prev) => prev.filter((s) => s.id !== id))
  }, [])

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
            onClear={handleClearTile}
            onTileDataChange={handleTileDataChange}
            onSaveToBank={handleSaveToBank}
          />
        </div>
      </div>

      {/* Sprite Bank (bottom bar) */}
      <SpriteBank
        sprites={sprites}
        onRemove={handleRemoveSprite}
        onOpenExport={() => setShowExportModal(true)}
      />

      {/* Export modal */}
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
