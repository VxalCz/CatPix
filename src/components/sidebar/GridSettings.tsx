import { Grid3x3 } from 'lucide-react'

interface GridSettingsProps {
  gridSize: number
  onGridSizeChange: (size: number) => void
  tileCountX: number
  tileCountY: number
  onTileCountXChange: (count: number) => void
  onTileCountYChange: (count: number) => void
}

export function GridSettings({
  gridSize, onGridSizeChange,
  tileCountX, tileCountY,
  onTileCountXChange, onTileCountYChange,
}: GridSettingsProps) {
  return (
    <>
      {/* Grid Size */}
      <div className="p-3 border-b border-border-default">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
          <span className="inline-flex items-center gap-1.5">
            <Grid3x3 size={12} />
            Grid Size
          </span>
        </h3>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={8}
              max={128}
              step={8}
              value={gridSize}
              onChange={(e) => onGridSizeChange(Number(e.target.value))}
              className="flex-1 accent-accent"
            />
            <span className="text-sm text-text-primary font-mono w-8 text-right">
              {gridSize}
            </span>
          </div>

          <div className="flex gap-1">
            {[8, 16, 32, 64].map((size) => (
              <button
                key={size}
                onClick={() => onGridSizeChange(size)}
                className={`flex-1 text-xs py-1 rounded transition-colors cursor-pointer ${
                  gridSize === size
                    ? 'bg-accent text-white'
                    : 'bg-bg-hover text-text-secondary hover:text-text-primary'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sprite Size */}
      <div className="p-3 border-b border-border-default">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
          <span className="inline-flex items-center gap-1.5">
            <Grid3x3 size={12} />
            Sprite Size
          </span>
        </h3>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-secondary w-10">W</label>
            <input
              type="number"
              min={1}
              max={8}
              value={tileCountX}
              onChange={(e) => onTileCountXChange(Math.max(1, Math.min(8, parseInt(e.target.value) || 1)))}
              className="flex-1 px-2 py-1 rounded bg-bg-primary border border-border-default text-text-primary text-xs font-mono focus:border-accent focus:outline-none"
            />
            <span className="text-[10px] text-text-muted">tiles</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-secondary w-10">H</label>
            <input
              type="number"
              min={1}
              max={8}
              value={tileCountY}
              onChange={(e) => onTileCountYChange(Math.max(1, Math.min(8, parseInt(e.target.value) || 1)))}
              className="flex-1 px-2 py-1 rounded bg-bg-primary border border-border-default text-text-primary text-xs font-mono focus:border-accent focus:outline-none"
            />
            <span className="text-[10px] text-text-muted">tiles</span>
          </div>
          <p className="text-[10px] text-text-muted">
            {tileCountX * gridSize} x {tileCountY * gridSize} px
          </p>
        </div>
      </div>
    </>
  )
}
