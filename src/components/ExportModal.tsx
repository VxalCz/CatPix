import { useState, useMemo, useRef, useEffect } from 'react'
import { X, Package, Grid3x3, ArrowRight, ArrowDown, LayoutGrid, Film } from 'lucide-react'
import type { SheetLayout, ExportOptions, AtlasFormat } from '../utils/exportProject'
import type { GifExportOptions } from '../utils/exportGif'
import type { SpriteEntry } from '../App'
import { useAnimationPlayer } from '../hooks/useAnimationPlayer'

type ExportTab = 'spritesheet' | 'gif'

interface ExportModalProps {
  sprites: SpriteEntry[]
  onExport: (options: ExportOptions) => void
  onExportGif: (options: GifExportOptions) => void
  onClose: () => void
}

const layouts: { key: SheetLayout; label: string; icon: typeof LayoutGrid; desc: string }[] = [
  { key: 'auto', label: 'Auto (Square)', icon: LayoutGrid, desc: 'Roughly square grid' },
  { key: 'horizontal', label: 'Horizontal Strip', icon: ArrowRight, desc: 'All sprites in 1 row' },
  { key: 'vertical', label: 'Vertical Strip', icon: ArrowDown, desc: 'All sprites in 1 column' },
  { key: 'custom', label: 'Custom Columns', icon: Grid3x3, desc: 'Set exact column count' },
]

const atlasFormats: { key: AtlasFormat; label: string; desc: string }[] = [
  { key: 'catpix', label: 'CatPix JSON', desc: 'Default atlas format' },
  { key: 'texturepacker', label: 'TexturePacker', desc: 'JSON hash format' },
  { key: 'css', label: 'CSS Sprites', desc: 'CSS background positions' },
]

const paddingOptions = [0, 1, 2, 4]

const GIF_PREVIEW_SIZE = 96

function GifPreview({ sprites, fps, frameStart, frameEnd, scale }: {
  sprites: SpriteEntry[]
  fps: number
  frameStart: number
  frameEnd: number
  scale: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frames = useMemo(() => sprites.slice(frameStart, frameEnd + 1), [sprites, frameStart, frameEnd])

  const { currentFrame } = useAnimationPlayer({
    frameCount: frames.length,
    fps,
    playing: true,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || frames.length === 0) return
    const sprite = frames[currentFrame]
    if (!sprite) return

    canvas.width = sprite.width
    canvas.height = sprite.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, sprite.width, sprite.height)
    ctx.putImageData(sprite.imageData, 0, 0)
  }, [frames, currentFrame])

  if (frames.length === 0) {
    return <span className="text-[10px] text-text-muted">No frames in range</span>
  }

  const sprite = frames[currentFrame]
  const sw = sprite?.width ?? GIF_PREVIEW_SIZE
  const sh = sprite?.height ?? GIF_PREVIEW_SIZE
  const fitScale = Math.min(GIF_PREVIEW_SIZE / sw, GIF_PREVIEW_SIZE / sh)

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative border border-border-default rounded flex items-center justify-center"
        style={{
          width: GIF_PREVIEW_SIZE,
          height: GIF_PREVIEW_SIZE,
          background: `repeating-conic-gradient(#1a1a2e 0% 25%, #0f0f1e 0% 50%) 50% / 8px 8px`,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: Math.round(sw * fitScale),
            height: Math.round(sh * fitScale),
            imageRendering: 'pixelated',
          }}
        />
      </div>
      <div className="text-[10px] text-text-muted text-center">
        Frame {currentFrame + 1} / {frames.length}
        <br />
        Output: {sw * scale} × {sh * scale} px
      </div>
    </div>
  )
}

