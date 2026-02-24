import { useRef, useEffect, useCallback, useState } from 'react'
import {
  Trash2, Download, FlipHorizontal2, FlipVertical2,
  Save, Repeat, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Layers, Plus,
} from 'lucide-react'
import type { Tool } from './Sidebar'
import { useSymmetry } from '../hooks/useSymmetry'

interface PixelEditorProps {
  tileData: ImageData | null
  activeTool: Tool
  activeColor: string
  onionSkinData: ImageData | null
  isEditingBank: boolean
  onClear: () => void
  onTileDataChange: (data: ImageData) => void
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

function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

export function PixelEditor({
  tileData,
  activeTool,
  activeColor,
  onionSkinData,
  isEditingBank,
  onClear,
  onTileDataChange,
  onSaveToBank,
  onUpdateInBank,
}: PixelEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const [symmetryH, setSymmetryH] = useState(false)
  const [symmetryV, setSymmetryV] = useState(false)
  const [wrapAround, setWrapAround] = useState(false)
  const [onionSkin, setOnionSkin] = useState(false)

  const spriteW = tileData?.width ?? 0
  const spriteH = tileData?.height ?? 0

  const wrapAroundRef = useRef(wrapAround)
  wrapAroundRef.current = wrapAround
  const spriteWRef = useRef(spriteW)
  spriteWRef.current = spriteW
  const spriteHRef = useRef(spriteH)
  spriteHRef.current = spriteH
  const activeToolRef = useRef(activeTool)
  activeToolRef.current = activeTool
  const activeColorRef = useRef(activeColor)
  activeColorRef.current = activeColor
  const tileDataRef = useRef(tileData)
  tileDataRef.current = tileData

  const { getMirroredPixels } = useSymmetry({
    horizontal: symmetryH,
    vertical: symmetryV,
    width: spriteW,
    height: spriteH,
  })
  const getMirroredPixelsRef = useRef(getMirroredPixels)
  getMirroredPixelsRef.current = getMirroredPixels

  const onTileDataChangeRef = useRef(onTileDataChange)
  onTileDataChangeRef.current = onTileDataChange

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = spriteW || 1
    const h = spriteH || 1

    canvas.width = w
    canvas.height = h
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, w, h)

    // Onion skin: draw previous frame underneath
    if (onionSkin && onionSkinData) {
      // putImageData ignores globalAlpha, so draw via a temp canvas
      const tmp = document.createElement('canvas')
      tmp.width = onionSkinData.width
      tmp.height = onionSkinData.height
      const tmpCtx = tmp.getContext('2d')!
      tmpCtx.putImageData(onionSkinData, 0, 0)
      ctx.globalAlpha = 0.3
      ctx.drawImage(tmp, 0, 0)
      ctx.globalAlpha = 1.0
    }

