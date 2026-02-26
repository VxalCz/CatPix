import { useRef, useEffect, useCallback, useState } from 'react'
import {
  Trash2, Download, FlipHorizontal2, FlipVertical2,
  Save, Repeat, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Layers, Plus,
  RotateCw, RotateCcw, ImageIcon,
} from 'lucide-react'
import type { Tool } from '../state/appReducer'
import { useSymmetry } from '../hooks/useSymmetry'
import { floodFill } from '../utils/floodFill'
import { bresenhamLine } from '../utils/lineBresenham'
import { copyRegion, pasteRegion, clearRegion, type SelectionRect } from '../utils/selection'
import { rotateImageData90, flipImageData } from '../utils/transform'

interface PixelEditorProps {
  tileData: ImageData | null
  compositeData?: ImageData | null  // flattened layers for display
  activeTool: Tool
  activeColor: string
  onionSkinData: ImageData | null
  isEditingBank: boolean
  onClear: () => void
  onTileDataChange: (data: ImageData) => void
  onStrokeCommit: () => void
  onColorChange: (color: string) => void
  onToolChange: (tool: Tool) => void
  onSaveToBank: () => void
  onUpdateInBank: () => void
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

function rgbaToHex(r: number, g: number, b: number, a: number): string {
  const hex = [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
  if (a < 255) return `#${hex}${a.toString(16).padStart(2, '0')}`
  return `#${hex}`
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

export function PixelEditor({
  tileData,
  compositeData,
  activeTool,
  activeColor,
  onionSkinData,
  isEditingBank,
  onClear,
  onTileDataChange,
  onStrokeCommit,
  onColorChange,
  onToolChange,
  onSaveToBank,
  onUpdateInBank,
}: PixelEditorProps) {
  // displayData is what we render on the canvas (composite of all layers)
  // tileData is the active layer's data (what paint operations target)
  const displayData = compositeData ?? tileData
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)

  // Working buffer: mutated in-place during drag, committed on mouseup
  const workingBufferRef = useRef<ImageData | null>(null)

  // Reusable offscreen canvases for redraw (avoid creating new ones each frame)
  const onionSkinCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const displayCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))

  // Cached active color as RGBA tuple
  const activeRgbaRef = useRef<[number, number, number, number]>([0, 0, 0, 255])

  // Ref to redraw function for use in paintAt without re-creating callback
  const redrawRef = useRef<() => void>(() => {})

  const [symmetryH, setSymmetryH] = useState(false)
  const [symmetryV, setSymmetryV] = useState(false)
  const [wrapAround, setWrapAround] = useState(false)
  const [onionSkin, setOnionSkin] = useState(false)

  // Reference image
  const [refImage, setRefImage] = useState<HTMLImageElement | null>(null)
  const [refOpacity, setRefOpacity] = useState(0.3)
  const [showRef, setShowRef] = useState(true)
  const refInputRef = useRef<HTMLInputElement>(null)

  // Alt-key eyedropper state
  const altKeyRef = useRef(false)
  const previousToolRef = useRef<Tool | null>(null)