export function ExportModal({
  sprites,
  onExport,
  onExportGif,
  onClose,
}: ExportModalProps) {
  const [activeTab, setActiveTab] = useState<ExportTab>('spritesheet')

  const spriteCount = sprites.length
  const tileWidth = sprites[0]?.width ?? 0
  const tileHeight = sprites[0]?.height ?? 0

  // Spritesheet state
  const [layout, setLayout] = useState<SheetLayout>('auto')
  const [customCols, setCustomCols] = useState(Math.ceil(Math.sqrt(spriteCount)))
  const [padding, setPadding] = useState(2)
  const [atlasFormat, setAtlasFormat] = useState<AtlasFormat>('catpix')
  const [exportIndividualPngs, setExportIndividualPngs] = useState(false)

  // GIF state
  const [gifFps, setGifFps] = useState(8)
  const [gifScale, setGifScale] = useState<1 | 2 | 4>(1)
  const [gifLoopCount, setGifLoopCount] = useState(0)
  const [gifFrameStart, setGifFrameStart] = useState(0)
  const [gifFrameEnd, setGifFrameEnd] = useState(Math.max(0, spriteCount - 1))
  const [gifTransparent, setGifTransparent] = useState(false)

  const preview = useMemo(() => {
    let cols: number
    switch (layout) {
      case 'horizontal':
        cols = spriteCount
        break
      case 'vertical':
        cols = 1
        break
      case 'custom':
        cols = Math.max(1, Math.min(customCols, spriteCount))
        break
      default:
        cols = Math.ceil(Math.sqrt(spriteCount))
    }
    const rows = Math.ceil(spriteCount / cols)
    const cellW = tileWidth + padding * 2
    const cellH = tileHeight + padding * 2
    return {
      cols,
      rows,
      sheetW: cols * cellW,
      sheetH: rows * cellH,
    }
  }, [layout, customCols, spriteCount, tileWidth, tileHeight, padding])

  const handleExportSpritesheet = () => {
    onExport({ layout, customCols, padding, atlasFormat, exportIndividualPngs })
  }

  const handleExportGif = () => {
    onExportGif({
      fps: gifFps,
      scale: gifScale,
      loopCount: gifLoopCount,
      frameStart: gifFrameStart,
      frameEnd: gifFrameEnd,
      transparentBackground: gifTransparent,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true">
      <div className="bg-bg-secondary border border-border-default rounded-lg shadow-2xl w-[420px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Package size={16} />
            Export
          </h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            aria-label="Close export modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border-default">
          <button
            onClick={() => setActiveTab('spritesheet')}
            className={`flex-1 px-4 py-2 text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'spritesheet'
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Package size={13} />
            Spritesheet
          </button>
          <button
            onClick={() => setActiveTab('gif')}
            className={`flex-1 px-4 py-2 text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'gif'
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Film size={13} />
            Animated GIF
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {activeTab === 'spritesheet' ? (
            <>
              {/* Layout selection */}
              <div>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Layout
                </h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {layouts.map((l) => (
                    <button
                      key={l.key}
                      onClick={() => setLayout(l.key)}
                      className={`flex items-center gap-2 px-3 py-2 rounded text-xs text-left transition-colors cursor-pointer ${
                        layout === l.key
                          ? 'bg-accent text-white'
                          : 'bg-bg-hover text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <l.icon size={14} className="shrink-0" />
                      <div>
                        <div className="font-medium">{l.label}</div>
                        <div className={`text-[10px] ${layout === l.key ? 'text-white/70' : 'text-text-muted'}`}>
                          {l.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom columns input */}
              {layout === 'custom' && (
                <div>
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1 block">
                    Number of Columns
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={spriteCount}
                    value={customCols}
                    onChange={(e) => setCustomCols(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-1.5 rounded bg-bg-primary border border-border-default text-text-primary text-sm font-mono focus:border-accent focus:outline-none"
                  />
                </div>
              )}

              {/* Padding */}
              <div>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Padding
                </h3>
                <div className="flex gap-1.5">
                  {paddingOptions.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPadding(p)}
                      className={`flex-1 py-1.5 rounded text-xs text-center transition-colors cursor-pointer ${
                        padding === p
                          ? 'bg-accent text-white'
                          : 'bg-bg-hover text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {p}px
                    </button>
                  ))}
                </div>
              </div>

              {/* Atlas format */}
              <div>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Atlas Format
                </h3>
                <div className="space-y-1">
                  {atlasFormats.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setAtlasFormat(f.key)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs text-left transition-colors cursor-pointer ${
                        atlasFormat === f.key
                          ? 'bg-accent text-white'
                          : 'bg-bg-hover text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <div>
                        <span className="font-medium">{f.label}</span>
                        <span className={`ml-2 text-[10px] ${atlasFormat === f.key ? 'text-white/70' : 'text-text-muted'}`}>
                          {f.desc}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Individual PNGs */}
              <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportIndividualPngs}
                  onChange={(e) => setExportIndividualPngs(e.target.checked)}
                  className="accent-accent"
                />
                Also export individual PNGs
              </label>

              {/* Preview info */}
              <div className="bg-bg-primary rounded p-3 space-y-1.5">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Preview
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-text-secondary">Sprites</span>
                  <span className="text-text-primary font-mono">{spriteCount}</span>
                  <span className="text-text-secondary">Grid</span>
                  <span className="text-text-primary font-mono">{preview.cols} x {preview.rows}</span>
                  <span className="text-text-secondary">Sheet size</span>
                  <span className="text-text-primary font-mono">{preview.sheetW} x {preview.sheetH} px</span>
                  <span className="text-text-secondary">Padding</span>
                  <span className="text-text-primary font-mono">{padding}px per side</span>
                  <span className="text-text-secondary">Format</span>
                  <span className="text-text-primary font-mono">{atlasFormats.find((f) => f.key === atlasFormat)?.label}</span>
                </div>

                {/* Mini visual grid preview */}
                <div className="flex justify-center pt-2">
                  <div
                    className="inline-grid gap-px bg-border-default border border-border-default rounded overflow-hidden"
                    style={{
                      gridTemplateColumns: `repeat(${preview.cols}, 1fr)`,
                      maxWidth: 200,
                    }}
                  >
                    {Array.from({ length: preview.rows * preview.cols }).map((_, i) => (
                      <div
                        key={i}
                        className="w-4 h-4"
                        style={{
                          backgroundColor: i < spriteCount ? 'var(--color-accent)' : 'var(--color-bg-primary)',
                          opacity: i < spriteCount ? 0.6 : 0.2,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* GIF Tab */
            <>
              {/* Frame Range */}
              <div>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Frame Range
                </h3>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-text-secondary">From</label>
                  <input
                    type="number"
                    min={1}
                    max={spriteCount}
                    value={gifFrameStart + 1}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(spriteCount - 1, (parseInt(e.target.value) || 1) - 1))
                      setGifFrameStart(v)
                      if (v > gifFrameEnd) setGifFrameEnd(v)
                    }}
                    className="w-16 px-2 py-1 rounded bg-bg-primary border border-border-default text-text-primary text-xs font-mono focus:border-accent focus:outline-none text-center"
                  />
                  <label className="text-xs text-text-secondary">To</label>
                  <input
                    type="number"
                    min={1}
                    max={spriteCount}
                    value={gifFrameEnd + 1}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(spriteCount - 1, (parseInt(e.target.value) || 1) - 1))
                      setGifFrameEnd(v)
                      if (v < gifFrameStart) setGifFrameStart(v)
                    }}
                    className="w-16 px-2 py-1 rounded bg-bg-primary border border-border-default text-text-primary text-xs font-mono focus:border-accent focus:outline-none text-center"
                  />
                  <span className="text-[10px] text-text-muted ml-auto">
                    {gifFrameEnd - gifFrameStart + 1} frame{gifFrameEnd - gifFrameStart + 1 !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* FPS */}
              <div>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  FPS
                </h3>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={60}
                    value={gifFps}
                    onChange={(e) => setGifFps(Number(e.target.value))}
                    className="flex-1 accent-accent"
                  />
                  <span className="text-xs font-mono text-text-primary w-12 text-right">{gifFps} fps</span>
                </div>
              </div>

              {/* Scale */}
              <div>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Scale
                </h3>
                <div className="flex gap-1.5">
                  {([1, 2, 4] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setGifScale(s)}
                      className={`flex-1 py-1.5 rounded text-xs text-center transition-colors cursor-pointer ${
                        gifScale === s
                          ? 'bg-accent text-white'
                          : 'bg-bg-hover text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Loop Count */}
              <div>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Loop Count
                </h3>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={gifLoopCount}
                    onChange={(e) => setGifLoopCount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-20 px-2 py-1 rounded bg-bg-primary border border-border-default text-text-primary text-xs font-mono focus:border-accent focus:outline-none text-center"
                  />
                  <span className="text-[10px] text-text-muted">
                    {gifLoopCount === 0 ? 'Infinite loop' : `${gifLoopCount} loop${gifLoopCount !== 1 ? 's' : ''}`}
                  </span>
                </div>
              </div>

              {/* Transparent Background */}
              <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer" title="GIF supports only 1-bit transparency — pixels are either fully opaque or fully transparent">
                <input
                  type="checkbox"
                  checked={gifTransparent}
                  onChange={(e) => setGifTransparent(e.target.checked)}
                  className="accent-accent"
                />
                Transparent background
                <span className="text-[10px] text-text-muted">(1-bit alpha)</span>
              </label>

              {/* Preview */}
              <div className="bg-bg-primary rounded p-3">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Preview
                </h3>
                <div className="flex justify-center">
                  <GifPreview
                    sprites={sprites}
                    fps={gifFps}
                    frameStart={gifFrameStart}
                    frameEnd={gifFrameEnd}
                    scale={gifScale}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border-default">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded text-xs text-text-secondary hover:text-text-primary bg-bg-hover transition-colors cursor-pointer"
          >
            Cancel
          </button>
          {activeTab === 'spritesheet' ? (
            <button
              onClick={handleExportSpritesheet}
              className="px-4 py-1.5 rounded text-xs bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Package size={13} />
              Export .zip
            </button>
          ) : (
            <button
              onClick={handleExportGif}
              className="px-4 py-1.5 rounded text-xs bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Film size={13} />
              Export .gif
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
