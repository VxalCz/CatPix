import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, Clipboard } from 'lucide-react'
import type { ScaleCandidate, DownscaleMethod } from '../../utils/aiImport'
import { presetPalettes } from '../../data/presetPalettes'
import type { PaletteColor } from '../../hooks/usePalette'
import type { useAIImportWorker } from '../../hooks/useAIImportWorker'

type SliceMode = 'grid' | 'auto'
type QuantizeMode = 'off' | 'threshold' | 'median' | 'palette'

const tilePresets = [8, 16, 32, 64]

export interface ConfigureState {
  sourceImage: HTMLImageElement | null
  sourceImageData: ImageData | null
  candidates: ScaleCandidate[]
  scaleFactor: number
  downscaleMethod: DownscaleMethod
  tileSize: number
  spriteTilesX: number
  spriteTilesY: number
  skipEmpty: boolean
  sliceMode: SliceMode
  autoMinPixels: number
  quantizeMode: QuantizeMode
  quantizeThreshold: number
  medianMaxColors: number
  selectedPalette: string
  removeBg: boolean
  bgColor: { r: number; g: number; b: number; a: number } | null
  bgTolerance: number
  doCleanEdges: boolean
  cleanEdgesThreshold: number
  paletteRgba: [number, number, number, number][]
}

interface ConfigureStepProps {
  gridSize: number
  paletteColors: PaletteColor[]
  worker: ReturnType<typeof useAIImportWorker>
  state: ConfigureState
  setState: <K extends keyof ConfigureState>(key: K, value: ConfigureState[K]) => void
  liveCanvasRef: React.RefObject<HTMLCanvasElement | null>
}

