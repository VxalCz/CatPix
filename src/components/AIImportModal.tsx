import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { X, Sparkles, Upload, ArrowRight, ArrowLeft, Download, Clipboard, Loader2 } from 'lucide-react'
import {
  type ScaleCandidate,
  type DownscaleMethod,
} from '../utils/aiImport'
import { hexToRgba } from '../utils/colorUtils'
import { presetPalettes } from '../data/presetPalettes'
import type { PaletteColor } from '../hooks/usePalette'
import { useAIImportWorker } from '../hooks/useAIImportWorker'

interface AIImportModalProps {
  gridSize: number
  paletteColors: PaletteColor[]
  onImport: (tiles: ImageData[]) => void
  onLoadAsTileset: (image: ImageData, tileSize: number) => void
  onClose: () => void
}

type Step = 'configure' | 'preview'
type SliceMode = 'grid' | 'auto'
type QuantizeMode = 'off' | 'threshold' | 'median' | 'palette'

const tilePresets = [8, 16, 32, 64]

function drawCheckerboard(ctx: CanvasRenderingContext2D, width: number, height: number, cellSize: number) {
  for (let y = 0; y < height; y += cellSize) {
    for (let x = 0; x < width; x += cellSize) {
      ctx.fillStyle = ((x / cellSize + y / cellSize) | 0) % 2 === 0 ? '#2a2a2a' : '#3a3a3a'
      ctx.fillRect(x, y, cellSize, cellSize)
    }
  }
}

