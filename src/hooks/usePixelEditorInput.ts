import { useRef, useEffect, useLayoutEffect, useCallback, useState } from 'react'
import { copyRegion, copyRegionMasked, pasteRegion, clearRegion, clearRegionMasked, type SelectionRect } from '../utils/selection'
import { magicWandSelect, maskToBoundingBox, type SelectionMask } from '../utils/magicWand'
import { mod } from '../utils/pixelEditorDraw'
import type { Tool } from '../state/appReducer'
import type { SelectionMode } from '../state/appReducer'

const ZOOM_MIN = 0.25
const ZOOM_MAX = 16
const ZOOM_STEP = 0.15

interface UsePixelEditorInputOptions {
  tileData: ImageData | null
  spriteW: number
  spriteH: number
  selectionMode: SelectionMode
  magicTolerance: number
  wrapAround: boolean
  isDrawingRef: React.MutableRefObject<boolean>
  isPaintDrawingRef: React.MutableRefObject<boolean>
  workingBufferRef: React.MutableRefObject<ImageData | null>
  activeToolRef: React.MutableRefObject<Tool>
  tileDataRef: React.MutableRefObject<ImageData | null>
  // Drawing callbacks (defined in PixelEditor, passed in):
  paintAt: (px: number, py: number) => void
  performFill: (px: number, py: number) => void
  performEyedrop: (px: number, py: number) => void
  performColorReplace: (px: number, py: number) => void
  drawLineOnData: (data: ImageData, x0: number, y0: number, x1: number, y1: number) => ImageData
  drawRectOnData: (data: ImageData, x0: number, y0: number, x1: number, y1: number, filled: boolean) => ImageData
  drawEllipseOnData: (data: ImageData, x0: number, y0: number, x1: number, y1: number, filled: boolean) => ImageData
  onTileDataChange: (data: ImageData) => void
  onTileDataChangeRef: React.MutableRefObject<(data: ImageData) => void>
  onStrokeCommitRef: React.MutableRefObject<() => void>
  onToolChangeRef: React.MutableRefObject<(tool: Tool) => void>
}

interface UsePixelEditorInputResult {
  containerRef: React.RefObject<HTMLDivElement | null>
  zoom: number
  offset: { x: number; y: number }
  isPanning: boolean
  mousePixelPos: { x: number; y: number } | null
  selection: SelectionRect | null
  selectionContent: ImageData | null
  isOverSelection: boolean
  nudge: (dx: number, dy: number) => void
  fitView: () => void
  handleWheel: (e: React.WheelEvent) => void
  handleContainerMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void
  handleContainerMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void
  handleContainerMouseUp: () => void
  handleContainerMouseLeave: () => void
}

/** Convert a lasso polygon path into a SelectionMask using ray-casting */
function lassoPathToMask(path: { x: number; y: number }[], w: number, h: number): SelectionMask {
  const data = new Uint8Array(w * h)
  if (path.length < 3) return { width: w, height: h, data }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let inside = false
      for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
        const xi = path[i].x, yi = path[i].y
        const xj = path[j].x, yj = path[j].y
        if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) {
          inside = !inside
        }
      }
      if (inside) data[y * w + x] = 1
    }
  }
  return { width: w, height: h, data }
}

