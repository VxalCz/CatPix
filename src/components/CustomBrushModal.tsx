import { useState } from 'react'
import { X, Brush } from 'lucide-react'

const GRID = 8

interface CustomBrushModalProps {
  initial: boolean[][] | null
  onConfirm: (brush: boolean[][]) => void
  onClear: () => void
  onClose: () => void
}

function emptyGrid(): boolean[][] {
  return Array.from({ length: GRID }, () => Array(GRID).fill(false))
}

function centerDot(): boolean[][] {
  const g = emptyGrid()
  const c = Math.floor(GRID / 2)
  g[c][c] = true
  return g
}

export function CustomBrushModal({ initial, onConfirm, onClear, onClose }: CustomBrushModalProps) {
  const [grid, setGrid] = useState<boolean[][]>(() => initial ?? centerDot())
  const [isPainting, setIsPainting] = useState<boolean | null>(null)

  const toggle = (row: number, col: number, paintValue?: boolean) => {
    setGrid((prev) => {
      const next = prev.map((r) => [...r])
      next[row][col] = paintValue !== undefined ? paintValue : !prev[row][col]
      return next
    })
  }

  const handleMouseDown = (row: number, col: number) => {
    const newVal = !grid[row][col]
    setIsPainting(newVal)
    toggle(row, col, newVal)
  }

  const handleMouseEnter = (row: number, col: number) => {
    if (isPainting !== null) {
      toggle(row, col, isPainting)
    }
  }

  const handleMouseUp = () => setIsPainting(null)

  const pixelCount = grid.flat().filter(Boolean).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      onMouseUp={handleMouseUp}
    >
      <div className="bg-bg-secondary border border-border-default rounded-lg shadow-2xl w-72">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Brush size={16} />
            Custom Brush
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary cursor-pointer" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-text-muted">Paint an 8×8 brush pattern. Click/drag to toggle pixels.</p>

          {/* Grid */}
          <div
            className="mx-auto border border-border-default rounded"
            style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID}, 1fr)`, width: 160, userSelect: 'none' }}
          >
            {grid.map((row, ri) =>
              row.map((on, ci) => (
                <div
                  key={`${ri}-${ci}`}
                  className={`cursor-pointer transition-colors ${on ? 'bg-accent' : 'bg-bg-primary hover:bg-bg-hover'}`}
                  style={{ width: 20, height: 20, border: '1px solid var(--color-border-default)' }}
                  onMouseDown={() => handleMouseDown(ri, ci)}
                  onMouseEnter={() => handleMouseEnter(ri, ci)}
                />
              ))
            )}
          </div>

          <p className="text-xs text-text-muted text-center">{pixelCount} pixel{pixelCount !== 1 ? 's' : ''} active</p>

          {/* Quick patterns */}
          <div className="flex gap-1.5">
            <button
              onClick={() => setGrid(centerDot())}
              className="flex-1 py-1 rounded text-[10px] bg-bg-hover text-text-secondary hover:text-text-primary cursor-pointer"
            >
              Center
            </button>
            <button
              onClick={() => setGrid(emptyGrid().map((r, ri) => r.map((_, ci) => ri === ci || ri + ci === GRID - 1)))}
              className="flex-1 py-1 rounded text-[10px] bg-bg-hover text-text-secondary hover:text-text-primary cursor-pointer"
            >
              X
            </button>
            <button
              onClick={() => setGrid(emptyGrid().map((r, ri) => r.map((_, ci) => (ri + ci) % 2 === 0)))}
              className="flex-1 py-1 rounded text-[10px] bg-bg-hover text-text-secondary hover:text-text-primary cursor-pointer"
            >
              Checker
            </button>
            <button
              onClick={() => setGrid(emptyGrid())}
              className="flex-1 py-1 rounded text-[10px] bg-bg-hover text-text-muted hover:text-text-primary cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border-default">
          <button
            onClick={() => { onClear(); onClose() }}
            className="px-3 py-1.5 rounded text-xs text-text-muted hover:text-text-primary bg-bg-hover transition-colors cursor-pointer"
          >
            Reset to Default
          </button>
          <button
            onClick={() => { onConfirm(grid); onClose() }}
            disabled={pixelCount === 0}
            className="px-4 py-1.5 rounded text-xs bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Apply Brush
          </button>
        </div>
      </div>
    </div>
  )
}
