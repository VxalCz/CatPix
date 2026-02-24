import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Sparkles, Upload, ArrowRight, ArrowLeft, Download } from 'lucide-react'
import {
  detectScaleFactor,
  detectBackgroundColor,
  removeBackgroundColor,
  downscaleImage,
  quantizeColors,
  sliceIntoTiles,
  isEmptyTile,
  type ScaleCandidate,
  type DownscaleMethod,
} from '../utils/aiImport'

interface AIImportModalProps {
  gridSize: number
  onImport: (tiles: ImageData[]) => void
  onLoadAsTileset: (image: ImageData, tileSize: number) => void
  onClose: () => void
}

type Step = 'configure' | 'preview'

const tilePresets = [8, 16, 32, 64]

export function AIImportModal({ gridSize, onImport, onLoadAsTileset, onClose }: AIImportModalProps) {
  const [step, setStep] = useState<Step>('configure')

  // Source image
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null)
  const [sourceImageData, setSourceImageData] = useState<ImageData | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

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
  const [doQuantize, setDoQuantize] = useState(false)
  const [quantizeThreshold, setQuantizeThreshold] = useState(20)
  const [removeBg, setRemoveBg] = useState(false)
  const [bgColor, setBgColor] = useState<{ r: number; g: number; b: number; a: number } | null>(null)
  const [bgTolerance, setBgTolerance] = useState(20)

  // Preview data
  const [downscaled, setDownscaled] = useState<ImageData | null>(null)
  const [previewTiles, setPreviewTiles] = useState<ImageData[]>([])
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  const loadImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        setSourceImage(img)
        // Extract ImageData
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        const imgData = ctx.getImageData(0, 0, img.width, img.height)
        setSourceImageData(imgData)

        // Auto-detect
        const results = detectScaleFactor(imgData)
        setCandidates(results)
        if (results.length > 0 && results[0].confidence > 0.7) {
          setScaleFactor(results[0].factor)
        }
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }, [])

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

  // Generate preview when moving to step 2
  const generatePreview = useCallback(() => {
    if (!sourceImageData) return

    let processed = downscaleImage(sourceImageData, scaleFactor, downscaleMethod)
    if (doQuantize) {
      processed = quantizeColors(processed, quantizeThreshold)
    }
    if (removeBg && bgColor) {
      processed = removeBackgroundColor(processed, bgColor, bgTolerance)
    }
    setDownscaled(processed)

    const tileW = tileSize * spriteTilesX
    const tileH = tileSize * spriteTilesY
    let tiles = sliceIntoTiles(processed, tileW, tileH)
    if (skipEmpty) {
      tiles = tiles.filter((t) => !isEmptyTile(t))
    }
    setPreviewTiles(tiles)
    setStep('preview')
  }, [sourceImageData, scaleFactor, downscaleMethod, doQuantize, quantizeThreshold, removeBg, bgColor, bgTolerance, tileSize, spriteTilesX, spriteTilesY, skipEmpty])

  // Draw preview canvas
  useEffect(() => {
    if (step !== 'preview' || !downscaled || !previewCanvasRef.current) return
    const canvas = previewCanvasRef.current
    const ctx = canvas.getContext('2d')!

    // Fit into display area
    const maxDim = 256
    const scale = Math.min(maxDim / downscaled.width, maxDim / downscaled.height, 8)
    canvas.width = downscaled.width * scale
    canvas.height = downscaled.height * scale

    // Draw checkerboard background
    const checkSize = Math.max(4, scale)
    for (let y = 0; y < canvas.height; y += checkSize) {
      for (let x = 0; x < canvas.width; x += checkSize) {
        ctx.fillStyle = ((x / checkSize + y / checkSize) | 0) % 2 === 0 ? '#2a2a2a' : '#3a3a3a'
        ctx.fillRect(x, y, checkSize, checkSize)
      }
    }

    // Draw downscaled image
    const tmpCanvas = new OffscreenCanvas(downscaled.width, downscaled.height)
    const tmpCtx = tmpCanvas.getContext('2d')!
    tmpCtx.putImageData(downscaled, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(tmpCanvas, 0, 0, canvas.width, canvas.height)

    // Draw tile grid overlay
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
  }, [step, downscaled, tileSize, spriteTilesX, spriteTilesY])

  const handleImport = useCallback(() => {
    onImport(previewTiles)
  }, [previewTiles, onImport])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-secondary border border-border-default rounded-lg shadow-2xl w-[520px] max-h-[90vh] flex flex-col">
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
                  <p className="text-xs text-text-muted mt-1">PNG, JPG, WebP</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleFileInput}
                  />
                </div>
              ) : (
                <>
                  {/* Source preview */}
                  <div className="flex items-start gap-3">
                    <img
                      src={sourceImage.src}
                      alt="Source"
                      className="w-20 h-20 object-contain rounded border border-border-default bg-bg-primary"
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

                  {/* Options */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={skipEmpty}
                        onChange={(e) => setSkipEmpty(e.target.checked)}
                        className="accent-accent"
                      />
                      <span className="text-xs text-text-secondary">Skip empty (transparent) tiles</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={doQuantize}
                        onChange={(e) => setDoQuantize(e.target.checked)}
                        className="accent-accent"
                      />
                      <span className="text-xs text-text-secondary">Quantize similar colors</span>
                    </label>
                    {doQuantize && (
                      <div className="flex items-center gap-2 ml-5">
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
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={removeBg}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setRemoveBg(checked)
                          if (checked && sourceImageData && !bgColor) {
                            setBgColor(detectBackgroundColor(sourceImageData))
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
                  </div>
                </>
              )}
            </div>
          )}

          {step === 'preview' && downscaled && (
            <div className="space-y-4">
              {/* Downscaled preview with grid */}
              <div>
                <p className="text-xs text-text-muted mb-2">
                  Downscaled: {downscaled.width} x {downscaled.height} px
                </p>
                <div className="flex justify-center bg-bg-primary rounded border border-border-default p-2">
                  <canvas
                    ref={previewCanvasRef}
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
              </div>

              {/* Sprite thumbnails */}
              <div>
                <p className="text-xs text-text-muted mb-2">
                  {previewTiles.length} sprite{previewTiles.length !== 1 ? 's' : ''} to import
                </p>
                {previewTiles.length === 0 && downscaled && (
                  <p className="text-[10px] text-yellow-400">
                    The downscaled image ({downscaled.width}x{downscaled.height}) is smaller than the tile size. Go back and reduce the tile size or scale factor.
                  </p>
                )}
                <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                  {previewTiles.map((tile, i) => (
                    <SpriteThumbnail key={i} imageData={tile} />
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
                disabled={!sourceImageData}
                className="px-4 py-1.5 rounded text-xs bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next: Preview
                <ArrowRight size={12} />
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
                  disabled={previewTiles.length === 0}
                  className="px-4 py-1.5 rounded text-xs bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download size={13} />
                  Import {previewTiles.length} Sprite{previewTiles.length !== 1 ? 's' : ''}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Renders a single sprite tile as a 48x48 pixelated thumbnail */
function SpriteThumbnail({ imageData }: { imageData: ImageData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = 48
    canvas.height = 48
    const ctx = canvas.getContext('2d')!

    // Checkerboard background
    for (let y = 0; y < 48; y += 4) {
      for (let x = 0; x < 48; x += 4) {
        ctx.fillStyle = ((x / 4 + y / 4) | 0) % 2 === 0 ? '#2a2a2a' : '#3a3a3a'
        ctx.fillRect(x, y, 4, 4)
      }
    }

    const tmp = new OffscreenCanvas(imageData.width, imageData.height)
    const tmpCtx = tmp.getContext('2d')!
    tmpCtx.putImageData(imageData, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(tmp, 0, 0, 48, 48)
  }, [imageData])

  return (
    <canvas
      ref={canvasRef}
      width={48}
      height={48}
      className="rounded border border-border-default"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
