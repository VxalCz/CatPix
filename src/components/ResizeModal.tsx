import { useState } from 'react'
import { X, Maximize2 } from 'lucide-react'

interface ResizeModalProps {
  currentWidth: number
  currentHeight: number
  onConfirm: (width: number, height: number, anchorX: number, anchorY: number) => void
  onClose: () => void
}

// anchorX/anchorY: 0 = left/top, 1 = center, 2 = right/bottom
const ANCHOR_LABELS = [
  ['↖', '↑', '↗'],
  ['←', '·', '→'],
  ['↙', '↓', '↘'],
]

export function ResizeModal({ currentWidth, currentHeight, onConfirm, onClose }: ResizeModalProps) {
  const [width, setWidth] = useState(currentWidth)
  const [height, setHeight] = useState(currentHeight)
  const [anchorX, setAnchorX] = useState(0)
  const [anchorY, setAnchorY] = useState(0)

  const handleConfirm = () => {
    const w = Math.max(1, Math.min(4096, width))
    const h = Math.max(1, Math.min(4096, height))
    onConfirm(w, h, anchorX, anchorY)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true">
      <div className="bg-bg-secondary border border-border-default rounded-lg shadow-2xl w-80">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Maximize2 size={16} />
            Resize Canvas
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary cursor-pointer" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Current size */}
          <p className="text-xs text-text-muted">Current: {currentWidth} × {currentHeight} px</p>

          {/* Width / Height */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-secondary block mb-1">Width (px)</label>
              <input
                type="number"
                min={1}
                max={4096}
                value={width}
                onChange={(e) => setWidth(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-2 py-1.5 rounded bg-bg-primary border border-border-default text-text-primary text-sm font-mono focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">Height (px)</label>
              <input
                type="number"
                min={1}
                max={4096}
                value={height}
                onChange={(e) => setHeight(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-2 py-1.5 rounded bg-bg-primary border border-border-default text-text-primary text-sm font-mono focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Anchor selector */}
          <div>
            <label className="text-xs text-text-secondary block mb-2">Anchor (content position)</label>
            <div className="grid grid-cols-3 gap-1 w-24">
              {ANCHOR_LABELS.map((row, rowIdx) =>
                row.map((label, colIdx) => (
                  <button
                    key={`${rowIdx}-${colIdx}`}
                    onClick={() => { setAnchorX(colIdx); setAnchorY(rowIdx) }}
                    className={`w-7 h-7 rounded text-sm transition-colors cursor-pointer ${
                      anchorX === colIdx && anchorY === rowIdx
                        ? 'bg-accent text-white'
                        : 'bg-bg-hover text-text-secondary hover:text-text-primary'
                    }`}
                    title={`Anchor ${label}`}
                  >
                    {label}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Result preview */}
          <p className="text-xs text-text-muted">
            New size: <span className="text-text-primary font-mono">{Math.max(1, width)} × {Math.max(1, height)} px</span>
          </p>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border-default">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded text-xs text-text-secondary hover:text-text-primary bg-bg-hover transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-1.5 rounded text-xs bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer"
          >
            Resize
          </button>
        </div>
      </div>
    </div>
  )
}
