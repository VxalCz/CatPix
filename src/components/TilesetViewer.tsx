import { useState, useCallback, useEffect, useRef } from 'react'
import { useCanvas } from '../hooks/useCanvas'

interface TilesetViewerProps {
  image: HTMLImageElement | null
  gridSize: number
  tileCountX: number
  tileCountY: number
  selectedTile: { col: number; row: number } | null
  onTileSelect: (col: number, row: number) => void
}

const ZOOM_MIN = 0.25
const ZOOM_MAX = 16
const ZOOM_STEP = 0.15

export function TilesetViewer({ image, gridSize, tileCountX, tileCountY, selectedTile, onTileSelect }: TilesetViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const hoverOverlayRef = useRef<HTMLCanvasElement>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [hoveredTile, setHoveredTile] = useState<{ col: number; row: number } | null>(null)

  const canvasWidth = image ? image.width : 512
  const canvasHeight = image ? image.height : 512

  // Draw image + grid + selection (NOT hover — hover is on overlay)
  const drawGrid = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!image) return

      ctx.drawImage(image, 0, 0)

      // Batch all grid lines into a single path
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
      ctx.lineWidth = 1
      ctx.beginPath()

      for (let x = 0; x <= image.width; x += gridSize) {
        ctx.moveTo(x + 0.5, 0)
        ctx.lineTo(x + 0.5, image.height)
      }
      for (let y = 0; y <= image.height; y += gridSize) {
        ctx.moveTo(0, y + 0.5)
        ctx.lineTo(image.width, y + 0.5)
      }

      ctx.stroke()

      // Multi-tile region dimensions
      const regionW = gridSize * tileCountX
      const regionH = gridSize * tileCountY

      // Highlight selected tile region
      if (selectedTile) {
        const selW = Math.min(regionW, image.width - selectedTile.col * gridSize)
        const selH = Math.min(regionH, image.height - selectedTile.row * gridSize)
        ctx.fillStyle = 'rgba(34, 197, 94, 0.2)'
        ctx.fillRect(
          selectedTile.col * gridSize,
          selectedTile.row * gridSize,
          selW,
          selH,
        )
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.9)'
        ctx.lineWidth = 2
        ctx.strokeRect(
          selectedTile.col * gridSize + 1,
          selectedTile.row * gridSize + 1,
          selW - 2,
          selH - 2,
        )
      }
    },
    [image, gridSize, tileCountX, tileCountY, selectedTile],
  )

  const { canvasRef, redraw } = useCanvas({
    width: canvasWidth,
    height: canvasHeight,
    draw: drawGrid,
  })

  useEffect(() => {
    redraw()
  }, [redraw, selectedTile])

  // Draw hover highlight imperatively on overlay canvas (avoids full tileset redraw)
  useEffect(() => {
    const overlay = hoverOverlayRef.current
    if (!overlay || !image) return
    const ctx = overlay.getContext('2d')
    if (!ctx) return

    if (overlay.width !== image.width) overlay.width = image.width
    if (overlay.height !== image.height) overlay.height = image.height
    ctx.clearRect(0, 0, overlay.width, overlay.height)

    if (!hoveredTile) return
    if (selectedTile && hoveredTile.col === selectedTile.col && hoveredTile.row === selectedTile.row) return

    const regionW = gridSize * tileCountX
    const regionH = gridSize * tileCountY
    const hovW = Math.min(regionW, image.width - hoveredTile.col * gridSize)
    const hovH = Math.min(regionH, image.height - hoveredTile.row * gridSize)

    ctx.fillStyle = 'rgba(99, 102, 241, 0.25)'
    ctx.fillRect(
      hoveredTile.col * gridSize,
      hoveredTile.row * gridSize,
      hovW,
      hovH,
    )
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)'
    ctx.lineWidth = 2
    ctx.strokeRect(
      hoveredTile.col * gridSize + 1,
      hoveredTile.row * gridSize + 1,
      hovW - 2,
      hovH - 2,
    )
  }, [hoveredTile, image, gridSize, tileCountX, tileCountY, selectedTile])

  // Center image on load
  useEffect(() => {
    if (image && containerRef.current) {
      const container = containerRef.current
      const fitZoom = Math.min(
        (container.clientWidth - 40) / image.width,
        (container.clientHeight - 40) / image.height,
        2,
      )
      setZoom(fitZoom)
      setOffset({
        x: (container.clientWidth - image.width * fitZoom) / 2,
        y: (container.clientHeight - image.height * fitZoom) / 2,
      })
    }
  }, [image])

  const getTileAtMouse = useCallback(
    (e: React.MouseEvent) => {
      if (!image) return null
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return null

      const canvasX = (e.clientX - rect.left - offset.x) / zoom
      const canvasY = (e.clientY - rect.top - offset.y) / zoom

      if (canvasX >= 0 && canvasX < image.width && canvasY >= 0 && canvasY < image.height) {
        const maxCol = Math.ceil(image.width / gridSize) - 1
        const maxRow = Math.ceil(image.height / gridSize) - 1
        // Clamp so multi-tile region doesn't extend past image bounds
        const col = Math.min(Math.floor(canvasX / gridSize), Math.max(0, maxCol - tileCountX + 1))
        const row = Math.min(Math.floor(canvasY / gridSize), Math.max(0, maxRow - tileCountY + 1))
        return { col, row }
      }
      return null
    },
    [image, offset, zoom, gridSize, tileCountX, tileCountY],
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const factor = e.deltaY < 0 ? 1 + ZOOM_STEP : 1 / (1 + ZOOM_STEP)
      const newZoom = Math.min(Math.max(zoom * factor, ZOOM_MIN), ZOOM_MAX)

      setOffset({
        x: mouseX - (mouseX - offset.x) * (newZoom / zoom),
        y: mouseY - (mouseY - offset.y) * (newZoom / zoom),
      })
      setZoom(newZoom)
    },
    [zoom, offset],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        setIsPanning(true)
        setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
        e.preventDefault()
      }
    },
    [offset],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setOffset({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        })
        return
      }

      const tile = getTileAtMouse(e)
      setHoveredTile(tile)
    },
    [isPanning, panStart, getTileAtMouse],
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setIsPanning(false)
        return
      }

      // Left click without alt = select tile
      if (e.button === 0 && !e.altKey) {
        const tile = getTileAtMouse(e)
        if (tile) {
          onTileSelect(tile.col, tile.row)
        }
      }
    },
    [isPanning, getTileAtMouse, onTileSelect],
  )

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false)
    setHoveredTile(null)
  }, [])

  const cols = image ? Math.ceil(image.width / gridSize) : 0
  const rows = image ? Math.ceil(image.height / gridSize) : 0

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="h-8 flex items-center gap-3 px-3 border-b border-border-default bg-bg-panel text-xs text-text-secondary">
        <span>Zoom: {Math.round(zoom * 100)}%</span>
        {image && (
          <>
            <span className="text-border-default">|</span>
            <span>{image.width} x {image.height}px</span>
            <span className="text-border-default">|</span>
            <span>{cols} x {rows} tiles</span>
          </>
        )}
        {hoveredTile && (
          <>
            <span className="text-border-default">|</span>
            <span>
              Tile [{hoveredTile.col}, {hoveredTile.row}]
            </span>
          </>
        )}
        {selectedTile && (
          <>
            <span className="text-border-default">|</span>
            <span className="text-green-400">
              Selected [{selectedTile.col}, {selectedTile.row}]
            </span>
          </>
        )}
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden cursor-crosshair relative"
        style={{ background: '#0a0a0a' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {image ? (
          <div
            style={{
              position: 'absolute',
              left: offset.x,
              top: offset.y,
              width: canvasWidth * zoom,
              height: canvasHeight * zoom,
            }}
          >
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                height: '100%',
                imageRendering: 'pixelated',
                background: `
                  repeating-conic-gradient(#1a1a2e 0% 25%, #0f0f1e 0% 50%)
                  50% / 16px 16px
                `,
              }}
            />
            <canvas
              ref={hoverOverlayRef}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                imageRendering: 'pixelated',
                pointerEvents: 'none',
              }}
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-text-muted">
            <div className="text-center">
              <p className="text-lg mb-1">No tileset loaded</p>
              <p className="text-sm">Upload a PNG image to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
