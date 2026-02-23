import { useRef, useEffect, useCallback, useState } from 'react'
import { Trash2, Download, FlipHorizontal2, FlipVertical2, Save } from 'lucide-react'
import type { Tool } from './Sidebar'
import { useSymmetry } from '../hooks/useSymmetry'

interface PixelEditorProps {
  tileData: ImageData | null
  gridSize: number
  activeTool: Tool
  activeColor: string
  onClear: () => void
  onTileDataChange: (data: ImageData) => void
  onSaveToBank: () => void
}

const EDITOR_DISPLAY_SIZE = 256

function hexToRgba(hex: string): [number, number, number, number] {
  const clean = hex.replace('#', '')
  if (clean.length === 8) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
      parseInt(clean.slice(6, 8), 16),
    ]
  }
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
    255,
  ]
}

export function PixelEditor({
  tileData,
  gridSize,
  activeTool,
  activeColor,
  onClear,
  onTileDataChange,
  onSaveToBank,
}: PixelEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [symmetryH, setSymmetryH] = useState(false)
  const [symmetryV, setSymmetryV] = useState(false)

  const { getMirroredPixels } = useSymmetry({
    horizontal: symmetryH,
    vertical: symmetryV,
    gridSize,
  })

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = gridSize
    canvas.height = gridSize
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, gridSize, gridSize)

    if (tileData) {
      ctx.putImageData(tileData, 0, 0)
    }
  }, [tileData, gridSize])

  useEffect(() => {
    redraw()
  }, [redraw])

  const getPixelCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const scaleX = gridSize / rect.width
      const scaleY = gridSize / rect.height
      const px = Math.floor((e.clientX - rect.left) * scaleX)
      const py = Math.floor((e.clientY - rect.top) * scaleY)
      if (px < 0 || px >= gridSize || py < 0 || py >= gridSize) return null
      return { px, py }
    },
    [gridSize],
  )

  const paintPixel = useCallback(
    (px: number, py: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const current = ctx.getImageData(0, 0, gridSize, gridSize)
      const points = getMirroredPixels(px, py)

      for (const pt of points) {
        if (pt.px < 0 || pt.px >= gridSize || pt.py < 0 || pt.py >= gridSize) continue
        const idx = (pt.py * gridSize + pt.px) * 4

        if (activeTool === 'erase') {
          current.data[idx] = 0
          current.data[idx + 1] = 0
          current.data[idx + 2] = 0
          current.data[idx + 3] = 0
        } else {
          const [r, g, b, a] = hexToRgba(activeColor)
          current.data[idx] = r
          current.data[idx + 1] = g
          current.data[idx + 2] = b
          current.data[idx + 3] = a
        }
      }

      ctx.putImageData(current, 0, 0)
      onTileDataChange(current)
    },
    [gridSize, activeTool, activeColor, onTileDataChange, getMirroredPixels],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0 || !tileData) return
      setIsDrawing(true)
      const coords = getPixelCoords(e)
      if (coords) paintPixel(coords.px, coords.py)
    },
    [tileData, getPixelCoords, paintPixel],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return
      const coords = getPixelCoords(e)
      if (coords) paintPixel(coords.px, coords.py)
    },
    [isDrawing, getPixelCoords, paintPixel],
  )

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false)
  }, [])

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !tileData) return

    const link = document.createElement('a')
    link.download = `tile_${gridSize}x${gridSize}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [tileData, gridSize])

  return (
    <div className="p-3 border-b border-border-default">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Pixel Editor
      </h3>

      {/* Symmetry toggles */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setSymmetryV((v) => !v)}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
            symmetryV
              ? 'bg-accent text-white'
              : 'bg-bg-hover text-text-secondary hover:text-text-primary'
          }`}
          title="Vertical symmetry (left/right mirror)"
        >
          <FlipHorizontal2 size={13} />
          V-Sym
        </button>
        <button
          onClick={() => setSymmetryH((v) => !v)}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
            symmetryH
              ? 'bg-accent text-white'
              : 'bg-bg-hover text-text-secondary hover:text-text-primary'
          }`}
          title="Horizontal symmetry (top/bottom mirror)"
        >
          <FlipVertical2 size={13} />
          H-Sym
        </button>
      </div>

      {/* Canvas wrapper */}
      <div
        className="relative mx-auto border border-border-default rounded"
        style={{
          width: EDITOR_DISPLAY_SIZE,
          height: EDITOR_DISPLAY_SIZE,
          background: `
            repeating-conic-gradient(#1a1a2e 0% 25%, #0f0f1e 0% 50%)
            50% / 16px 16px
          `,
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            width: EDITOR_DISPLAY_SIZE,
            height: EDITOR_DISPLAY_SIZE,
            imageRendering: 'pixelated',
            cursor: tileData ? 'crosshair' : 'default',
          }}
        />

        {/* Symmetry guides — odd grids: line through center pixel, even: between pixels */}
        {tileData && symmetryV && (() => {
          const isOdd = gridSize % 2 === 1
          const pixelDisplaySize = EDITOR_DISPLAY_SIZE / gridSize
          const centerPx = Math.floor(gridSize / 2)
          // Odd: center of the middle pixel. Even: border between two center pixels
          const leftPos = isOdd
            ? (centerPx + 0.5) * pixelDisplaySize
            : centerPx * pixelDisplaySize
          const widthPx = isOdd ? pixelDisplaySize : 1
          return (
            <div
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{
                left: leftPos,
                width: widthPx,
                background: isOdd
                  ? 'rgba(99, 102, 241, 0.15)'
                  : 'rgba(99, 102, 241, 0.5)',
                borderLeft: isOdd ? undefined : undefined,
              }}
            />
          )
        })()}
        {tileData && symmetryH && (() => {
          const isOdd = gridSize % 2 === 1
          const pixelDisplaySize = EDITOR_DISPLAY_SIZE / gridSize
          const centerPx = Math.floor(gridSize / 2)
          const topPos = isOdd
            ? (centerPx + 0.5) * pixelDisplaySize
            : centerPx * pixelDisplaySize
          const heightPx = isOdd ? pixelDisplaySize : 1
          return (
            <div
              className="absolute left-0 right-0 pointer-events-none"
              style={{
                top: topPos,
                height: heightPx,
                background: isOdd
                  ? 'rgba(99, 102, 241, 0.15)'
                  : 'rgba(99, 102, 241, 0.5)',
              }}
            />
          )
        })()}

        {!tileData && (
          <div className="absolute inset-0 flex items-center justify-center text-text-muted text-xs text-center px-4 pointer-events-none">
            Click a tile in the tileset to extract it here
          </div>
        )}
      </div>

      <p className="text-xs text-text-muted text-center mt-2">
        {gridSize} x {gridSize} px
      </p>

      {/* Actions */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={onClear}
          disabled={!tileData}
          className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors cursor-pointer bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
          title="Clear canvas"
        >
          <Trash2 size={13} />
        </button>
        <button
          onClick={handleDownload}
          disabled={!tileData}
          className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors cursor-pointer bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
          title="Download PNG"
        >
          <Download size={13} />
        </button>
        <button
          onClick={onSaveToBank}
          disabled={!tileData}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors cursor-pointer bg-green-600 text-white hover:bg-green-500 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Save size={13} />
          Save to Bank
        </button>
      </div>
    </div>
  )
}
