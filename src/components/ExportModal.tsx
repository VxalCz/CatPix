import { useState, useMemo } from 'react'
import { X, Package, Grid3x3, ArrowRight, ArrowDown, LayoutGrid } from 'lucide-react'
import type { SheetLayout, ExportOptions } from '../utils/exportProject'

interface ExportModalProps {
  spriteCount: number
  tileWidth: number
  tileHeight: number
  onExport: (options: ExportOptions) => void
  onClose: () => void
}

const PADDING = 2

const layouts: { key: SheetLayout; label: string; icon: typeof LayoutGrid; desc: string }[] = [
  { key: 'auto', label: 'Auto (Square)', icon: LayoutGrid, desc: 'Roughly square grid' },
  { key: 'horizontal', label: 'Horizontal Strip', icon: ArrowRight, desc: 'All sprites in 1 row' },
  { key: 'vertical', label: 'Vertical Strip', icon: ArrowDown, desc: 'All sprites in 1 column' },
  { key: 'custom', label: 'Custom Columns', icon: Grid3x3, desc: 'Set exact column count' },
]

export function ExportModal({
  spriteCount,
  tileWidth,
  tileHeight,
  onExport,
  onClose,
}: ExportModalProps) {
  const [layout, setLayout] = useState<SheetLayout>('auto')
  const [customCols, setCustomCols] = useState(
    Math.ceil(Math.sqrt(spriteCount)),
  )

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
    const cellW = tileWidth + PADDING * 2
    const cellH = tileHeight + PADDING * 2
    return {
      cols,
      rows,
      sheetW: cols * cellW,
      sheetH: rows * cellH,
    }
  }, [layout, customCols, spriteCount, tileWidth, tileHeight])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-secondary border border-border-default rounded-lg shadow-2xl w-[420px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Package size={16} />
            Export Sprite Sheet
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
              <span className="text-text-primary font-mono">{PADDING}px per side</span>
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
            onClick={() => onExport({ layout, customCols })}
            className="px-4 py-1.5 rounded text-xs bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Package size={13} />
            Export .zip
          </button>
        </div>
      </div>
    </div>
  )
}
