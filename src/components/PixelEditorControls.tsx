import {
  Trash2, Download, FlipHorizontal2, FlipVertical2,
  Save, Repeat, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Layers, Plus,
  RotateCw, RotateCcw, ImageIcon, Grid3x3, Maximize2, Sparkles, Minimize2,
} from 'lucide-react'

interface PixelEditorControlsProps {
  // Mode toggles
  symmetryV: boolean
  setSymmetryV: React.Dispatch<React.SetStateAction<boolean>>
  symmetryH: boolean
  setSymmetryH: React.Dispatch<React.SetStateAction<boolean>>
  wrapAround: boolean
  setWrapAround: React.Dispatch<React.SetStateAction<boolean>>
  onionSkin: boolean
  setOnionSkin: React.Dispatch<React.SetStateAction<boolean>>
  onionSkinData: ImageData | null
  lockAlpha: boolean
  setLockAlpha: React.Dispatch<React.SetStateAction<boolean>>
  showTiling: boolean
  setShowTiling: React.Dispatch<React.SetStateAction<boolean>>
  // Info
  spriteW: number
  spriteH: number
  zoom: number
  // Nudge
  nudge: (dx: number, dy: number) => void
  fitView: () => void
  // Transform
  handleRotate: (dir: 'cw' | 'ccw') => void
  handleFlip: (axis: 'horizontal' | 'vertical') => void
  // Reference image
  refImage: HTMLImageElement | null
  setRefImage: (img: HTMLImageElement | null) => void
  refOpacity: number
  setRefOpacity: (v: number) => void
  showRef: boolean
  setShowRef: React.Dispatch<React.SetStateAction<boolean>>
  refInputRef: React.RefObject<HTMLInputElement | null>
  handleLoadRef: (e: React.ChangeEvent<HTMLInputElement>) => void
  // Actions
  tileData: ImageData | null
  onClear: () => void
  handleDownload: () => void
  isEditingBank: boolean
  onSaveToBank: () => void
  onUpdateInBank: () => void
  onOutlineEffect: () => void
  onOpenResize: () => void
}

export function PixelEditorControls({
  symmetryV, setSymmetryV,
  symmetryH, setSymmetryH,
  wrapAround, setWrapAround,
  onionSkin, setOnionSkin,
  onionSkinData,
  lockAlpha, setLockAlpha,
  showTiling, setShowTiling,
  spriteW, spriteH, zoom,
  nudge, fitView,
  handleRotate, handleFlip,
  refImage, setRefImage,
  refOpacity, setRefOpacity,
  showRef, setShowRef,
  refInputRef, handleLoadRef,
  tileData, onClear, handleDownload,
  isEditingBank, onSaveToBank, onUpdateInBank,
  onOutlineEffect, onOpenResize,
}: PixelEditorControlsProps) {
  return (
    <>
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
      <div className="flex gap-1.5 mb-1.5">
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
        <button
          onClick={() => setLockAlpha((v) => !v)}
          className={`flex-1 flex items-center justify-center gap-1 px-1 py-1 rounded text-[11px] transition-colors cursor-pointer ${
            lockAlpha ? 'bg-orange-600 text-white' : 'bg-bg-hover text-text-secondary hover:text-text-primary'
          }`}
          title="Lock alpha: paint only on existing pixels"
          aria-label="Toggle lock alpha"
        >
          <ImageIcon size={12} />
          Lock α
        </button>
      </div>
      {/* Mode toggles row 3 */}
      <div className="flex gap-1.5 mb-3">
        <button
          onClick={() => setShowTiling((v) => !v)}
          className={`flex-1 flex items-center justify-center gap-1 px-1 py-1 rounded text-[11px] transition-colors cursor-pointer ${
            showTiling ? 'bg-teal-600 text-white' : 'bg-bg-hover text-text-secondary hover:text-text-primary'
          }`}
          title="Tiling preview: show 3×3 repeat of the tile"
          aria-label="Toggle tiling preview"
        >
          <Grid3x3 size={12} />
          Tile
        </button>
        <button
          onClick={onOutlineEffect}
          disabled={!tileData}
          className="flex-1 flex items-center justify-center gap-1 px-1 py-1 rounded text-[11px] transition-colors cursor-pointer bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
          title="Add outline to sprite edges"
          aria-label="Add outline"
        >
          <Sparkles size={12} />
          Outline
        </button>
        <button
          onClick={onOpenResize}
          disabled={!tileData}
          className="flex-1 flex items-center justify-center gap-1 px-1 py-1 rounded text-[11px] transition-colors cursor-pointer bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
          title="Resize/crop canvas"
          aria-label="Resize canvas"
        >
          <Maximize2 size={12} />
          Resize
        </button>
      </div>

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
        <div className="flex items-center gap-1">
          <button
            onClick={fitView}
            className="p-0.5 rounded bg-bg-hover text-text-secondary hover:text-text-primary cursor-pointer"
            title="Fit to view (0)"
            aria-label="Fit to view"
          >
            <Minimize2 size={12} />
          </button>
        </div>
        <p className="text-xs text-text-muted">
          {spriteW}x{spriteH}
          <span className="ml-2">{Math.round(zoom * 100)}%</span>
          {wrapAround && <span className="text-green-400 ml-1">wrap</span>}
          {onionSkin && onionSkinData && <span className="text-purple-400 ml-1">onion</span>}
          {lockAlpha && <span className="text-orange-400 ml-1">lock α</span>}
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
    </>
  )
}
