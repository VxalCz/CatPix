import { useRef, useEffect, useCallback, useState } from 'react'
import type { Tool, BrushShape } from '../state/appReducer'
import { useSymmetry } from '../hooks/useSymmetry'
import { floodFill } from '../utils/floodFill'
import type { SelectionRect } from '../utils/selection'
import { rotateImageData90, flipImageData } from '../utils/transform'
import { generateBrushStamp } from '../utils/brushStamp'
import { hexToRgba } from '../utils/colorUtils'
import type { SelectionMode } from '../state/appReducer'
import {
  rgbaToHex, mod,
  drawLineOnData as drawLinePure,
  drawRectOnData as drawRectPure,
  drawEllipseOnData as drawEllipsePure,
} from '../utils/pixelEditorDraw'
import { usePixelEditorInput } from '../hooks/usePixelEditorInput'
import { PixelEditorControls } from './PixelEditorControls'
import { renderText } from '../data/pixelFont'

const EDITOR_DISPLAY_SIZE = 256

function TilingPreview({ data, spriteW, spriteH, zoom, offset }: {
  data: ImageData
  spriteW: number
  spriteH: number
  zoom: number
  offset: { x: number; y: number }
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = spriteW * 3
    const h = spriteH * 3
    canvas.width = w
    canvas.height = h
    ctx.imageSmoothingEnabled = false
    // Draw 3x3 grid of the tile
    const tmp = document.createElement('canvas')
    tmp.width = spriteW
    tmp.height = spriteH
    const tmpCtx = tmp.getContext('2d')
    if (!tmpCtx) return
    tmpCtx.putImageData(data, 0, 0)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        ctx.drawImage(tmp, col * spriteW, row * spriteH)
      }
    }
  }, [data, spriteW, spriteH])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        left: offset.x - spriteW * zoom,
        top: offset.y - spriteH * zoom,
        width: spriteW * 3 * zoom,
        height: spriteH * 3 * zoom,
        imageRendering: 'pixelated',
        opacity: 0.5,
        pointerEvents: 'none',
        border: '1px dashed rgba(99,102,241,0.5)',
      }}
    />
  )
}

interface PixelEditorProps {
  tileData: ImageData | null
  compositeData?: ImageData | null  // flattened layers for display
  activeTool: Tool
  activeColor: string
  brushSize: number
  brushShape: BrushShape
  customBrush: boolean[][] | null
  snapToPalette: boolean
  palette: { hex: string }[]
  selectionMode: SelectionMode
  magicTolerance: number
  onionSkinData: ImageData | null
  isEditingBank: boolean
  onClear: () => void
  onTileDataChange: (data: ImageData) => void
  onStrokeCommit: () => void
  onColorChange: (color: string) => void
  onToolChange: (tool: Tool) => void
  onSaveToBank: () => void
  onUpdateInBank: () => void
  onOutlineEffect: () => void
  onOpenResize: () => void
}