export function AIImportModal({ gridSize, paletteColors, onImport, onLoadAsTileset, onClose }: AIImportModalProps) {
  const worker = useAIImportWorker()
  const [processing, setProcessing] = useState(false)
  const [step, setStep] = useState<Step>('configure')

  // Source image
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null)
  const [sourceImageData, setSourceImageData] = useState<ImageData | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Detection results
  const [candidates, setCandidates] = useState<ScaleCandidate[]>([])
  const [scaleFactor, setScaleFactor] = useState(8)
  const [manualScale, setManualScale] = useState('')

  // Settings
  const [tileSize, setTileSize] = useState(gridSize)
  const [spriteTilesX, setSpriteTilesX] = useState(1)
  const [spriteTilesY, setSpriteTilesY] = useState(1)
  const [skipEmpty, setSkipEmpty] = useState(true)
  const [downscaleMethod, setDownscaleMethod] = useState<DownscaleMethod>('mode')
  const [quantizeMode, setQuantizeMode] = useState<QuantizeMode>('off')
  const [quantizeThreshold, setQuantizeThreshold] = useState(20)
  const [medianMaxColors, setMedianMaxColors] = useState(16)
  const [selectedPalette, setSelectedPalette] = useState<string>('project')
  const [removeBg, setRemoveBg] = useState(false)
  const [bgColor, setBgColor] = useState<{ r: number; g: number; b: number; a: number } | null>(null)
  const [bgTolerance, setBgTolerance] = useState(20)
  const [doCleanEdges, setDoCleanEdges] = useState(false)
  const [cleanEdgesThreshold, setCleanEdgesThreshold] = useState(128)
  const [sliceMode, setSliceMode] = useState<SliceMode>('grid')
  const [autoMinPixels, setAutoMinPixels] = useState(4)

  // Preview data
  const [downscaled, setDownscaled] = useState<ImageData | null>(null)
  const [previewTiles, setPreviewTiles] = useState<ImageData[]>([])
  const [tileEnabled, setTileEnabled] = useState<boolean[]>([])
  const [colorCount, setColorCount] = useState(0)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  // Live preview
  const liveCanvasRef = useRef<HTMLCanvasElement>(null)
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Build palette RGBA lookup for snap-to-palette
  const paletteRgba = useMemo<[number, number, number, number][]>(() => {
    if (selectedPalette === 'project') {
      return paletteColors.map((c) => [c.r, c.g, c.b, c.a])
    }
    const preset = presetPalettes.find((p) => p.name === selectedPalette)
    if (preset) {
      return preset.colors.map((hex) => hexToRgba(hex))
    }
    return []
  }, [selectedPalette, paletteColors])

  const loadImageFromSource = useCallback((img: HTMLImageElement) => {
    setSourceImage(img)
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, 0, 0)
    const imgData = ctx.getImageData(0, 0, img.width, img.height)
    setSourceImageData(imgData)

    worker.detectScale(imgData).then((results) => {
      setCandidates(results)
      if (results.length > 0 && results[0].confidence > 0.7) {
        setScaleFactor(results[0].factor)
      }
    })
  }, [worker])

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
      img.onerror = () => {
        setError('Failed to load the image. The file may be corrupt or unsupported.')
      }
      img.src = reader.result as string
    }
    reader.onerror = () => {
      setError('Failed to read the image file.')
    }
    reader.readAsDataURL(file)
  }, [loadImageFromSource])

  // Clipboard paste (Ctrl+V) support
  const handlePaste = useCallback((e: ClipboardEvent) => {
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
  }, [loadImageFile])

  useEffect(() => {
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [handlePaste])

  // Also handle paste button for clipboard API
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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) loadImageFile(file)
    },
    [loadImageFile],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) loadImageFile(file)
      e.target.value = ''
    },
    [loadImageFile],
  )

  const handleManualScaleChange = useCallback(
    (val: string) => {
      setManualScale(val)
      const n = parseInt(val)
      if (n >= 1 && n <= 64) setScaleFactor(n)
    },
    [],
  )

  const trueWidth = sourceImage ? Math.floor(sourceImage.width / scaleFactor) : 0
  const trueHeight = sourceImage ? Math.floor(sourceImage.height / scaleFactor) : 0

  // Shared processing options for the worker
  const processingOpts = useMemo(() => ({
    scaleFactor,
    downscaleMethod,
    doCleanEdges,
    cleanEdgesThreshold,
    removeBg,
    bgColor,
    bgTolerance,
    quantizeMode,
    quantizeThreshold,
    medianMaxColors,
    paletteRgba,
  }), [scaleFactor, downscaleMethod, doCleanEdges, cleanEdgesThreshold, removeBg, bgColor, bgTolerance, quantizeMode, quantizeThreshold, medianMaxColors, paletteRgba])

  // Live preview — debounced, runs processing in Web Worker
  useEffect(() => {
    if (!sourceImageData || step !== 'configure') return
    if (liveTimerRef.current) clearTimeout(liveTimerRef.current)
    liveTimerRef.current = setTimeout(() => {
      worker.processImage(sourceImageData, processingOpts).then((processed) => {
        const canvas = liveCanvasRef.current
        if (!canvas) return
        const maxDim = 128
        const scale = Math.min(maxDim / processed.width, maxDim / processed.height, 8)
        canvas.width = Math.ceil(processed.width * scale)
        canvas.height = Math.ceil(processed.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Checkerboard
        const cs = Math.max(4, scale)
        drawCheckerboard(ctx, canvas.width, canvas.height, cs)

        const tmp = document.createElement('canvas')
        tmp.width = processed.width
        tmp.height = processed.height
        const tmpCtx = tmp.getContext('2d')
        if (!tmpCtx) return
        tmpCtx.putImageData(processed, 0, 0)
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height)
      })
    }, 150)
    return () => { if (liveTimerRef.current) clearTimeout(liveTimerRef.current) }
  }, [sourceImageData, step, processingOpts, worker])

  // Generate preview when moving to step 2 — runs in Web Worker
  const generatePreview = useCallback(() => {
    if (!sourceImageData || processing) return
    setProcessing(true)

    const tileW = tileSize * spriteTilesX
    const tileH = tileSize * spriteTilesY

    worker.processAndSlice(sourceImageData, {
      ...processingOpts,
      sliceMode,
      tileW,
      tileH,
      skipEmpty,
      autoMinPixels,
    }).then(({ processed, tiles, colorCount: cc }) => {
      setDownscaled(processed)
      setColorCount(cc)
      setPreviewTiles(tiles)
      setTileEnabled(new Array(tiles.length).fill(true))
      setStep('preview')
      setProcessing(false)
    })
  }, [sourceImageData, processing, processingOpts, worker, sliceMode, autoMinPixels, tileSize, spriteTilesX, spriteTilesY, skipEmpty])

  // Draw preview canvas
  useEffect(() => {
    if (step !== 'preview' || !downscaled || !previewCanvasRef.current) return
    const canvas = previewCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const maxDim = 256
    const scale = Math.min(maxDim / downscaled.width, maxDim / downscaled.height, 8)
    canvas.width = downscaled.width * scale
    canvas.height = downscaled.height * scale

    // Checkerboard
    const checkSize = Math.max(4, scale)
    drawCheckerboard(ctx, canvas.width, canvas.height, checkSize)

    const tmpCanvas = document.createElement('canvas')
    tmpCanvas.width = downscaled.width
    tmpCanvas.height = downscaled.height
    const tmpCtx = tmpCanvas.getContext('2d')
    if (!tmpCtx) return
    tmpCtx.putImageData(downscaled, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(tmpCanvas, 0, 0, canvas.width, canvas.height)

    // Grid overlay (only for grid mode)
    if (sliceMode === 'grid') {
      const tileW = tileSize * spriteTilesX * scale
      const tileH = tileSize * spriteTilesY * scale
      ctx.strokeStyle = 'rgba(0, 220, 255, 0.4)'
      ctx.lineWidth = 1
      for (let x = 0; x <= canvas.width; x += tileW) {
        ctx.beginPath()
        ctx.moveTo(x + 0.5, 0)
        ctx.lineTo(x + 0.5, canvas.height)
        ctx.stroke()
      }
      for (let y = 0; y <= canvas.height; y += tileH) {
        ctx.beginPath()
        ctx.moveTo(0, y + 0.5)
        ctx.lineTo(canvas.width, y + 0.5)
        ctx.stroke()
      }
    }
  }, [step, downscaled, tileSize, spriteTilesX, spriteTilesY, sliceMode])

  const toggleTile = useCallback((index: number) => {
    setTileEnabled((prev) => {
      const next = [...prev]
      next[index] = !next[index]
      return next
    })
  }, [])

  const enabledCount = tileEnabled.filter(Boolean).length

  const handleImport = useCallback(() => {
    const selected = previewTiles.filter((_, i) => tileEnabled[i])
    onImport(selected)
  }, [previewTiles, tileEnabled, onImport])

  // Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-secondary border border-border-default rounded-lg shadow-2xl w-[560px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-default shrink-0">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Sparkles size={16} />
            AI Sprite Import
          </h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="px-4 py-2 bg-red-900/40 border-b border-red-700/50 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1">
          {step === 'configure' && (
            <div className="space-y-4">
              {/* Upload zone */}
              {!sourceImage ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    dragOver
                      ? 'border-accent bg-accent/10'
                      : 'border-border-default hover:border-accent/50'
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
                    onChange={handleFileInput}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleClipboardButton()
                    }}
                    className="mt-3 px-3 py-1.5 rounded text-xs bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Clipboard size={12} />
                    Paste from Clipboard
                  </button>
                </div>
              ) : (
                <>
                  {/* Source preview + live preview side by side */}
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
                          setSourceImage(null)
                          setSourceImageData(null)
                          setCandidates([])
                        }}
                        className="text-[10px] text-text-muted hover:text-text-primary mt-1 cursor-pointer"
                      >
                        Change image
                      </button>
                    </div>
                    {/* Live preview thumbnail */}
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
                            onClick={() => {
                              setScaleFactor(c.factor)
                              setManualScale('')
                            }}
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
                        onChange={(e) => handleManualScaleChange(e.target.value)}
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
                          onClick={() => setDownscaleMethod(opt.value)}
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
                        onClick={() => setSliceMode('grid')}
                        className={`flex-1 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                          sliceMode === 'grid'
                            ? 'bg-accent text-white'
                            : 'bg-bg-hover text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        Grid Slice
                      </button>
                      <button
                        onClick={() => setSliceMode('auto')}
                        className={`flex-1 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                          sliceMode === 'auto'
                            ? 'bg-accent text-white'
                            : 'bg-bg-hover text-text-secondary hover:text-text-primary'
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
                      {/* Tile size */}
                      <div>
                        <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">
                          Target Tile Size
                        </label>
                        <div className="flex gap-1.5 mb-2">
                          {tilePresets.map((size) => (
                            <button
                              key={size}
                              onClick={() => setTileSize(size)}
                              className={`flex-1 py-1.5 rounded text-xs font-mono transition-colors cursor-pointer ${
                                tileSize === size
                                  ? 'bg-accent text-white'
                                  : 'bg-bg-hover text-text-secondary hover:text-text-primary'
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
                          onChange={(e) => setTileSize(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full px-2 py-1 rounded bg-bg-primary border border-border-default text-text-primary text-xs font-mono focus:border-accent focus:outline-none"
                        />
                      </div>

                      {sourceImage && (tileSize > trueWidth || tileSize > trueHeight) && (
                        <p className="text-[10px] text-yellow-400">
                          Tile size {tileSize}px is larger than the true resolution ({trueWidth}x{trueHeight}) — this will produce 0 sprites. Reduce tile size.
                        </p>
                      )}

                      {/* Sprite layout */}
                      <div>
                        <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">
                          Sprite Layout (tiles per sprite)
                        </label>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-text-secondary">W</span>
                            <input
                              type="number"
                              min={1}
                              max={16}
                              value={spriteTilesX}
                              onChange={(e) =>
                                setSpriteTilesX(Math.max(1, Math.min(16, parseInt(e.target.value) || 1)))
                              }
                              className="w-14 px-2 py-1 rounded bg-bg-primary border border-border-default text-text-primary text-xs font-mono focus:border-accent focus:outline-none"
                            />
                          </div>
                          <span className="text-text-muted">x</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-text-secondary">H</span>
                            <input
                              type="number"
                              min={1}
                              max={16}
                              value={spriteTilesY}
                              onChange={(e) =>
                                setSpriteTilesY(Math.max(1, Math.min(16, parseInt(e.target.value) || 1)))
                              }
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
                        <input
                          type="range"
                          min={1}
                          max={64}
                          value={autoMinPixels}
                          onChange={(e) => setAutoMinPixels(Number(e.target.value))}
                          className="flex-1 accent-accent"
                        />
                        <span className="text-[10px] text-text-muted font-mono w-8 text-right">
                          {autoMinPixels}px
                        </span>
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
                        <input
                          type="checkbox"
                          checked={skipEmpty}
                          onChange={(e) => setSkipEmpty(e.target.checked)}
                          className="accent-accent"
                        />
                        <span className="text-xs text-text-secondary">Skip empty (transparent) tiles</span>
                      </label>
                    )}

                    {/* Edge cleanup */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={doCleanEdges}
                        onChange={(e) => setDoCleanEdges(e.target.checked)}
                        className="accent-accent"
                      />
                      <span className="text-xs text-text-secondary">Clean semi-transparent edges</span>
                    </label>
                    {doCleanEdges && (
                      <div className="flex items-center gap-2 ml-5">
                        <span className="text-[10px] text-text-muted">Alpha threshold:</span>
                        <input
                          type="range"
                          min={1}
                          max={254}
                          value={cleanEdgesThreshold}
                          onChange={(e) => setCleanEdgesThreshold(Number(e.target.value))}
                          className="flex-1 accent-accent"
                        />
                        <span className="text-[10px] text-text-muted font-mono w-6 text-right">
                          {cleanEdgesThreshold}
                        </span>
                      </div>
                    )}

                    {/* Background removal */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={removeBg}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setRemoveBg(checked)
                          if (checked && sourceImageData && !bgColor) {
                            worker.detectBgColor(sourceImageData).then(setBgColor)
                          }
                        }}
                        className="accent-accent"
                      />
                      <span className="text-xs text-text-secondary">Remove background color</span>
                    </label>
                    {removeBg && bgColor && (
                      <div className="ml-5 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-text-muted">Detected:</span>
                          <div
                            className="w-5 h-5 rounded border border-border-default"
                            style={{ backgroundColor: `rgba(${bgColor.r},${bgColor.g},${bgColor.b},${bgColor.a / 255})` }}
                            title={`rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`}
                          />
                          <span className="text-[10px] text-text-muted font-mono">
                            rgb({bgColor.r}, {bgColor.g}, {bgColor.b})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-text-muted">Tolerance:</span>
                          <input
                            type="range"
                            min={0}
                            max={80}
                            value={bgTolerance}
                            onChange={(e) => setBgTolerance(Number(e.target.value))}
                            className="flex-1 accent-accent"
                          />
                          <span className="text-[10px] text-text-muted font-mono w-6 text-right">
                            {bgTolerance}
                          </span>
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
                            onClick={() => setQuantizeMode(opt.value)}
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
                          <input
                            type="range"
                            min={5}
                            max={80}
                            value={quantizeThreshold}
                            onChange={(e) => setQuantizeThreshold(Number(e.target.value))}
                            className="flex-1 accent-accent"
                          />
                          <span className="text-[10px] text-text-muted font-mono w-6 text-right">
                            {quantizeThreshold}
                          </span>
                        </div>
                      )}

                      {quantizeMode === 'median' && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-text-muted">Max colors:</span>
                          <input
                            type="range"
                            min={2}
                            max={64}
                            value={medianMaxColors}
                            onChange={(e) => setMedianMaxColors(Number(e.target.value))}
                            className="flex-1 accent-accent"
                          />
                          <span className="text-[10px] text-text-muted font-mono w-6 text-right">
                            {medianMaxColors}
                          </span>
                        </div>
                      )}

                      {quantizeMode === 'palette' && (
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              onClick={() => setSelectedPalette('project')}
                              className={`px-2 py-1 rounded text-[10px] transition-colors cursor-pointer ${
                                selectedPalette === 'project'
                                  ? 'bg-accent text-white'
                                  : 'bg-bg-hover text-text-secondary hover:text-text-primary'
                              }`}
                            >
                              Project ({paletteColors.length})
                            </button>
                            {presetPalettes.map((p) => (
                              <button
                                key={p.name}
                                onClick={() => setSelectedPalette(p.name)}
                                className={`px-2 py-1 rounded text-[10px] transition-colors cursor-pointer ${
                                  selectedPalette === p.name
                                    ? 'bg-accent text-white'
                                    : 'bg-bg-hover text-text-secondary hover:text-text-primary'
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
                          {/* Palette color swatches */}
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
          )}

          {step === 'preview' && downscaled && (
            <div className="space-y-4">
              {/* Downscaled preview with grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-text-muted">
                    Downscaled: {downscaled.width} x {downscaled.height} px
                  </p>
                  <p className="text-xs text-text-muted">
                    {colorCount} unique color{colorCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex justify-center bg-bg-primary rounded border border-border-default p-2">
                  <canvas
                    ref={previewCanvasRef}
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
              </div>

              {/* Sprite thumbnails — clickable to toggle */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-text-muted">
                    {enabledCount} of {previewTiles.length} sprite{previewTiles.length !== 1 ? 's' : ''} selected
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTileEnabled(new Array(previewTiles.length).fill(true))}
                      className="text-[10px] text-text-muted hover:text-text-primary cursor-pointer"
                    >
                      Select all
                    </button>
                    <button
                      onClick={() => setTileEnabled(new Array(previewTiles.length).fill(false))}
                      className="text-[10px] text-text-muted hover:text-text-primary cursor-pointer"
                    >
                      Deselect all
                    </button>
                  </div>
                </div>
                {previewTiles.length === 0 && downscaled && (
                  <p className="text-[10px] text-yellow-400">
                    {sliceMode === 'grid'
                      ? `The downscaled image (${downscaled.width}x${downscaled.height}) is smaller than the tile size. Go back and reduce the tile size or scale factor.`
                      : 'No non-transparent regions found. Go back and adjust background removal or edge cleanup settings.'}
                  </p>
                )}
                <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                  {previewTiles.map((tile, i) => (
                    <SpriteThumbnail
                      key={i}
                      imageData={tile}
                      enabled={tileEnabled[i]}
                      onClick={() => toggleTile(i)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-4 py-3 border-t border-border-default shrink-0">
          <div>
            {step === 'preview' && (
              <button
                onClick={() => setStep('configure')}
                className="px-3 py-1.5 rounded text-xs text-text-secondary hover:text-text-primary bg-bg-hover transition-colors cursor-pointer flex items-center gap-1"
              >
                <ArrowLeft size={12} />
                Back
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded text-xs text-text-secondary hover:text-text-primary bg-bg-hover transition-colors cursor-pointer"
            >
              Cancel
            </button>
            {step === 'configure' && (
              <button
                onClick={generatePreview}
                disabled={!sourceImageData || processing}
                className="px-4 py-1.5 rounded text-xs bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Next: Preview
                    <ArrowRight size={12} />
                  </>
                )}
              </button>
            )}
            {step === 'preview' && (
              <>
                <button
                  onClick={() => downscaled && onLoadAsTileset(downscaled, tileSize)}
                  disabled={!downscaled}
                  className="px-4 py-1.5 rounded text-xs text-text-secondary hover:text-text-primary bg-bg-hover transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Load as Tileset
                </button>
                <button
                  onClick={handleImport}
                  disabled={enabledCount === 0}
                  className="px-4 py-1.5 rounded text-xs bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download size={13} />
                  Import {enabledCount} Sprite{enabledCount !== 1 ? 's' : ''}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Renders a single sprite tile as a clickable thumbnail */
function SpriteThumbnail({ imageData, enabled, onClick }: { imageData: ImageData; enabled: boolean; onClick: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = 48
    canvas.height = 48
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Checkerboard background
    for (let y = 0; y < 48; y += 4) {
      for (let x = 0; x < 48; x += 4) {
        ctx.fillStyle = ((x / 4 + y / 4) | 0) % 2 === 0 ? '#2a2a2a' : '#3a3a3a'
        ctx.fillRect(x, y, 4, 4)
      }
    }

    const tmp = document.createElement('canvas')
    tmp.width = imageData.width
    tmp.height = imageData.height
    const tmpCtx = tmp.getContext('2d')
    if (!tmpCtx) return
    tmpCtx.putImageData(imageData, 0, 0)
    ctx.imageSmoothingEnabled = false
    // Fit aspect ratio
    const scale = Math.min(48 / imageData.width, 48 / imageData.height)
    const dw = imageData.width * scale
    const dh = imageData.height * scale
    ctx.drawImage(tmp, (48 - dw) / 2, (48 - dh) / 2, dw, dh)
  }, [imageData])

  return (
    <canvas
      ref={canvasRef}
      width={48}
      height={48}
      onClick={onClick}
      className={`rounded border-2 cursor-pointer transition-all ${
        enabled
          ? 'border-accent opacity-100'
          : 'border-border-default opacity-40'
      }`}
      style={{ imageRendering: 'pixelated' }}
      title={`${imageData.width}x${imageData.height} — click to ${enabled ? 'deselect' : 'select'}`}
    />
  )
}
