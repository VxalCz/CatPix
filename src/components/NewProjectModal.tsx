import { useState } from 'react'
import { X, FilePlus } from 'lucide-react'

interface NewProjectModalProps {
  onConfirm: (tileSize: number) => void
  onClose: () => void
}

const presets = [8, 16, 32, 64]

export function NewProjectModal({ onConfirm, onClose }: NewProjectModalProps) {
  const [tileSize, setTileSize] = useState(32)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-secondary border border-border-default rounded-lg shadow-2xl w-[340px]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <FilePlus size={16} />
            New Blank Tileset
          </h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">
              Tile Size (px)
            </label>
            <div className="flex gap-1.5 mb-2">
              {presets.map((size) => (
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
              className="w-full px-3 py-1.5 rounded bg-bg-primary border border-border-default text-text-primary text-sm font-mono focus:border-accent focus:outline-none"
            />
          </div>

          <div className="text-xs text-text-muted">
            Creates a blank {tileSize}x{tileSize} canvas ready for pixel art.
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border-default">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded text-xs text-text-secondary hover:text-text-primary bg-bg-hover transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(tileSize)}
            className="px-4 py-1.5 rounded text-xs bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <FilePlus size={13} />
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