export function usePixelEditorInput({
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
}: UsePixelEditorInputOptions): UsePixelEditorInputResult {
  const containerRef = useRef<HTMLDivElement>(null)

  // Zoom/pan state
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [mousePixelPos, setMousePixelPos] = useState<{ x: number; y: number } | null>(null)

  // Alt-key eyedropper
  const altKeyRef = useRef(false)
  const previousToolRef = useRef<Tool | null>(null)

  // Shape tool refs
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null)
  const preShapeDataRef = useRef<ImageData | null>(null)

  // Selection state + refs
  const [selection, setSelection] = useState<SelectionRect | null>(null)
  const [selectionContent, setSelectionContent] = useState<ImageData | null>(null)
  const selectionRef = useRef(selection)
  const selectionContentRef = useRef(selectionContent)
  const selectionMaskRef = useRef<SelectionMask | null>(null)
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null)
  const movingSelRef = useRef(false)
  const moveStartRef = useRef<{ x: number; y: number } | null>(null)
  const clipboardRef = useRef<{ data: ImageData; rect: SelectionRect } | null>(null)

  // Lasso path
  const lassoPathRef = useRef<{ x: number; y: number }[]>([])

  // Polygon tool state
  const [polygonPoints, setPolygonPoints] = useState<{ x: number; y: number }[]>([])
  const polygonPointsRef = useRef<{ x: number; y: number }[]>([])
  const polygonBaseDataRef = useRef<ImageData | null>(null)

  // Stable refs for values needed in event handlers
  const zoomRef = useRef(zoom)
  const offsetRef = useRef(offset)
  const panStartRef = useRef(panStart)
  const isPanningRef = useRef(isPanning)
  const wrapAroundRef = useRef(wrapAround)
  const spriteWRef = useRef(spriteW)
  const spriteHRef = useRef(spriteH)
  const selectionModeRef = useRef(selectionMode)
  const magicToleranceRef = useRef(magicTolerance)

  useLayoutEffect(() => {
    zoomRef.current = zoom
    offsetRef.current = offset
  }, [zoom, offset])

  useLayoutEffect(() => {
    panStartRef.current = panStart
    isPanningRef.current = isPanning
  }, [panStart, isPanning])

  useLayoutEffect(() => {
    wrapAroundRef.current = wrapAround
    spriteWRef.current = spriteW
    spriteHRef.current = spriteH
    selectionModeRef.current = selectionMode
    magicToleranceRef.current = magicTolerance
    selectionRef.current = selection
    selectionContentRef.current = selectionContent
    polygonPointsRef.current = polygonPoints
  }, [wrapAround, spriteW, spriteH, selectionMode, magicTolerance, selection, selectionContent, polygonPoints])

  const fitView = useCallback(() => {
    if (containerRef.current && spriteWRef.current > 0 && spriteHRef.current > 0) {
      const container = containerRef.current
      const containerW = container.clientWidth
      const containerH = container.clientHeight
      if (containerW > 0 && containerH > 0) {
        const fitZoom = Math.min(
          (containerW - 20) / spriteWRef.current,
          (containerH - 20) / spriteHRef.current,
          8,
        )
        const clampedZoom = Math.max(fitZoom, ZOOM_MIN)
        setZoom(clampedZoom)
        setOffset({
          x: (containerW - spriteWRef.current * clampedZoom) / 2,
          y: (containerH - spriteHRef.current * clampedZoom) / 2,
        })
      }
    }
  }, [])

  // Fit to view when tileData changes
  useEffect(() => {
    if (tileData && containerRef.current) {
      fitView()
    }
  }, [tileData, spriteW, spriteH, fitView])

  // Zoom-to-fit keyboard shortcut (0)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === '0' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        fitView()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [fitView])

  const getRawPixelCoords = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current
      if (!container) return null
      const rect = container.getBoundingClientRect()
      const canvasX = (clientX - rect.left - offsetRef.current.x) / zoomRef.current
      const canvasY = (clientY - rect.top - offsetRef.current.y) / zoomRef.current
      return { rawX: Math.floor(canvasX), rawY: Math.floor(canvasY) }
    },
    [],
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()

      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const factor = e.deltaY < 0 ? 1 + ZOOM_STEP : 1 / (1 + ZOOM_STEP)
      const newZoom = Math.min(Math.max(zoomRef.current * factor, ZOOM_MIN), ZOOM_MAX)

      setOffset({
        x: mouseX - (mouseX - offsetRef.current.x) * (newZoom / zoomRef.current),
        y: mouseY - (mouseY - offsetRef.current.y) * (newZoom / zoomRef.current),
      })
      setZoom(newZoom)
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

  const nudge = useCallback(
    (dx: number, dy: number) => {
      const current = tileDataRef.current
      if (!current) return
      const w = current.width
      const h = current.height
      const src = current.data
      const dst = new Uint8ClampedArray(src.length)
      const wrap = wrapAroundRef.current

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

      onTileDataChange(new ImageData(dst, w, h))
    },
    [tileDataRef, onTileDataChange],
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
  }, [activeToolRef, onToolChangeRef])

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
        const mask = selectionMaskRef.current
        const cleared = mask
          ? clearRegionMasked(tileDataRef.current, sel, mask)
          : clearRegion(tileDataRef.current, sel)
        onTileDataChangeRef.current(cleared)
        onStrokeCommitRef.current()
        setSelection(null)
        setSelectionContent(null)
        selectionMaskRef.current = null
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

        const newX = Math.max(0, Math.min(spriteWRef.current - sel.w, sel.x + dx))
        const newY = Math.max(0, Math.min(spriteHRef.current - sel.h, sel.y + dy))
        const newRect = { ...sel, x: newX, y: newY }
        const mask = selectionMaskRef.current
        const cleared = mask
          ? clearRegionMasked(tileDataRef.current, sel, mask)
          : clearRegion(tileDataRef.current, sel)
        const pasted = pasteRegion(cleared, content, newRect.x, newRect.y)
        onTileDataChangeRef.current(pasted)
        setSelection(newRect)
        selectionMaskRef.current = null // mask is now stale after move
        return
      }

      // Ctrl+A: select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        const w = spriteWRef.current
        const h = spriteHRef.current
        const allRect = { x: 0, y: 0, w, h }
        setSelection(allRect)
        setSelectionContent(copyRegion(tileDataRef.current, allRect))
        selectionMaskRef.current = null
        return
      }

      // Escape: deselect or cancel polygon
      if (e.key === 'Escape') {
        if (polygonPointsRef.current.length > 0) {
          e.preventDefault()
          if (polygonBaseDataRef.current) {
            onTileDataChangeRef.current(polygonBaseDataRef.current)
          }
          setPolygonPoints([])
          polygonBaseDataRef.current = null
          return
        }
        if (sel) {
          e.preventDefault()
          setSelection(null)
          setSelectionContent(null)
          selectionMaskRef.current = null
          return
        }
      }

      // Enter: finalize polygon
      if (e.key === 'Enter' && polygonPointsRef.current.length >= 2) {
        e.preventDefault()
        const pts = polygonPointsRef.current
        let result = polygonBaseDataRef.current
        if (!result) return
        for (let i = 0; i < pts.length - 1; i++) {
          result = drawLineOnData(result, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)
        }
        result = drawLineOnData(result, pts[pts.length - 1].x, pts[pts.length - 1].y, pts[0].x, pts[0].y)
        onTileDataChangeRef.current(result)
        onStrokeCommitRef.current()
        setPolygonPoints([])
        polygonBaseDataRef.current = null
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [tileDataRef, onTileDataChangeRef, drawLineOnData])

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

      if (tool === 'line' || tool === 'rectangle' || tool === 'ellipse') {
        const start = shapeStartRef.current
        const baseData = preShapeDataRef.current
        if (!start || !baseData) return
        const coords = resolveCoords(raw.rawX, raw.rawY)
        if (!coords) return

        let preview: ImageData
        if (tool === 'line') {
          preview = drawLineOnData(baseData, start.x, start.y, coords.px, coords.py)
        } else if (tool === 'rectangle') {
          preview = drawRectOnData(baseData, start.x, start.y, coords.px, coords.py, shiftKeyRef.current)
        } else {
          preview = drawEllipseOnData(baseData, start.x, start.y, coords.px, coords.py, shiftKeyRef.current)
        }
        onTileDataChangeRef.current(preview)
        return
      }

      if (tool === 'selection') {
        const start = selectionStartRef.current
        if (!start) return

        // Lasso: collect path points
        if (selectionModeRef.current === 'lasso') {
          const last = lassoPathRef.current[lassoPathRef.current.length - 1]
          if (!last || last.x !== raw.rawX || last.y !== raw.rawY) {
            lassoPathRef.current.push({ x: raw.rawX, y: raw.rawY })
          }
          return
        }

        if (movingSelRef.current) {
          const moveStart = moveStartRef.current
          if (!moveStart) return
          const dx = raw.rawX - moveStart.x
          const dy = raw.rawY - moveStart.y
          const sel = selectionRef.current
          if (!sel) return
          const newRect = { ...sel, x: sel.x + dx, y: sel.y + dy }
          setSelection(newRect)
          moveStartRef.current = { x: raw.rawX, y: raw.rawY }
          const content = selectionContentRef.current
          if (content) {
            const base = preShapeDataRef.current
            if (base) {
              const pasted = pasteRegion(base, content, newRect.x, newRect.y)
              onTileDataChangeRef.current(pasted)
            }
          }
        } else {
          const x = Math.min(start.x, raw.rawX)
          const y = Math.min(start.y, raw.rawY)
          const w = Math.abs(raw.rawX - start.x) + 1
          const h = Math.abs(raw.rawY - start.y) + 1
          setSelection({ x, y, w, h })
        }
        return
      }

      // Polygon preview: show line from last point to cursor
      if (tool === 'polygon' && polygonPointsRef.current.length > 0) {
        const coords = resolveCoords(raw.rawX, raw.rawY)
        if (!coords || !polygonBaseDataRef.current) return
        const pts = polygonPointsRef.current
        let preview = polygonBaseDataRef.current
        for (let i = 0; i < pts.length - 1; i++) {
          preview = drawLineOnData(preview, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)
        }
        const last = pts[pts.length - 1]
        preview = drawLineOnData(preview, last.x, last.y, coords.px, coords.py)
        onTileDataChangeRef.current(preview)
        return
      }
    }

    const handleWindowMouseUp = () => {
      if (isPanningRef.current) {
        setIsPanning(false)
      }
      const tool = activeToolRef.current
      const wasDrawing = isDrawingRef.current

      if (tool === 'line' || tool === 'rectangle' || tool === 'ellipse') {
        shapeStartRef.current = null
        preShapeDataRef.current = null
      }

      let wasMovingSelection = false
      if (tool === 'selection') {
        wasMovingSelection = movingSelRef.current
        selectionStartRef.current = null
        movingSelRef.current = false
        moveStartRef.current = null

        // Lasso: create mask from collected path
        if (selectionModeRef.current === 'lasso' && lassoPathRef.current.length > 2) {
          const path = lassoPathRef.current
          const w = spriteWRef.current
          const h = spriteHRef.current
          const mask = lassoPathToMask(path, w, h)
          const bbox = maskToBoundingBox(mask)
          if (bbox && tileDataRef.current) {
            setSelection(bbox)
            setSelectionContent(copyRegionMasked(tileDataRef.current, bbox, mask))
            selectionMaskRef.current = mask
          }
          lassoPathRef.current = []
        } else {
          const sel = selectionRef.current
          // Re-extract content for box selection on every drag completion (not for magic wand or moves)
          if (sel && tileDataRef.current && !wasMovingSelection && selectionMaskRef.current === null) {
            setSelectionContent(copyRegion(tileDataRef.current, sel))
          }
        }
      }

      isDrawingRef.current = false
      isPaintDrawingRef.current = false

      if (wasDrawing && (tool === 'draw' || tool === 'erase')) {
        const buf = workingBufferRef.current
        if (buf) {
          onTileDataChangeRef.current(buf)
          onStrokeCommitRef.current()
        }
      }
      if (wasDrawing && (tool === 'line' || tool === 'rectangle' || tool === 'ellipse')) {
        onStrokeCommitRef.current()
      }
      if (wasDrawing && wasMovingSelection) {
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
  }, [
    getRawPixelCoords, resolveCoords, paintAt,
    drawLineOnData, drawRectOnData, drawEllipseOnData,
    isDrawingRef, isPaintDrawingRef, workingBufferRef,
    activeToolRef, tileDataRef, onTileDataChangeRef, onStrokeCommitRef,
  ])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement | HTMLDivElement>) => {
      if (e.button !== 0 || !tileDataRef.current) return
      const raw = getRawPixelCoords(e.clientX, e.clientY)
      if (!raw) return

      const tool = activeToolRef.current

      // For polygon and lasso we accept out-of-bounds clicks (clamp to edge)
      const rawCoords = resolveCoords(raw.rawX, raw.rawY)
      const coords = rawCoords ?? (tool === 'polygon' || (tool === 'selection' && selectionModeRef.current === 'lasso')
        ? { px: Math.max(0, Math.min(spriteWRef.current - 1, raw.rawX)), py: Math.max(0, Math.min(spriteHRef.current - 1, raw.rawY)) }
        : null)
      if (!coords) return

      if (tool === 'draw' || tool === 'erase') {
        isDrawingRef.current = true
        isPaintDrawingRef.current = true
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

      if (tool === 'replace') {
        performColorReplace(coords.px, coords.py)
        return
      }

      if (tool === 'line' || tool === 'rectangle' || tool === 'ellipse') {
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

        if (sel && selectionContentRef.current &&
          coords.px >= sel.x && coords.px < sel.x + sel.w &&
          coords.py >= sel.y && coords.py < sel.y + sel.h &&
          selectionModeRef.current !== 'lasso') {
          movingSelRef.current = true
          moveStartRef.current = { x: raw.rawX, y: raw.rawY }
          const mask = selectionMaskRef.current
          preShapeDataRef.current = mask
            ? clearRegionMasked(tileDataRef.current!, sel, mask)
            : clearRegion(tileDataRef.current!, sel)
          selectionMaskRef.current = null // mask is stale after move
          return
        }

        if (selectionModeRef.current === 'magic') {
          const currentData = tileDataRef.current!
          if (coords.px >= 0 && coords.px < currentData.width &&
              coords.py >= 0 && coords.py < currentData.height) {
            const mask = magicWandSelect(currentData, coords.px, coords.py, magicToleranceRef.current)
            const bbox = maskToBoundingBox(mask)
            if (bbox) {
              setSelection(bbox)
              setSelectionContent(copyRegionMasked(currentData, bbox, mask))
              selectionMaskRef.current = mask
            } else {
              setSelection(null)
              setSelectionContent(null)
              selectionMaskRef.current = null
            }
          }
          isDrawingRef.current = false
          return
        }

        if (selectionModeRef.current === 'lasso') {
          lassoPathRef.current = [{ x: coords.px, y: coords.py }]
          setSelection(null)
          setSelectionContent(null)
          selectionMaskRef.current = null
          selectionStartRef.current = { x: coords.px, y: coords.py }
          return
        }

        selectionStartRef.current = { x: coords.px, y: coords.py }
        setSelection(null)
        setSelectionContent(null)
        selectionMaskRef.current = null
        return
      }

      if (tool === 'polygon') {
        const CLOSE_RADIUS = 3
        const pts = polygonPointsRef.current
        if (pts.length === 0) {
          // Start new polygon
          polygonBaseDataRef.current = new ImageData(
            new Uint8ClampedArray(tileDataRef.current!.data),
            tileDataRef.current!.width,
            tileDataRef.current!.height,
          )
          setPolygonPoints([{ x: coords.px, y: coords.py }])
        } else {
          // Check if clicking near first point (close polygon)
          const first = pts[0]
          if (
            pts.length >= 3 &&
            Math.abs(coords.px - first.x) <= CLOSE_RADIUS &&
            Math.abs(coords.py - first.y) <= CLOSE_RADIUS
          ) {
            let result = polygonBaseDataRef.current!
            for (let i = 0; i < pts.length - 1; i++) {
              result = drawLineOnData(result, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)
            }
            result = drawLineOnData(result, pts[pts.length - 1].x, pts[pts.length - 1].y, first.x, first.y)
            onTileDataChangeRef.current(result)
            onStrokeCommitRef.current()
            setPolygonPoints([])
            polygonBaseDataRef.current = null
          } else {
            // Add vertex
            const newPts = [...pts, { x: coords.px, y: coords.py }]
            let result = polygonBaseDataRef.current!
            for (let i = 0; i < newPts.length - 1; i++) {
              result = drawLineOnData(result, newPts[i].x, newPts[i].y, newPts[i + 1].x, newPts[i + 1].y)
            }
            onTileDataChangeRef.current(result)
            setPolygonPoints(newPts)
          }
        }
        return
      }
    },
    [
      getRawPixelCoords, resolveCoords, paintAt, performFill, performEyedrop,
      isDrawingRef, isPaintDrawingRef, workingBufferRef, activeToolRef, tileDataRef,
      onStrokeCommitRef, drawLineOnData,
    ],
  )

  const handleContainerMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        setIsPanning(true)
        setPanStart({ x: e.clientX - offsetRef.current.x, y: e.clientY - offsetRef.current.y })
        e.preventDefault()
        return
      }
      handleMouseDown(e)
    },
    [handleMouseDown],
  )

  const handleContainerMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isPanningRef.current) {
        setOffset({
          x: e.clientX - panStartRef.current.x,
          y: e.clientY - panStartRef.current.y,
        })
      }
      const raw = getRawPixelCoords(e.clientX, e.clientY)
      if (raw) setMousePixelPos({ x: raw.rawX, y: raw.rawY })
    },
    [getRawPixelCoords],
  )

  const handleContainerMouseUp = useCallback(
    () => {
      if (isPanningRef.current) {
        setIsPanning(false)
      }
    },
    [],
  )

  const handleContainerMouseLeave = useCallback(() => {
    setMousePixelPos(null)
  }, [])

  const isOverSelection = mousePixelPos !== null && selection !== null &&
    mousePixelPos.x >= selection.x && mousePixelPos.x < selection.x + selection.w &&
    mousePixelPos.y >= selection.y && mousePixelPos.y < selection.y + selection.h

  return {
    containerRef,
    zoom,
    offset,
    isPanning,
    mousePixelPos,
    selection,
    selectionContent,
    isOverSelection,
    nudge,
    fitView,
    handleWheel,
    handleContainerMouseDown,
    handleContainerMouseMove,
    handleContainerMouseUp,
    handleContainerMouseLeave,
  }
}