  // Line/rect tool state
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null)
  const preShapeDataRef = useRef<ImageData | null>(null)

  // Selection state
  const [selection, setSelection] = useState<SelectionRect | null>(null)
  const [selectionContent, setSelectionContent] = useState<ImageData | null>(null)
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null)
  const movingSelRef = useRef(false)
  const moveStartRef = useRef<{ x: number; y: number } | null>(null)
  const clipboardRef = useRef<{ data: ImageData; rect: SelectionRect } | null>(null)

  const spriteW = tileData?.width ?? 0
  const spriteH = tileData?.height ?? 0

  const wrapAroundRef = useRef(wrapAround)
  const spriteWRef = useRef(spriteW)
  const spriteHRef = useRef(spriteH)
  const activeToolRef = useRef(activeTool)
  const activeColorRef = useRef(activeColor)
  const tileDataRef = useRef(tileData)

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

  const selectionRef = useRef(selection)
  const selectionContentRef = useRef(selectionContent)

  useEffect(() => {
    wrapAroundRef.current = wrapAround
    spriteWRef.current = spriteW
    spriteHRef.current = spriteH
    activeToolRef.current = activeTool
    activeColorRef.current = activeColor
    activeRgbaRef.current = hexToRgba(activeColor)
    tileDataRef.current = tileData
    // Keep working buffer in sync with tileData when not mid-stroke
    if (!isDrawingRef.current) {
      workingBufferRef.current = tileData
    }
    getMirroredPixelsRef.current = getMirroredPixels
    onTileDataChangeRef.current = onTileDataChange
    onStrokeCommitRef.current = onStrokeCommit
    onColorChangeRef.current = onColorChange
    onToolChangeRef.current = onToolChange
    selectionRef.current = selection
    selectionContentRef.current = selectionContent
  }, [wrapAround, spriteW, spriteH, activeTool, activeColor, tileData,
      getMirroredPixels, onTileDataChange, onStrokeCommit, onColorChange,
      onToolChange, selection, selectionContent])

  // Draw main canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = spriteW || 1
    const h = spriteH || 1

    // Guard dimension assignment to avoid context reset
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, w, h)

    // Reference image (behind everything)
    if (showRef && refImage) {
      ctx.globalAlpha = refOpacity
      ctx.drawImage(refImage, 0, 0, w, h)
      ctx.globalAlpha = 1.0
    }

    // Onion skin — reuse offscreen canvas
    if (onionSkin && onionSkinData) {
      const tmp = onionSkinCanvasRef.current
      if (tmp.width !== onionSkinData.width) tmp.width = onionSkinData.width
      if (tmp.height !== onionSkinData.height) tmp.height = onionSkinData.height
      const tmpCtx = tmp.getContext('2d')!
      tmpCtx.putImageData(onionSkinData, 0, 0)
      ctx.globalAlpha = 0.3
      ctx.drawImage(tmp, 0, 0)
      ctx.globalAlpha = 1.0
    }

    // Show composite (all layers flattened) for display, or working buffer during drag
    const dataToShow = (isDrawingRef.current ? workingBufferRef.current : null) ?? displayData ?? tileData
    if (dataToShow) {
      const tmp = displayCanvasRef.current
      if (tmp.width !== dataToShow.width) tmp.width = dataToShow.width
      if (tmp.height !== dataToShow.height) tmp.height = dataToShow.height
      const tmpCtx = tmp.getContext('2d')!
      tmpCtx.putImageData(dataToShow, 0, 0)
      ctx.drawImage(tmp, 0, 0)
    }
  }, [displayData, tileData, spriteW, spriteH, onionSkin, onionSkinData, showRef, refImage, refOpacity])

  useEffect(() => {
    redrawRef.current = redraw
    redraw()
  }, [redraw])

  // Draw overlay (selection marching ants, shape preview)
  const redrawOverlay = useCallback(() => {
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

    // Marching ants for selection
    if (selection) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1 / Math.max(1, w / EDITOR_DISPLAY_SIZE)
      ctx.setLineDash([2 / Math.max(1, w / EDITOR_DISPLAY_SIZE), 2 / Math.max(1, w / EDITOR_DISPLAY_SIZE)])
      ctx.strokeRect(selection.x, selection.y, selection.w, selection.h)
      ctx.setLineDash([])
    }
  }, [selection, spriteW, spriteH])

  useEffect(() => {
    redrawOverlay()
  }, [redrawOverlay])

  const getRawPixelCoords = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const scaleX = spriteWRef.current / rect.width
      const scaleY = spriteHRef.current / rect.height
      const rawX = Math.floor((clientX - rect.left) * scaleX)
      const rawY = Math.floor((clientY - rect.top) * scaleY)
      return { rawX, rawY }
    },
    [],
  )

  const resolveCoords = useCallback(
    (rawX: number, rawY: number) => {
      const w = spriteWRef.current
      const h = spriteHRef.current
      if (wrapAroundRef.current) {
        return { px: mod(rawX, w), py: mod(rawY, h) }
      }
      if (rawX < 0 || rawX >= w || rawY < 0 || rawY >= h) return null
      return { px: rawX, py: rawY }
    },
    [],
  )

  const paintAt = useCallback(
    (px: number, py: number) => {
      const w = spriteWRef.current
      const h = spriteHRef.current
      const buf = workingBufferRef.current
      if (!buf) return

      const points = getMirroredPixelsRef.current(px, py)
      const wrap = wrapAroundRef.current
      const tool = activeToolRef.current
      const [r, g, b, a] = activeRgbaRef.current
      const data = buf.data

      for (const pt of points) {
        const wx = wrap ? mod(pt.px, w) : pt.px
        const wy = wrap ? mod(pt.py, h) : pt.py
        if (wx < 0 || wx >= w || wy < 0 || wy >= h) continue
        const idx = (wy * w + wx) * 4

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

      // Redraw canvas directly without React dispatch
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
      const current = tileDataRef.current
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

  const drawLineOnData = useCallback(
    (data: ImageData, x0: number, y0: number, x1: number, y1: number) => {
      const result = new ImageData(new Uint8ClampedArray(data.data), data.width, data.height)
      const linePoints = bresenhamLine(x0, y0, x1, y1)
      const [r, g, b, a] = activeRgbaRef.current
      const w = data.width
      const h = data.height

      for (const { x, y } of linePoints) {
        const mirrored = getMirroredPixelsRef.current(x, y)
        for (const pt of mirrored) {
          if (pt.px < 0 || pt.px >= w || pt.py < 0 || pt.py >= h) continue
          const idx = (pt.py * w + pt.px) * 4
          result.data[idx] = r
          result.data[idx + 1] = g
          result.data[idx + 2] = b
          result.data[idx + 3] = a
        }
      }
      return result
    },
    [],
  )

  const drawRectOnData = useCallback(
    (data: ImageData, x0: number, y0: number, x1: number, y1: number, filled: boolean) => {
      const result = new ImageData(new Uint8ClampedArray(data.data), data.width, data.height)
      const [r, g, b, a] = activeRgbaRef.current
      const w = data.width
      const h = data.height

      const minX = Math.max(0, Math.min(x0, x1))
      const maxX = Math.min(w - 1, Math.max(x0, x1))
      const minY = Math.max(0, Math.min(y0, y1))
      const maxY = Math.min(h - 1, Math.max(y0, y1))

      const setPixel = (px: number, py: number) => {
        const mirrored = getMirroredPixelsRef.current(px, py)
        for (const pt of mirrored) {
          if (pt.px < 0 || pt.px >= w || pt.py < 0 || pt.py >= h) continue
          const idx = (pt.py * w + pt.px) * 4
          result.data[idx] = r
          result.data[idx + 1] = g
          result.data[idx + 2] = b
          result.data[idx + 3] = a
        }
      }

      if (filled) {
        for (let y2 = minY; y2 <= maxY; y2++) {
          for (let x2 = minX; x2 <= maxX; x2++) {
            setPixel(x2, y2)
          }
        }
      } else {
        for (let x2 = minX; x2 <= maxX; x2++) {
          setPixel(x2, minY)
          setPixel(x2, maxY)
        }
        for (let y2 = minY; y2 <= maxY; y2++) {
          setPixel(minX, y2)
          setPixel(maxX, y2)
        }
      }

      return result
    },
    [],
  )

  // Handle Alt key for temporary eyedropper
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt' && !altKeyRef.current) {
        altKeyRef.current = true
        if (activeToolRef.current !== 'eyedropper') {
          previousToolRef.current = activeToolRef.current
          onToolChangeRef.current('eyedropper')
        }
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt' && altKeyRef.current) {
        altKeyRef.current = false
        if (previousToolRef.current !== null) {
          onToolChangeRef.current(previousToolRef.current)
          previousToolRef.current = null
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Selection keyboard handlers
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (!tileDataRef.current) return

      const sel = selectionRef.current
      const content = selectionContentRef.current

      // Delete selected region
      if (e.key === 'Delete' && sel) {
        e.preventDefault()
        const cleared = clearRegion(tileDataRef.current, sel)
        onTileDataChangeRef.current(cleared)
        setSelection(null)
        setSelectionContent(null)
        return
      }

      // Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && sel) {
        e.preventDefault()
        clipboardRef.current = {
          data: copyRegion(tileDataRef.current, sel),
          rect: sel,
        }
        return
      }

      // Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboardRef.current) {
        e.preventDefault()
        const clip = clipboardRef.current
        const pasted = pasteRegion(tileDataRef.current, clip.data, clip.rect.x, clip.rect.y)
        onTileDataChangeRef.current(pasted)
        setSelection(clip.rect)
        setSelectionContent(clip.data)
        return
      }

      // Arrow keys to move selection content
      if (sel && content && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        let dx = 0, dy = 0
        if (e.key === 'ArrowUp') dy = -1
        if (e.key === 'ArrowDown') dy = 1
        if (e.key === 'ArrowLeft') dx = -1
        if (e.key === 'ArrowRight') dx = 1

        const newRect = { ...sel, x: sel.x + dx, y: sel.y + dy }
        // Clear old position, paste at new position
        const cleared = clearRegion(tileDataRef.current, sel)
        const pasted = pasteRegion(cleared, content, newRect.x, newRect.y)
        onTileDataChangeRef.current(pasted)
        setSelection(newRect)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Global mouse move/up for drawing
  useEffect(() => {
    const shiftKeyRef = { current: false }

    const handleKeyState = (e: KeyboardEvent | MouseEvent) => {
      shiftKeyRef.current = e.shiftKey
    }

    const handleWindowMouseMove = (e: MouseEvent) => {
      handleKeyState(e)
      if (!isDrawingRef.current) return
      const raw = getRawPixelCoords(e.clientX, e.clientY)
      if (!raw) return
      const tool = activeToolRef.current

      if (tool === 'draw' || tool === 'erase') {
        const coords = resolveCoords(raw.rawX, raw.rawY)
        if (coords) paintAt(coords.px, coords.py)
        return
      }

      if (tool === 'line' || tool === 'rectangle') {
        const start = shapeStartRef.current
        const baseData = preShapeDataRef.current
        if (!start || !baseData) return
        const coords = resolveCoords(raw.rawX, raw.rawY)
        if (!coords) return

        let preview: ImageData
        if (tool === 'line') {
          preview = drawLineOnData(baseData, start.x, start.y, coords.px, coords.py)
        } else {
          preview = drawRectOnData(baseData, start.x, start.y, coords.px, coords.py, shiftKeyRef.current)
        }
        onTileDataChangeRef.current(preview)
        return
      }

      if (tool === 'selection') {
        const start = selectionStartRef.current
        if (!start) return

        if (movingSelRef.current) {
          // Moving selection
          const moveStart = moveStartRef.current
          if (!moveStart) return
          const dx = raw.rawX - moveStart.x
          const dy = raw.rawY - moveStart.y
          const sel = selectionRef.current
          if (!sel) return
          const newRect = { ...sel, x: sel.x + dx, y: sel.y + dy }
          setSelection(newRect)
          moveStartRef.current = { x: raw.rawX, y: raw.rawY }
          // Re-composite: clear old, paste at new
          const content = selectionContentRef.current
          if (content) {
            const base = preShapeDataRef.current
            if (base) {
              const pasted = pasteRegion(base, content, newRect.x, newRect.y)
              onTileDataChangeRef.current(pasted)
            }
          }
        } else {
          // Drawing selection box
          const x = Math.min(start.x, raw.rawX)
          const y = Math.min(start.y, raw.rawY)
          const w = Math.abs(raw.rawX - start.x) + 1
          const h = Math.abs(raw.rawY - start.y) + 1
          setSelection({ x, y, w, h })
        }
        return
      }
    }

    const handleWindowMouseUp = () => {
      const tool = activeToolRef.current
      const wasDrawing = isDrawingRef.current

      // Commit shape on mouseup
      if (tool === 'line' || tool === 'rectangle') {
        shapeStartRef.current = null
        preShapeDataRef.current = null
      }

      if (tool === 'selection') {
        selectionStartRef.current = null
        movingSelRef.current = false
        moveStartRef.current = null
        // After drawing selection, capture content
        const sel = selectionRef.current
        if (sel && tileDataRef.current && !selectionContentRef.current) {
          setSelectionContent(copyRegion(tileDataRef.current, sel))
        }
      }

      isDrawingRef.current = false

      // Commit working buffer to React state at end of stroke
      if (wasDrawing && (tool === 'draw' || tool === 'erase')) {
        const buf = workingBufferRef.current
        if (buf) {
          onTileDataChangeRef.current(buf)
          onStrokeCommitRef.current()
        }
      }
      // Commit undo snapshot for shape tools (they already dispatch per-move via onTileDataChange)
      if (wasDrawing && (tool === 'line' || tool === 'rectangle')) {
        onStrokeCommitRef.current()
      }
    }

    window.addEventListener('mousemove', handleWindowMouseMove)
    window.addEventListener('mouseup', handleWindowMouseUp)
    window.addEventListener('keydown', handleKeyState as EventListener)
    window.addEventListener('keyup', handleKeyState as EventListener)
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove)
      window.removeEventListener('mouseup', handleWindowMouseUp)
      window.removeEventListener('keydown', handleKeyState as EventListener)
      window.removeEventListener('keyup', handleKeyState as EventListener)
    }
  }, [getRawPixelCoords, resolveCoords, paintAt, drawLineOnData, drawRectOnData])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0 || !tileDataRef.current) return
      const raw = getRawPixelCoords(e.clientX, e.clientY)
      if (!raw) return
      const coords = resolveCoords(raw.rawX, raw.rawY)
      if (!coords) return

      const tool = activeToolRef.current

      if (tool === 'draw' || tool === 'erase') {
        isDrawingRef.current = true
        // Clone tileData into working buffer for in-place mutation during drag
        const current = tileDataRef.current!
        workingBufferRef.current = new ImageData(
          new Uint8ClampedArray(current.data), current.width, current.height,
        )
        paintAt(coords.px, coords.py)
        return
      }

      if (tool === 'fill') {
        performFill(coords.px, coords.py)
        onStrokeCommitRef.current()
        return
      }

      if (tool === 'eyedropper') {
        performEyedrop(coords.px, coords.py)
        return
      }

      if (tool === 'line' || tool === 'rectangle') {
        isDrawingRef.current = true
        shapeStartRef.current = { x: coords.px, y: coords.py }
        preShapeDataRef.current = new ImageData(
          new Uint8ClampedArray(tileDataRef.current!.data),
          tileDataRef.current!.width,
          tileDataRef.current!.height,
        )
        return
      }

      if (tool === 'selection') {
        isDrawingRef.current = true
        const sel = selectionRef.current

        // If clicking inside existing selection, start moving
        if (sel && selectionContentRef.current &&
          coords.px >= sel.x && coords.px < sel.x + sel.w &&
          coords.py >= sel.y && coords.py < sel.y + sel.h) {
          movingSelRef.current = true
          moveStartRef.current = { x: raw.rawX, y: raw.rawY }
          // Store base (with selection region cleared)
          preShapeDataRef.current = clearRegion(tileDataRef.current!, sel)
          return
        }

        // Start new selection
        selectionStartRef.current = { x: coords.px, y: coords.py }
        setSelection(null)
        setSelectionContent(null)
        return
      }
    },
    [getRawPixelCoords, resolveCoords, paintAt, performFill, performEyedrop],
  )

  // Nudge
  const nudge = useCallback(
    (dx: number, dy: number) => {
      if (!tileData) return
      const w = tileData.width
      const h = tileData.height
      const src = tileData.data
      const dst = new Uint8ClampedArray(src.length)
      const wrap = wrapAround

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let sx = x - dx
          let sy = y - dy
          if (wrap) {
            sx = mod(sx, w)
            sy = mod(sy, h)
          }
          if (sx < 0 || sx >= w || sy < 0 || sy >= h) continue
          const srcIdx = (sy * w + sx) * 4
          const dstIdx = (y * w + x) * 4
          dst[dstIdx] = src[srcIdx]
          dst[dstIdx + 1] = src[srcIdx + 1]
          dst[dstIdx + 2] = src[srcIdx + 2]
          dst[dstIdx + 3] = src[srcIdx + 3]
        }
      }

      const newData = new ImageData(dst, w, h)
      onTileDataChange(newData)
    },
    [tileData, wrapAround, onTileDataChange],
  )

  const handleDownload = useCallback(() => {
    if (!tileData) return
    const tmp = document.createElement('canvas')
    tmp.width = tileData.width
    tmp.height = tileData.height
    const ctx = tmp.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.putImageData(tileData, 0, 0)

    const link = document.createElement('a')
    link.download = `tile_${tileData.width}x${tileData.height}.png`
    link.href = tmp.toDataURL('image/png')
    link.click()
  }, [tileData])

  // Transform handlers
  const handleRotate = useCallback((dir: 'cw' | 'ccw') => {
    if (!tileData) return
    onTileDataChange(rotateImageData90(tileData, dir))
  }, [tileData, onTileDataChange])

  const handleFlip = useCallback((axis: 'horizontal' | 'vertical') => {
    if (!tileData) return
    onTileDataChange(flipImageData(tileData, axis))
  }, [tileData, onTileDataChange])

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

  const cursorStyle = (() => {
    if (!tileData) return 'default'
    switch (activeTool) {
      case 'eyedropper': return 'crosshair'
      case 'selection': return selection ? 'move' : 'crosshair'
      default: return 'crosshair'
    }
  })()

  return (
    <div className="p-3 border-b border-border-default">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Pixel Editor
      </h3>

      {/* Mode toggles row 1 */}
      <div className="flex gap-1.5 mb-1.5">
        <button
          onClick={() => setSymmetryV((v) => !v)}
          className={`flex-1 flex items-center justify-center gap-1 px-1 py-1 rounded text-[11px] transition-colors cursor-pointer ${
            symmetryV ? 'bg-accent text-white' : 'bg-bg-hover text-text-secondary hover:text-text-primary'
          }`}
          title="Vertical symmetry (left/right mirror)"
          aria-label="Toggle vertical symmetry"
        >
          <FlipHorizontal2 size={12} />
          V-Sym
        </button>
        <button
          onClick={() => setSymmetryH((v) => !v)}
          className={`flex-1 flex items-center justify-center gap-1 px-1 py-1 rounded text-[11px] transition-colors cursor-pointer ${
            symmetryH ? 'bg-accent text-white' : 'bg-bg-hover text-text-secondary hover:text-text-primary'
          }`}
          title="Horizontal symmetry (top/bottom mirror)"
          aria-label="Toggle horizontal symmetry"
        >
          <FlipVertical2 size={12} />
          H-Sym
        </button>
      </div>
      {/* Mode toggles row 2 */}
      <div className="flex gap-1.5 mb-3">
        <button
          onClick={() => setWrapAround((v) => !v)}
          className={`flex-1 flex items-center justify-center gap-1 px-1 py-1 rounded text-[11px] transition-colors cursor-pointer ${
            wrapAround ? 'bg-green-600 text-white' : 'bg-bg-hover text-text-secondary hover:text-text-primary'
          }`}
          title="Seamless wrap-around"
          aria-label="Toggle wrap-around"
        >
          <Repeat size={12} />
          Wrap
        </button>
        <button
          onClick={() => setOnionSkin((v) => !v)}
          className={`flex-1 flex items-center justify-center gap-1 px-1 py-1 rounded text-[11px] transition-colors cursor-pointer ${
            onionSkin ? 'bg-purple-600 text-white' : 'bg-bg-hover text-text-secondary hover:text-text-primary'
          }`}
          title="Onion skinning: show previous frame as ghost"
          aria-label="Toggle onion skin"
        >
          <Layers size={12} />
          Onion
        </button>
      </div>

      {/* Canvas wrapper */}
      {(() => {
        const aspect = spriteW && spriteH ? spriteW / spriteH : 1
        const displayW = aspect >= 1 ? EDITOR_DISPLAY_SIZE : Math.round(EDITOR_DISPLAY_SIZE * aspect)
        const displayH = aspect >= 1 ? Math.round(EDITOR_DISPLAY_SIZE / aspect) : EDITOR_DISPLAY_SIZE
        return (
      <div
        className="relative mx-auto border border-border-default rounded"
        style={{
          width: displayW,
          height: displayH,
          background: `
            repeating-conic-gradient(#1a1a2e 0% 25%, #0f0f1e 0% 50%)
            50% / 16px 16px
          `,
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          style={{
            width: displayW,
            height: displayH,
            imageRendering: 'pixelated',
            cursor: cursorStyle,
          }}
        />
        {/* Overlay canvas for selection/preview */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 pointer-events-none"
          style={{
            width: displayW,
            height: displayH,
            imageRendering: 'pixelated',
          }}
        />

        {/* Symmetry guides */}
        {tileData && symmetryV && (() => {
          const isOdd = spriteW % 2 === 1
          const pixelDisplaySize = displayW / spriteW
          const centerPx = Math.floor(spriteW / 2)
          const leftPos = isOdd ? (centerPx + 0.5) * pixelDisplaySize : centerPx * pixelDisplaySize
          const widthPx = isOdd ? pixelDisplaySize : 1
          return (
            <div className="absolute top-0 bottom-0 pointer-events-none" style={{
              left: leftPos, width: widthPx,
              background: isOdd ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.5)',
            }} />
          )
        })()}
        {tileData && symmetryH && (() => {
          const isOdd = spriteH % 2 === 1
          const pixelDisplaySize = displayH / spriteH
          const centerPx = Math.floor(spriteH / 2)
          const topPos = isOdd ? (centerPx + 0.5) * pixelDisplaySize : centerPx * pixelDisplaySize
          const heightPx = isOdd ? pixelDisplaySize : 1
          return (
            <div className="absolute left-0 right-0 pointer-events-none" style={{
              top: topPos, height: heightPx,
              background: isOdd ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.5)',
            }} />
          )
        })()}

        {tileData && wrapAround && (
          <div className="absolute inset-0 pointer-events-none rounded"
            style={{ border: '2px dashed rgba(34, 197, 94, 0.4)' }} />
        )}

        {!tileData && (
          <div className="absolute inset-0 flex items-center justify-center text-text-muted text-xs text-center px-4 pointer-events-none">
            Click a tile in the tileset to extract it here
          </div>
        )}
      </div>
        )
      })()}

      {/* Nudge + info row */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-0.5">
          <span className="text-[10px] text-text-muted mr-1">Nudge</span>
          <button onClick={() => nudge(-1, 0)} disabled={!tileData}
            className="p-0.5 rounded bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed" title="Nudge left" aria-label="Nudge left">
            <ArrowLeft size={12} />
          </button>
          <div className="flex flex-col gap-0.5">
            <button onClick={() => nudge(0, -1)} disabled={!tileData}
              className="p-0.5 rounded bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed" title="Nudge up" aria-label="Nudge up">
              <ArrowUp size={12} />
            </button>
            <button onClick={() => nudge(0, 1)} disabled={!tileData}
              className="p-0.5 rounded bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed" title="Nudge down" aria-label="Nudge down">
              <ArrowDown size={12} />
            </button>
          </div>
          <button onClick={() => nudge(1, 0)} disabled={!tileData}
            className="p-0.5 rounded bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed" title="Nudge right" aria-label="Nudge right">
            <ArrowRight size={12} />
          </button>
        </div>
        <p className="text-xs text-text-muted">
          {spriteW}x{spriteH}
          {wrapAround && <span className="text-green-400 ml-1">wrap</span>}
          {onionSkin && onionSkinData && <span className="text-purple-400 ml-1">onion</span>}
        </p>
      </div>

      {/* Transform */}
      <div className="flex gap-1 mt-2">
        <button onClick={() => handleRotate('ccw')} disabled={!tileData}
          className="flex-1 flex items-center justify-center gap-0.5 p-1 rounded text-[10px] bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          title="Rotate CCW" aria-label="Rotate counter-clockwise">
          <RotateCcw size={12} />
        </button>
        <button onClick={() => handleRotate('cw')} disabled={!tileData}
          className="flex-1 flex items-center justify-center gap-0.5 p-1 rounded text-[10px] bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          title="Rotate CW" aria-label="Rotate clockwise">
          <RotateCw size={12} />
        </button>
        <button onClick={() => handleFlip('horizontal')} disabled={!tileData}
          className="flex-1 flex items-center justify-center gap-0.5 p-1 rounded text-[10px] bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          title="Flip H" aria-label="Flip horizontal">
          <FlipHorizontal2 size={12} />
        </button>
        <button onClick={() => handleFlip('vertical')} disabled={!tileData}
          className="flex-1 flex items-center justify-center gap-0.5 p-1 rounded text-[10px] bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          title="Flip V" aria-label="Flip vertical">
          <FlipVertical2 size={12} />
        </button>
      </div>

      {/* Reference image */}
      <div className="flex items-center gap-1 mt-2">
        <input ref={refInputRef} type="file" accept="image/*" className="hidden" onChange={handleLoadRef} />
        <button
          onClick={() => refInputRef.current?.click()}
          className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] transition-colors cursor-pointer ${
            refImage ? 'bg-blue-600 text-white' : 'bg-bg-hover text-text-secondary hover:text-text-primary'
          }`}
          title="Load reference image"
          aria-label="Load reference image"
        >
          <ImageIcon size={12} />
          Ref
        </button>
        {refImage && (
          <>
            <button
              onClick={() => setShowRef((v) => !v)}
              className={`px-1.5 py-1 rounded text-[10px] cursor-pointer ${
                showRef ? 'bg-blue-600 text-white' : 'bg-bg-hover text-text-secondary'
              }`}
              aria-label={showRef ? 'Hide reference' : 'Show reference'}
            >
              {showRef ? 'On' : 'Off'}
            </button>
            <input
              type="range"
              min={10}
              max={80}
              value={Math.round(refOpacity * 100)}
              onChange={(e) => setRefOpacity(Number(e.target.value) / 100)}
              className="flex-1 accent-accent"
              title={`Reference opacity: ${Math.round(refOpacity * 100)}%`}
            />
            <button
              onClick={() => { setRefImage(null); setShowRef(true) }}
              className="px-1 py-1 rounded text-[10px] bg-bg-hover text-text-muted hover:text-red-400 cursor-pointer"
              aria-label="Remove reference"
            >
              x
            </button>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-3">
        <button onClick={onClear} disabled={!tileData}
          className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors cursor-pointer bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
          title="Clear canvas" aria-label="Clear canvas">
          <Trash2 size={13} />
        </button>
        <button onClick={handleDownload} disabled={!tileData}
          className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors cursor-pointer bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
          title="Download PNG" aria-label="Download PNG">
          <Download size={13} />
        </button>
        {isEditingBank ? (
          <>
            <button onClick={onUpdateInBank} disabled={!tileData}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors cursor-pointer bg-green-600 text-white hover:bg-green-500 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Overwrite the sprite you opened from the bank" aria-label="Update sprite in bank">
              <Save size={13} />
              Update
            </button>
            <button onClick={onSaveToBank} disabled={!tileData}
              className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors cursor-pointer bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
              title="Save as a new sprite in the bank" aria-label="Save as new sprite">
              <Plus size={13} />
            </button>
          </>
        ) : (
          <button onClick={onSaveToBank} disabled={!tileData}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors cursor-pointer bg-green-600 text-white hover:bg-green-500 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Save to sprite bank">
            <Save size={13} />
            Save to Bank
          </button>
        )}
      </div>
    </div>
  )
}