    if (tileData) {
      // Draw current tile data on top via temp canvas to preserve alpha compositing
      const tmp = document.createElement('canvas')
      tmp.width = tileData.width
      tmp.height = tileData.height
      const tmpCtx = tmp.getContext('2d')!
      tmpCtx.putImageData(tileData, 0, 0)
      ctx.drawImage(tmp, 0, 0)
    }
  }, [tileData, spriteW, spriteH, onionSkin, onionSkinData])

  useEffect(() => {
    redraw()
  }, [redraw])

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
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const w = spriteWRef.current
      const h = spriteHRef.current

      // Read pixel data from tileData (not from canvas which has onion skin composited)
      const current = tileDataRef.current
      if (!current) return
      const newData = new ImageData(
        new Uint8ClampedArray(current.data),
        w, h,
      )

      const points = getMirroredPixelsRef.current(px, py)
      const wrap = wrapAroundRef.current
      const tool = activeToolRef.current

      for (const pt of points) {
        const wx = wrap ? mod(pt.px, w) : pt.px
        const wy = wrap ? mod(pt.py, h) : pt.py

        if (wx < 0 || wx >= w || wy < 0 || wy >= h) continue
        const idx = (wy * w + wx) * 4

        if (tool === 'erase') {
          newData.data[idx] = 0
          newData.data[idx + 1] = 0
          newData.data[idx + 2] = 0
          newData.data[idx + 3] = 0
        } else {
          const [r, g, b, a] = hexToRgba(activeColorRef.current)
          newData.data[idx] = r
          newData.data[idx + 1] = g
          newData.data[idx + 2] = b
          newData.data[idx + 3] = a
        }
      }

      onTileDataChangeRef.current(newData)
    },
    [],
  )

  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!isDrawingRef.current) return
      const raw = getRawPixelCoords(e.clientX, e.clientY)
      if (!raw) return
      const coords = resolveCoords(raw.rawX, raw.rawY)
      if (coords) paintAt(coords.px, coords.py)
    }

    const handleWindowMouseUp = () => {
      isDrawingRef.current = false
    }

    window.addEventListener('mousemove', handleWindowMouseMove)
    window.addEventListener('mouseup', handleWindowMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove)
      window.removeEventListener('mouseup', handleWindowMouseUp)
    }
  }, [getRawPixelCoords, resolveCoords, paintAt])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0 || !tileDataRef.current) return
      isDrawingRef.current = true
      const raw = getRawPixelCoords(e.clientX, e.clientY)
      if (!raw) return
      const coords = resolveCoords(raw.rawX, raw.rawY)
      if (coords) paintAt(coords.px, coords.py)
    },
    [getRawPixelCoords, resolveCoords, paintAt],
  )

  // Nudge: shift all pixels by 1 in given direction
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
    // Render just the tile data (without onion skin) for download
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
            cursor: tileData ? 'crosshair' : 'default',
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
            className="p-0.5 rounded bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed" title="Nudge left">
            <ArrowLeft size={12} />
          </button>
          <div className="flex flex-col gap-0.5">
            <button onClick={() => nudge(0, -1)} disabled={!tileData}
              className="p-0.5 rounded bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed" title="Nudge up">
              <ArrowUp size={12} />
            </button>
            <button onClick={() => nudge(0, 1)} disabled={!tileData}
              className="p-0.5 rounded bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed" title="Nudge down">
              <ArrowDown size={12} />
            </button>
          </div>
          <button onClick={() => nudge(1, 0)} disabled={!tileData}
            className="p-0.5 rounded bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed" title="Nudge right">
            <ArrowRight size={12} />
          </button>
        </div>
        <p className="text-xs text-text-muted">
          {spriteW}x{spriteH}
          {wrapAround && <span className="text-green-400 ml-1">wrap</span>}
          {onionSkin && onionSkinData && <span className="text-purple-400 ml-1">onion</span>}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-3">
        <button onClick={onClear} disabled={!tileData}
          className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors cursor-pointer bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
          title="Clear canvas">
          <Trash2 size={13} />
        </button>
        <button onClick={handleDownload} disabled={!tileData}
          className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors cursor-pointer bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
          title="Download PNG">
          <Download size={13} />
        </button>
        {isEditingBank ? (
          <>
            <button onClick={onUpdateInBank} disabled={!tileData}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors cursor-pointer bg-green-600 text-white hover:bg-green-500 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Overwrite the sprite you opened from the bank">
              <Save size={13} />
              Update
            </button>
            <button onClick={onSaveToBank} disabled={!tileData}
              className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors cursor-pointer bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
              title="Save as a new sprite in the bank">
              <Plus size={13} />
            </button>
          </>
        ) : (
          <button onClick={onSaveToBank} disabled={!tileData}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors cursor-pointer bg-green-600 text-white hover:bg-green-500 disabled:opacity-30 disabled:cursor-not-allowed">
            <Save size={13} />
            Save to Bank
          </button>
        )}
      </div>
    </div>
  )
}