export function PixelEditor({
  tileData,
  compositeData,
  activeTool,
  activeColor,
  brushSize,
  brushShape,
  customBrush,
  snapToPalette,
  palette,
  selectionMode,
  magicTolerance,
  onionSkinData,
  isEditingBank,
  onClear,
  onTileDataChange,
  onStrokeCommit,
  onColorChange,
  onToolChange,
  onSaveToBank,
  onUpdateInBank,
  onOutlineEffect,
  onOpenResize,
}: PixelEditorProps) {
  const displayData = compositeData ?? tileData
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)

  // Working buffer: mutated in-place during drag, committed on mouseup
  const workingBufferRef = useRef<ImageData | null>(null)

  // Reusable offscreen canvases for redraw
  const onionSkinCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const displayCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))

  // Cached active color as RGBA tuple
  const activeRgbaRef = useRef<[number, number, number, number]>([0, 0, 0, 255])

  // Ref to redraw function
  const redrawRef = useRef<() => void>(() => {})

  // true only for draw/erase (shape tools dispatch via React)
  const isPaintDrawingRef = useRef(false)
  // Composite of all layers — for eyedropper
  const displayDataRef = useRef(displayData)

  const [symmetryH, setSymmetryH] = useState(false)
  const [symmetryV, setSymmetryV] = useState(false)
  const [wrapAround, setWrapAround] = useState(false)
  const [onionSkin, setOnionSkin] = useState(false)
  const [lockAlpha, setLockAlpha] = useState(false)
  const [showTiling, setShowTiling] = useState(false)
  // Text tool overlay
  const [textToolPos, setTextToolPos] = useState<{ x: number; y: number; px: number; py: number } | null>(null)
  const [textInput, setTextInput] = useState('')
  const textInputRef = useRef<HTMLInputElement>(null)

  // Reference image
  const [refImage, setRefImage] = useState<HTMLImageElement | null>(null)
  const [refOpacity, setRefOpacity] = useState(0.3)
  const [showRef, setShowRef] = useState(true)
  const refInputRef = useRef<HTMLInputElement>(null)

  const spriteW = tileData?.width ?? 0
  const spriteH = tileData?.height ?? 0

  const wrapAroundRef = useRef(wrapAround)
  const lockAlphaRef = useRef(lockAlpha)
  const spriteWRef = useRef(spriteW)
  const spriteHRef = useRef(spriteH)
  const activeToolRef = useRef(activeTool)
  const tileDataRef = useRef(tileData)
  const brushSizeRef = useRef(brushSize)
  const brushShapeRef = useRef(brushShape)
  const customBrushRef = useRef(customBrush)
  const snapToPaletteRef = useRef(snapToPalette)
  const paletteRef = useRef(palette)

  const { getMirroredPixels } = useSymmetry({
    horizontal: symmetryH,
    vertical: symmetryV,
    width: spriteW,
    height: spriteH,
  })
  const getMirroredPixelsRef = useRef(getMirroredPixels)

  const onTileDataChangeRef = useRef(onTileDataChange)
  const onStrokeCommitRef = useRef(onStrokeCommit)
  const onColorChangeRef = useRef(onColorChange)
  const onToolChangeRef = useRef(onToolChange)

  useEffect(() => {
    displayDataRef.current = displayData
  }, [displayData])

  useEffect(() => {
    wrapAroundRef.current = wrapAround
    lockAlphaRef.current = lockAlpha
    spriteWRef.current = spriteW
    spriteHRef.current = spriteH
    activeToolRef.current = activeTool
    activeRgbaRef.current = hexToRgba(activeColor)
    tileDataRef.current = tileData
    brushSizeRef.current = brushSize
    brushShapeRef.current = brushShape
    customBrushRef.current = customBrush
    snapToPaletteRef.current = snapToPalette
    paletteRef.current = palette
    if (!isDrawingRef.current) {
      workingBufferRef.current = tileData
    }
    getMirroredPixelsRef.current = getMirroredPixels
    onTileDataChangeRef.current = onTileDataChange
    onStrokeCommitRef.current = onStrokeCommit
    onColorChangeRef.current = onColorChange
    onToolChangeRef.current = onToolChange
  }, [wrapAround, lockAlpha, spriteW, spriteH, activeTool, activeColor, tileData,
      getMirroredPixels, onTileDataChange, onStrokeCommit, onColorChange,
      onToolChange, brushSize, brushShape, customBrush, snapToPalette, palette])

  // Draw main canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = spriteW || 1
    const h = spriteH || 1

    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, w, h)

    if (showRef && refImage) {
      ctx.globalAlpha = refOpacity
      ctx.drawImage(refImage, 0, 0, w, h)
      ctx.globalAlpha = 1.0
    }

    if (onionSkin && onionSkinData) {
      const tmp = onionSkinCanvasRef.current
      if (tmp.width !== onionSkinData.width) tmp.width = onionSkinData.width
      if (tmp.height !== onionSkinData.height) tmp.height = onionSkinData.height
      const tmpCtx = tmp.getContext('2d')
      if (!tmpCtx) return
      tmpCtx.putImageData(onionSkinData, 0, 0)
      ctx.globalAlpha = 0.3
      ctx.drawImage(tmp, 0, 0)
      ctx.globalAlpha = 1.0
    }

    const dataToShow = (isPaintDrawingRef.current ? workingBufferRef.current : null) ?? displayData ?? tileData
    if (dataToShow) {
      const tmp = displayCanvasRef.current
      if (tmp.width !== dataToShow.width) tmp.width = dataToShow.width
      if (tmp.height !== dataToShow.height) tmp.height = dataToShow.height
      const tmpCtx = tmp.getContext('2d')
      if (!tmpCtx) return
      tmpCtx.putImageData(dataToShow, 0, 0)
      ctx.drawImage(tmp, 0, 0)
    }
  }, [displayData, tileData, spriteW, spriteH, onionSkin, onionSkinData, showRef, refImage, refOpacity])

  useEffect(() => {
    redrawRef.current = redraw
    redraw()
  }, [redraw])

  // Draw overlay (selection marching ants)
  const redrawOverlay = useCallback((selection: SelectionRect | null) => {
    const canvas = overlayCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = spriteW || 1
    const h = spriteH || 1
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, w, h)

    if (selection) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1 / Math.max(1, w / EDITOR_DISPLAY_SIZE)
      ctx.setLineDash([2 / Math.max(1, w / EDITOR_DISPLAY_SIZE), 2 / Math.max(1, w / EDITOR_DISPLAY_SIZE)])
      ctx.strokeRect(selection.x, selection.y, selection.w, selection.h)
      ctx.setLineDash([])
    }
  }, [spriteW, spriteH])

  const paintAt = useCallback(
    (px: number, py: number) => {
      const w = spriteWRef.current
      const h = spriteHRef.current
      const buf = workingBufferRef.current
      if (!buf) return

      const brushOffsets = generateBrushStamp(brushSizeRef.current, brushShapeRef.current, customBrushRef.current)
      const wrap = wrapAroundRef.current
      const tool = activeToolRef.current
      const isDither = brushShapeRef.current === 'dither'
      const data = buf.data

      // Snap-to-palette: find nearest palette color
      let [r, g, b, a] = activeRgbaRef.current
      if (snapToPaletteRef.current && paletteRef.current.length > 0 && tool !== 'erase') {
        let best = Infinity
        let bestRgba = [r, g, b, a]
        for (const { hex } of paletteRef.current) {
          const [pr, pg, pb, pa] = hexToRgba(hex)
          const dist = Math.abs(pr - r) + Math.abs(pg - g) + Math.abs(pb - b) + Math.abs(pa - a)
          if (dist < best) {
            best = dist
            bestRgba = [pr, pg, pb, pa]
          }
        }
        ;[r, g, b, a] = bestRgba
      }

      // Spray tool: randomly scatter pixels within brush radius
      if (tool === 'spray') {
        const radius = Math.max(2, brushSizeRef.current * 2)
        const count = Math.max(1, Math.floor(radius * radius * 0.25))
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2
          const dist = Math.random() * radius
          const spx = px + Math.round(Math.cos(angle) * dist)
          const spy = py + Math.round(Math.sin(angle) * dist)
          const points = getMirroredPixelsRef.current(spx, spy)
          for (const pt of points) {
            const wx = wrap ? mod(pt.px, w) : pt.px
            const wy = wrap ? mod(pt.py, h) : pt.py
            if (wx < 0 || wx >= w || wy < 0 || wy >= h) continue
            const idx = (wy * w + wx) * 4
            if (lockAlphaRef.current && data[idx + 3] === 0) continue
            data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = a
          }
        }
        redrawRef.current()
        return
      }

      for (const { dx, dy } of brushOffsets) {
        const brushPx = px + dx
        const brushPy = py + dy
        if (isDither && (brushPx + brushPy) % 2 !== 0) continue
        const points = getMirroredPixelsRef.current(brushPx, brushPy)

        for (const pt of points) {
          const wx = wrap ? mod(pt.px, w) : pt.px
          const wy = wrap ? mod(pt.py, h) : pt.py
          if (wx < 0 || wx >= w || wy < 0 || wy >= h) continue
          const idx = (wy * w + wx) * 4

          if (lockAlphaRef.current && data[idx + 3] === 0) continue

          if (tool === 'erase') {
            data[idx] = 0
            data[idx + 1] = 0
            data[idx + 2] = 0
            data[idx + 3] = 0
          } else {
            data[idx] = r
            data[idx + 1] = g
            data[idx + 2] = b
            data[idx + 3] = a
          }
        }
      }

      redrawRef.current()
    },
    [],
  )

  const performFill = useCallback(
    (px: number, py: number) => {
      const current = tileDataRef.current
      if (!current) return

      const points = getMirroredPixelsRef.current(px, py)
      let data = current

      const rgba = activeRgbaRef.current
      for (const pt of points) {
        if (pt.px < 0 || pt.px >= current.width || pt.py < 0 || pt.py >= current.height) continue
        data = floodFill(data, pt.px, pt.py, rgba, 0)
      }

      onTileDataChangeRef.current(data)
    },
    [],
  )

  const performEyedrop = useCallback(
    (px: number, py: number) => {
      const current = displayDataRef.current ?? tileDataRef.current
      if (!current) return
      if (px < 0 || px >= current.width || py < 0 || py >= current.height) return

      const idx = (py * current.width + px) * 4
      const r = current.data[idx]
      const g = current.data[idx + 1]
      const b = current.data[idx + 2]
      const a = current.data[idx + 3]
      onColorChangeRef.current(rgbaToHex(r, g, b, a))
    },
    [],
  )

  const performColorReplace = useCallback(
    (px: number, py: number) => {
      const current = tileDataRef.current
      if (!current) return
      if (px < 0 || px >= current.width || py < 0 || py >= current.height) return

      const srcIdx = (py * current.width + px) * 4
      const sr = current.data[srcIdx]
      const sg = current.data[srcIdx + 1]
      const sb = current.data[srcIdx + 2]
      const sa = current.data[srcIdx + 3]

      const [tr, tg, tb, ta] = activeRgbaRef.current
      const result = new ImageData(new Uint8ClampedArray(current.data), current.width, current.height)
      const d = result.data

      for (let i = 0; i < d.length; i += 4) {
        if (d[i] === sr && d[i + 1] === sg && d[i + 2] === sb && d[i + 3] === sa) {
          d[i] = tr; d[i + 1] = tg; d[i + 2] = tb; d[i + 3] = ta
        }
      }

      onTileDataChangeRef.current(result)
      onStrokeCommitRef.current()
    },
    [],
  )

  const commitTextAtPixel = useCallback(
    (text: string, px: number, py: number) => {
      const current = tileDataRef.current
      if (!current || !text.trim()) return
      const result = renderText(text, current, px, py, rgbaToHex(...activeRgbaRef.current))
      onTileDataChangeRef.current(result)
      onStrokeCommitRef.current()
    },
    [],
  )

  // Wrappers that bind in current refs for the pure draw functions
  const drawLineOnData = useCallback(
    (data: ImageData, x0: number, y0: number, x1: number, y1: number) =>
      drawLinePure(data, x0, y0, x1, y1, activeRgbaRef.current, getMirroredPixelsRef.current),
    [],
  )

  const drawRectOnData = useCallback(
    (data: ImageData, x0: number, y0: number, x1: number, y1: number, filled: boolean) =>
      drawRectPure(data, x0, y0, x1, y1, filled, activeRgbaRef.current, getMirroredPixelsRef.current),
    [],
  )

  const drawEllipseOnData = useCallback(
    (data: ImageData, x0: number, y0: number, x1: number, y1: number, filled: boolean) =>
      drawEllipsePure(data, x0, y0, x1, y1, filled, activeRgbaRef.current, getMirroredPixelsRef.current),
    [],
  )

  const handleRotate = useCallback((dir: 'cw' | 'ccw') => {
    if (!tileData) return
    onTileDataChange(rotateImageData90(tileData, dir))
  }, [tileData, onTileDataChange])

  const handleFlip = useCallback((axis: 'horizontal' | 'vertical') => {
    if (!tileData) return
    onTileDataChange(flipImageData(tileData, axis))
  }, [tileData, onTileDataChange])

  const handleDownload = useCallback(() => {
    if (!tileData) return
    const tmp = document.createElement('canvas')
    tmp.width = tileData.width
    tmp.height = tileData.height
    const ctx = tmp.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    ctx.putImageData(tileData, 0, 0)

    const link = document.createElement('a')
    link.download = `tile_${tileData.width}x${tileData.height}.png`
    link.href = tmp.toDataURL('image/png')
    link.click()
  }, [tileData])

  const handleLoadRef = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new window.Image()
      img.onload = () => setRefImage(img)
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [])

  const {
    containerRef,
    zoom,
    offset,
    isPanning,
    selection,
    selectionContent,
    isOverSelection,
    nudge,
    fitView,
    handleWheel,
    handleContainerMouseDown: _handleContainerMouseDown,
    handleContainerMouseMove,
    handleContainerMouseUp,
    handleContainerMouseLeave,
  } = usePixelEditorInput({
    tileData,
    spriteW,
    spriteH,
    selectionMode,
    magicTolerance,
    wrapAround,
    isDrawingRef,
    isPaintDrawingRef,
    workingBufferRef,
    activeToolRef,
    tileDataRef,
    paintAt,
    performFill,
    performEyedrop,
    performColorReplace,
    drawLineOnData,
    drawRectOnData,
    drawEllipseOnData,
    onTileDataChange,
    onTileDataChangeRef,
    onStrokeCommitRef,
    onToolChangeRef,
  })

  // Wrap mouseDown to intercept text tool clicks
  const handleContainerMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'text' && tileData) {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const canvasX = (e.clientX - rect.left - offset.x) / zoom
      const canvasY = (e.clientY - rect.top - offset.y) / zoom
      const px = Math.floor(canvasX)
      const py = Math.floor(canvasY)
      if (px >= 0 && px < tileData.width && py >= 0 && py < tileData.height) {
        // Position the floating input at the click spot (in screen coords)
        setTextToolPos({ x: e.clientX - rect.left, y: e.clientY - rect.top, px, py })
        setTextInput('')
        setTimeout(() => textInputRef.current?.focus(), 0)
      }
      return
    }
    _handleContainerMouseDown(e)
  }, [activeTool, tileData, zoom, offset, _handleContainerMouseDown])

  // Redraw overlay whenever selection changes
  useEffect(() => {
    redrawOverlay(selection)
  }, [redrawOverlay, selection])

  // Copy selection to clipboard when selectionContent changes (used in SpriteBank etc.)
  // This is a no-op side-effect; selection is read from hook return
  void selectionContent

  const cursorStyle = (() => {
    if (!tileData) return 'default'
    switch (activeTool) {
      case 'eyedropper': return 'crosshair'
      case 'selection': return isOverSelection ? 'move' : 'crosshair'
      case 'text': return 'text'
      default: return 'crosshair'
    }
  })()

  return (
    <div className="p-3 border-b border-border-default">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Pixel Editor
      </h3>

      <PixelEditorControls
        symmetryV={symmetryV} setSymmetryV={setSymmetryV}
        symmetryH={symmetryH} setSymmetryH={setSymmetryH}
        wrapAround={wrapAround} setWrapAround={setWrapAround}
        onionSkin={onionSkin} setOnionSkin={setOnionSkin}
        onionSkinData={onionSkinData}
        lockAlpha={lockAlpha} setLockAlpha={setLockAlpha}
        showTiling={showTiling} setShowTiling={setShowTiling}
        spriteW={spriteW} spriteH={spriteH} zoom={zoom}
        nudge={nudge} fitView={fitView}
        handleRotate={handleRotate} handleFlip={handleFlip}
        refImage={refImage} setRefImage={setRefImage}
        refOpacity={refOpacity} setRefOpacity={setRefOpacity}
        showRef={showRef} setShowRef={setShowRef}
        refInputRef={refInputRef} handleLoadRef={handleLoadRef}
        tileData={tileData} onClear={onClear} handleDownload={handleDownload}
        isEditingBank={isEditingBank} onSaveToBank={onSaveToBank} onUpdateInBank={onUpdateInBank}
        onOutlineEffect={onOutlineEffect} onOpenResize={onOpenResize}
      />

      {/* Canvas wrapper */}
      <div
        ref={containerRef}
        className="relative mx-auto border border-border-default rounded overflow-hidden"
        style={{
          width: 256,
          height: 256,
          background: '#0a0a0a',
          cursor: isPanning ? 'grabbing' : cursorStyle,
        }}
        onWheel={handleWheel}
        onMouseDown={handleContainerMouseDown}
        onMouseMove={handleContainerMouseMove}
        onMouseUp={handleContainerMouseUp}
        onMouseLeave={handleContainerMouseLeave}
      >
        {/* Tiling preview: 3x3 grid overlay outside the sprite */}
        {showTiling && tileData && (
          <TilingPreview data={compositeData ?? tileData} spriteW={spriteW} spriteH={spriteH} zoom={zoom} offset={offset} />
        )}

        {/* Text tool floating input */}
        {textToolPos && (
          <input
            ref={textInputRef}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitTextAtPixel(textInput, textToolPos.px, textToolPos.py)
                setTextToolPos(null)
                setTextInput('')
              } else if (e.key === 'Escape') {
                setTextToolPos(null)
                setTextInput('')
              }
              e.stopPropagation()
            }}
            onBlur={() => {
              if (textInput.trim()) commitTextAtPixel(textInput, textToolPos.px, textToolPos.py)
              setTextToolPos(null)
              setTextInput('')
            }}
            style={{
              position: 'absolute',
              left: textToolPos.x,
              top: textToolPos.y,
              background: 'rgba(0,0,0,0.7)',
              color: activeColor,
              border: `1px solid ${activeColor}`,
              fontSize: 12,
              padding: '2px 4px',
              zIndex: 10,
              minWidth: 60,
            }}
            className="outline-none font-mono text-xs"
            placeholder="type text…"
          />
        )}

        {tileData && (
          <div
            style={{
              position: 'absolute',
              left: offset.x,
              top: offset.y,
              width: spriteW * zoom,
              height: spriteH * zoom,
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
                  50% / ${Math.max(8, 16 * zoom)}px ${Math.max(8, 16 * zoom)}px
                `,
              }}
            />
            <canvas
              ref={overlayCanvasRef}
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

            {/* Symmetry guides */}
            {symmetryV && (() => {
              const isOdd = spriteW % 2 === 1
              const centerPx = Math.floor(spriteW / 2)
              const leftPos = isOdd ? (centerPx + 0.5) * zoom : centerPx * zoom
              const widthPx = isOdd ? zoom : 1
              return (
                <div className="absolute top-0 bottom-0 pointer-events-none" style={{
                  left: leftPos, width: widthPx,
                  background: isOdd ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.5)',
                }} />
              )
            })()}
            {symmetryH && (() => {
              const isOdd = spriteH % 2 === 1
              const centerPx = Math.floor(spriteH / 2)
              const topPos = isOdd ? (centerPx + 0.5) * zoom : centerPx * zoom
              const heightPx = isOdd ? zoom : 1
              return (
                <div className="absolute left-0 right-0 pointer-events-none" style={{
                  top: topPos, height: heightPx,
                  background: isOdd ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.5)',
                }} />
              )
            })()}

            {wrapAround && (
              <div className="absolute inset-0 pointer-events-none"
                style={{ border: `${Math.max(1, 2 * zoom)}px dashed rgba(34, 197, 94, 0.4)` }} />
            )}
          </div>
        )}

        {!tileData && (
          <div className="absolute inset-0 flex items-center justify-center text-text-muted text-xs text-center px-4 pointer-events-none">
            Click a tile in the tileset to extract it here
          </div>
        )}
      </div>
    </div>
  )
}