export function ConfigureStep({
  paletteColors, worker,
  state, setState,
  liveCanvasRef,
}: ConfigureStepProps) {
  const {
    sourceImage, candidates, scaleFactor, downscaleMethod,
    tileSize, spriteTilesX, spriteTilesY, skipEmpty,
    sliceMode, autoMinPixels,
    quantizeMode, quantizeThreshold, medianMaxColors, selectedPalette,
    removeBg, bgColor, bgTolerance,
    doCleanEdges, cleanEdgesThreshold,
    paletteRgba,
  } = state

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manualScale, setManualScale] = useState('')

  const trueWidth = sourceImage ? Math.floor(sourceImage.width / scaleFactor) : 0
  const trueHeight = sourceImage ? Math.floor(sourceImage.height / scaleFactor) : 0

  const loadImageFromSource = useCallback((img: HTMLImageElement) => {
    setState('sourceImage', img)
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, 0, 0)
    const imgData = ctx.getImageData(0, 0, img.width, img.height)
    setState('sourceImageData', imgData)

    worker.detectScale(imgData).then((results) => {
      setState('candidates', results)
      if (results.length > 0 && results[0].confidence > 0.7) {
        setState('scaleFactor', results[0].factor)
      }
    })
  }, [worker, setState])

  const loadImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    setError(null)
    if (file.size > 50 * 1024 * 1024) {
      setError('File is too large (max 50 MB).')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => loadImageFromSource(img)
      img.onerror = () => setError('Failed to load the image.')
      img.src = reader.result as string
    }
    reader.onerror = () => setError('Failed to read the image file.')
    reader.readAsDataURL(file)
  }, [loadImageFromSource])

  // Clipboard paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) loadImageFile(file)
          return
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [loadImageFile])

  const handleClipboardButton = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith('image/'))
        if (imageType) {
          const blob = await item.getType(imageType)
          const file = new File([blob], 'clipboard.png', { type: imageType })
          loadImageFile(file)
          return
        }
      }
      setError('No image found in clipboard.')
    } catch {
      setError('Clipboard access denied. Try Ctrl+V instead.')
    }
  }, [loadImageFile])

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="px-3 py-2 bg-red-900/40 rounded text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Upload zone */}
      {!sourceImage ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false)
            const file = e.dataTransfer.files[0]
            if (file) loadImageFile(file)
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-accent bg-accent/10' : 'border-border-default hover:border-accent/50'
          }`}
        >
          <Upload size={32} className="mx-auto mb-2 text-text-muted" />
          <p className="text-sm text-text-secondary">
            Drop an AI-generated image here or click to browse
          </p>
          <p className="text-xs text-text-muted mt-1">PNG, JPG, WebP — or Ctrl+V to paste</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) loadImageFile(file)
              e.target.value = ''
            }}
          />
          <button
            onClick={(e) => { e.stopPropagation(); handleClipboardButton() }}
            className="mt-3 px-3 py-1.5 rounded text-xs bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <Clipboard size={12} />
            Paste from Clipboard
          </button>
        </div>
      ) : (
        <>
          {/* Source + live preview */}
          <div className="flex items-start gap-3">
            <img
              src={sourceImage.src}
              alt="Source"
              className="w-20 h-20 object-contain rounded border border-border-default bg-bg-primary shrink-0"
              style={{ imageRendering: 'pixelated' }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-secondary">
                Source: {sourceImage.width} x {sourceImage.height} px
              </p>
              <p className="text-xs text-accent font-medium mt-0.5">
                True resolution: {trueWidth} x {trueHeight} px at {scaleFactor}x
              </p>
              <button
                onClick={() => {
                  setState('sourceImage', null)
                  setState('sourceImageData', null)
                  setState('candidates', [])
                }}
                className="text-[10px] text-text-muted hover:text-text-primary mt-1 cursor-pointer"
              >
                Change image
              </button>
            </div>
            <div className="shrink-0 flex flex-col items-center">
              <canvas
                ref={liveCanvasRef}
                className="rounded border border-border-default bg-bg-primary"
                style={{ imageRendering: 'pixelated', maxWidth: 128, maxHeight: 128 }}
              />
              <span className="text-[10px] text-text-muted mt-0.5">Preview</span>
            </div>
          </div>

          {/* Scale factor */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">
              Scale Factor
            </label>
            {candidates.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {candidates.slice(0, 5).map((c) => (
                  <button
                    key={c.factor}
                    onClick={() => { setState('scaleFactor', c.factor); setManualScale('') }}
                    className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                      scaleFactor === c.factor && !manualScale
                        ? 'bg-accent text-white'
                        : 'bg-bg-hover text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {c.factor}x
                    <span className="text-[10px] ml-1 opacity-70">
                      {Math.round(c.confidence * 100)}%
                    </span>
                  </button>
                ))}
              </div>
            )}
            {candidates.length > 0 && candidates[0].confidence <= 0.7 && (
              <p className="text-[10px] text-yellow-400 mb-2">
                Low confidence — consider setting scale manually
              </p>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">Manual:</span>
              <input
                type="number"
                min={1}
                max={64}
                value={manualScale}
                placeholder={String(scaleFactor)}
                onChange={(e) => {
                  setManualScale(e.target.value)
                  const n = parseInt(e.target.value)
                  if (n >= 1 && n <= 64) setState('scaleFactor', n)
                }}
                className="w-20 px-2 py-1 rounded bg-bg-primary border border-border-default text-text-primary text-xs font-mono focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Downscale method */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">
              Downscale Method
            </label>
            <div className="flex gap-1.5 mb-1.5">
              {([
                { value: 'mode' as const, label: 'Mode (Recommended)' },
                { value: 'center' as const, label: 'Center' },
                { value: 'average' as const, label: 'Average' },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setState('downscaleMethod', opt.value)}
                  className={`flex-1 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                    downscaleMethod === opt.value
                      ? 'bg-accent text-white'
                      : 'bg-bg-hover text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-text-muted">
              {downscaleMethod === 'mode' && 'Picks the most frequent color per block — best for pixel art with flat colors.'}
              {downscaleMethod === 'center' && 'Samples the center pixel of each block — fast but sensitive to anti-aliasing.'}
              {downscaleMethod === 'average' && 'Averages all pixels per block — good fallback for non-strict pixel art.'}
            </p>
          </div>

          {/* Slice mode */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">
              Sprite Extraction
            </label>
            <div className="flex gap-1.5 mb-2">
              <button
                onClick={() => setState('sliceMode', 'grid')}
                className={`flex-1 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                  sliceMode === 'grid' ? 'bg-accent text-white' : 'bg-bg-hover text-text-secondary hover:text-text-primary'
                }`}
              >
                Grid Slice
              </button>
              <button
                onClick={() => setState('sliceMode', 'auto')}
                className={`flex-1 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                  sliceMode === 'auto' ? 'bg-accent text-white' : 'bg-bg-hover text-text-secondary hover:text-text-primary'
                }`}
              >
                Auto-Detect Sprites
              </button>
            </div>
            <p className="text-[10px] text-text-muted">
              {sliceMode === 'grid'
                ? 'Cuts the image into a regular grid of fixed-size tiles.'
                : 'Finds individual sprites by detecting connected non-transparent regions.'}
            </p>
          </div>

          {/* Grid slice settings */}
          {sliceMode === 'grid' && (
            <>
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">
                  Target Tile Size
                </label>
                <div className="flex gap-1.5 mb-2">
                  {tilePresets.map((size) => (
                    <button
                      key={size}
                      onClick={() => setState('tileSize', size)}
                      className={`flex-1 py-1.5 rounded text-xs font-mono transition-colors cursor-pointer ${
                        tileSize === size ? 'bg-accent text-white' : 'bg-bg-hover text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={1}
                  max={256}
                  value={tileSize}
                  onChange={(e) => setState('tileSize', Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-2 py-1 rounded bg-bg-primary border border-border-default text-text-primary text-xs font-mono focus:border-accent focus:outline-none"
                />
              </div>

              {sourceImage && (tileSize > trueWidth || tileSize > trueHeight) && (
                <p className="text-[10px] text-yellow-400">
                  Tile size {tileSize}px is larger than the true resolution ({trueWidth}x{trueHeight}) — this will produce 0 sprites.
                </p>
              )}

              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">
                  Sprite Layout (tiles per sprite)
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-text-secondary">W</span>
                    <input
                      type="number" min={1} max={16} value={spriteTilesX}
                      onChange={(e) => setState('spriteTilesX', Math.max(1, Math.min(16, parseInt(e.target.value) || 1)))}
                      className="w-14 px-2 py-1 rounded bg-bg-primary border border-border-default text-text-primary text-xs font-mono focus:border-accent focus:outline-none"
                    />
                  </div>
                  <span className="text-text-muted">x</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-text-secondary">H</span>
                    <input
                      type="number" min={1} max={16} value={spriteTilesY}
                      onChange={(e) => setState('spriteTilesY', Math.max(1, Math.min(16, parseInt(e.target.value) || 1)))}
                      className="w-14 px-2 py-1 rounded bg-bg-primary border border-border-default text-text-primary text-xs font-mono focus:border-accent focus:outline-none"
                    />
                  </div>
                  <span className="text-[10px] text-text-muted">
                    = {tileSize * spriteTilesX}x{tileSize * spriteTilesY} px
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Auto-detect settings */}
          {sliceMode === 'auto' && (
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">
                Minimum Sprite Size
              </label>
              <div className="flex items-center gap-2">
                <input type="range" min={1} max={64} value={autoMinPixels}
                  onChange={(e) => setState('autoMinPixels', Number(e.target.value))}
                  className="flex-1 accent-accent" />
                <span className="text-[10px] text-text-muted font-mono w-8 text-right">{autoMinPixels}px</span>
              </div>
              <p className="text-[10px] text-text-muted mt-1">
                Regions smaller than this are filtered out (noise removal).
              </p>
            </div>
          )}

          {/* Options */}
          <div className="space-y-2">
            {sliceMode === 'grid' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={skipEmpty}
                  onChange={(e) => setState('skipEmpty', e.target.checked)} className="accent-accent" />
                <span className="text-xs text-text-secondary">Skip empty (transparent) tiles</span>
              </label>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={doCleanEdges}
                onChange={(e) => setState('doCleanEdges', e.target.checked)} className="accent-accent" />
              <span className="text-xs text-text-secondary">Clean semi-transparent edges</span>
            </label>
            {doCleanEdges && (
              <div className="flex items-center gap-2 ml-5">
                <span className="text-[10px] text-text-muted">Alpha threshold:</span>
                <input type="range" min={1} max={254} value={cleanEdgesThreshold}
                  onChange={(e) => setState('cleanEdgesThreshold', Number(e.target.value))}
                  className="flex-1 accent-accent" />
                <span className="text-[10px] text-text-muted font-mono w-6 text-right">{cleanEdgesThreshold}</span>
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={removeBg}
                onChange={(e) => {
                  const checked = e.target.checked
                  setState('removeBg', checked)
                  if (checked && state.sourceImageData && !bgColor) {
                    worker.detectBgColor(state.sourceImageData).then((c) => setState('bgColor', c))
                  }
                }} className="accent-accent" />
              <span className="text-xs text-text-secondary">Remove background color</span>
            </label>
            {removeBg && bgColor && (
              <div className="ml-5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-text-muted">Detected:</span>
                  <div className="w-5 h-5 rounded border border-border-default"
                    style={{ backgroundColor: `rgba(${bgColor.r},${bgColor.g},${bgColor.b},${bgColor.a / 255})` }}
                    title={`rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`} />
                  <span className="text-[10px] text-text-muted font-mono">
                    rgb({bgColor.r}, {bgColor.g}, {bgColor.b})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-text-muted">Tolerance:</span>
                  <input type="range" min={0} max={80} value={bgTolerance}
                    onChange={(e) => setState('bgTolerance', Number(e.target.value))}
                    className="flex-1 accent-accent" />
                  <span className="text-[10px] text-text-muted font-mono w-6 text-right">{bgTolerance}</span>
                </div>
              </div>
            )}

            {/* Color quantization */}
            <div className="pt-1">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">
                Color Reduction
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {([
                  { value: 'off' as const, label: 'None' },
                  { value: 'threshold' as const, label: 'Merge Similar' },
                  { value: 'median' as const, label: 'Target Count' },
                  { value: 'palette' as const, label: 'Snap to Palette' },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setState('quantizeMode', opt.value)}
                    className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                      quantizeMode === opt.value
                        ? 'bg-accent text-white'
                        : 'bg-bg-hover text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {quantizeMode === 'threshold' && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-text-muted">Threshold:</span>
                  <input type="range" min={5} max={80} value={quantizeThreshold}
                    onChange={(e) => setState('quantizeThreshold', Number(e.target.value))}
                    className="flex-1 accent-accent" />
                  <span className="text-[10px] text-text-muted font-mono w-6 text-right">{quantizeThreshold}</span>
                </div>
              )}

              {quantizeMode === 'median' && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-text-muted">Max colors:</span>
                  <input type="range" min={2} max={64} value={medianMaxColors}
                    onChange={(e) => setState('medianMaxColors', Number(e.target.value))}
                    className="flex-1 accent-accent" />
                  <span className="text-[10px] text-text-muted font-mono w-6 text-right">{medianMaxColors}</span>
                </div>
              )}

              {quantizeMode === 'palette' && (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setState('selectedPalette', 'project')}
                      className={`px-2 py-1 rounded text-[10px] transition-colors cursor-pointer ${
                        selectedPalette === 'project' ? 'bg-accent text-white' : 'bg-bg-hover text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      Project ({paletteColors.length})
                    </button>
                    {presetPalettes.map((p) => (
                      <button
                        key={p.name}
                        onClick={() => setState('selectedPalette', p.name)}
                        className={`px-2 py-1 rounded text-[10px] transition-colors cursor-pointer ${
                          selectedPalette === p.name ? 'bg-accent text-white' : 'bg-bg-hover text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {p.name} ({p.colors.length})
                      </button>
                    ))}
                  </div>
                  {selectedPalette === 'project' && paletteColors.length === 0 && (
                    <p className="text-[10px] text-yellow-400">
                      No project palette available. Load a tileset image first, or select a preset.
                    </p>
                  )}
                  {paletteRgba.length > 0 && (
                    <div className="flex flex-wrap gap-0.5">
                      {paletteRgba.slice(0, 32).map(([r, g, b, a], i) => (
                        <div
                          key={i}
                          className="w-3.5 h-3.5 rounded-sm border border-border-default"
                          style={{ backgroundColor: `rgba(${r},${g},${b},${a / 255})` }}
                        />
                      ))}
                      {paletteRgba.length > 32 && (
                        <span className="text-[10px] text-text-muted self-center ml-1">
                          +{paletteRgba.length - 32}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
