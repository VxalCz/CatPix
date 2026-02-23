import { Upload, Grid3x3, Pencil, Eraser, AlertTriangle, Palette, FilePlus, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { PaletteColor } from '../hooks/usePalette'
import { presetPalettes } from '../data/presetPalettes'

export type Tool = 'draw' | 'erase'

interface SidebarProps {
  gridSize: number
  onGridSizeChange: (size: number) => void
  onUpload: () => void
  onNewProject: () => void
  activeTool: Tool
  onToolChange: (tool: Tool) => void
  activeColor: string
  onColorChange: (color: string) => void
  palette: PaletteColor[]
  paletteTruncated: boolean
  paletteTotalUnique: number
}

const tools: { icon: typeof Pencil; label: string; key: Tool }[] = [
  { icon: Pencil, label: 'Draw (D)', key: 'draw' },
  { icon: Eraser, label: 'Erase (E)', key: 'erase' },
]

export function Sidebar({
  gridSize,
  onGridSizeChange,
  onUpload,
  onNewProject,
  activeTool,
  onToolChange,
  activeColor,
  onColorChange,
  palette,
  paletteTruncated,
  paletteTotalUnique,
}: SidebarProps) {
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [showPresets, setShowPresets] = useState(false)

  const presetColors = activePreset
    ? presetPalettes.find((p) => p.name === activePreset)?.colors ?? []
    : []

  // Show image palette if available, otherwise show preset
  const displayColors = palette.length > 0 ? palette : null
  const displayPreset = presetColors.length > 0 ? presetColors : null

  return (
    <div className="w-52 bg-bg-panel border-r border-border-default flex flex-col">
      {/* Upload + New */}
      <div className="p-3 border-b border-border-default space-y-1.5">
        <button
          onClick={onUpload}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors cursor-pointer"
        >
          <Upload size={16} />
          Upload Tileset
        </button>
        <button
          onClick={onNewProject}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-bg-hover hover:bg-border-default text-text-secondary hover:text-text-primary text-sm transition-colors cursor-pointer"
        >
          <FilePlus size={16} />
          New Blank Tile
        </button>
      </div>

      {/* Tools */}
      <div className="p-3 border-b border-border-default">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
          Tools
        </h3>
        <div className="flex gap-1">
          {tools.map((tool) => (
            <button
              key={tool.key}
              onClick={() => onToolChange(tool.key)}
              className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-md transition-colors cursor-pointer text-xs ${
                activeTool === tool.key
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
              title={tool.label}
            >
              <tool.icon size={18} />
              {tool.label.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Active Color */}
      <div className="p-3 border-b border-border-default">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
          Color
        </h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <div
              className="w-10 h-10 rounded border border-border-default cursor-pointer"
              style={{
                backgroundColor: activeColor,
                background: activeColor === 'transparent'
                  ? 'repeating-conic-gradient(#444 0% 25%, #888 0% 50%) 50% / 8px 8px'
                  : activeColor,
              }}
            />
            <input
              type="color"
              value={activeColor.startsWith('#') ? activeColor.slice(0, 7) : '#000000'}
              onChange={(e) => onColorChange(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>
          <span className="text-xs font-mono text-text-secondary">{activeColor}</span>
        </div>
      </div>

      {/* Palette */}
      <div className="p-3 border-b border-border-default flex-1 overflow-y-auto min-h-0">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
          <span className="inline-flex items-center gap-1.5">
            <Palette size={12} />
            Palette
          </span>
        </h3>

        {/* Preset selector */}
        <div className="relative mb-2">
          <button
            onClick={() => setShowPresets((v) => !v)}
            className="w-full flex items-center justify-between px-2 py-1 rounded text-[11px] bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            <span>{activePreset ?? 'Preset palettes...'}</span>
            <ChevronDown size={12} className={`transition-transform ${showPresets ? 'rotate-180' : ''}`} />
          </button>
          {showPresets && (
            <div className="absolute z-10 top-full left-0 right-0 mt-0.5 bg-bg-secondary border border-border-default rounded shadow-lg overflow-hidden">
              {activePreset && (
                <button
                  onClick={() => { setActivePreset(null); setShowPresets(false) }}
                  className="w-full text-left px-2 py-1.5 text-[11px] text-text-muted hover:bg-bg-hover transition-colors cursor-pointer"
                >
                  Clear preset
                </button>
              )}
              {presetPalettes.map((p) => (
                <button
                  key={p.name}
                  onClick={() => {
                    setActivePreset(p.name)
                    setShowPresets(false)
                    onColorChange(p.colors[0])
                  }}
                  className={`w-full text-left px-2 py-1.5 text-[11px] transition-colors cursor-pointer flex items-center gap-2 ${
                    activePreset === p.name
                      ? 'bg-accent text-white'
                      : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                  }`}
                >
                  <span className="flex gap-px">
                    {p.colors.slice(0, 6).map((c) => (
                      <span key={c} className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c }} />
                    ))}
                  </span>
                  <span>{p.name} ({p.colors.length})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {paletteTruncated && (
          <div className="flex items-start gap-1.5 mb-2 p-1.5 rounded bg-yellow-900/30 text-yellow-400 text-[10px] leading-tight">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            <span>
              Image has {paletteTotalUnique} unique colors. Showing top 64 most frequent.
            </span>
          </div>
        )}

        {/* Image palette */}
        {displayColors && (
          <>
            {displayPreset && (
              <p className="text-[10px] text-text-muted mb-1">From image ({displayColors.length})</p>
            )}
            <div className="grid grid-cols-6 gap-0.5">
              {displayColors.map((color) => (
                <button
                  key={color.hex}
                  onClick={() => onColorChange(color.hex)}
                  className={`w-full aspect-square rounded-sm border cursor-pointer transition-transform hover:scale-110 ${
                    activeColor === color.hex
                      ? 'border-white ring-1 ring-white scale-110'
                      : 'border-border-default'
                  }`}
                  style={{ backgroundColor: color.hex }}
                  title={`${color.hex} (${color.count}px)`}
                />
              ))}
            </div>
          </>
        )}

        {/* Preset palette */}
        {displayPreset && (
          <>
            {displayColors && (
              <p className="text-[10px] text-text-muted mb-1 mt-2">{activePreset}</p>
            )}
            <div className="grid grid-cols-6 gap-0.5">
              {displayPreset.map((hex) => (
                <button
                  key={hex}
                  onClick={() => onColorChange(hex)}
                  className={`w-full aspect-square rounded-sm border cursor-pointer transition-transform hover:scale-110 ${
                    activeColor === hex
                      ? 'border-white ring-1 ring-white scale-110'
                      : 'border-border-default'
                  }`}
                  style={{ backgroundColor: hex }}
                  title={hex}
                />
              ))}
            </div>
          </>
        )}

        {!displayColors && !displayPreset && (
          <p className="text-[11px] text-text-muted">Upload an image or pick a preset palette</p>
        )}
      </div>

      {/* Grid Settings */}
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

      {/* Footer */}
      <div className="p-3 border-t border-border-default text-xs text-text-muted text-center">
        CatPix v0.1
      </div>
    </div>
  )
}
