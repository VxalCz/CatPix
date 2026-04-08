import { useState, useRef } from 'react'
import { Palette, FolderOpen, AlertTriangle, ChevronDown } from 'lucide-react'
import { parsePalette } from '../../utils/parsePalette'
import type { PaletteColor } from '../../hooks/usePalette'
import { presetPalettes } from '../../data/presetPalettes'

interface PalettePanelProps {
  activeColor: string
  onColorChange: (color: string) => void
  palette: PaletteColor[]
  paletteTruncated: boolean
  paletteTotalUnique: number
}

export function PalettePanel({
  activeColor, onColorChange,
  palette, paletteTruncated, paletteTotalUnique,
}: PalettePanelProps) {
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [showPresets, setShowPresets] = useState(false)
  const [importedPalette, setImportedPalette] = useState<string[] | null>(null)
  const paletteImportRef = useRef<HTMLInputElement>(null)

  const presetColors = activePreset
    ? presetPalettes.find((p) => p.name === activePreset)?.colors ?? []
    : []

  const displayColors = palette.length > 0 ? palette : null
  const displayPreset = presetColors.length > 0 ? presetColors : null

  return (
    <div className="p-3 border-b border-border-default flex-1 overflow-y-auto min-h-0">
      <input
        ref={paletteImportRef}
        type="file"
        accept=".hex,.gpl"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = () => {
            const colors = parsePalette(reader.result as string, file.name)
            if (colors.length > 0) {
              setImportedPalette(colors)
              onColorChange(colors[0])
            }
          }
          reader.readAsText(file)
          e.target.value = ''
        }}
      />
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          <span className="inline-flex items-center gap-1.5">
            <Palette size={12} />
            Palette
          </span>
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() => paletteImportRef.current?.click()}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            title="Import palette (.hex or .gpl)"
          >
            <FolderOpen size={10} />
            Import
          </button>
          {importedPalette && (
            <button
              onClick={() => setImportedPalette(null)}
              className="px-1.5 py-0.5 rounded text-[10px] bg-bg-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              title="Clear imported palette"
            >
              ×
            </button>
          )}
        </div>
      </div>

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

      {/* Imported palette */}
      {importedPalette && (
        <>
          <p className="text-[10px] text-text-muted mb-1 mt-2">Imported ({importedPalette.length})</p>
          <div className="grid grid-cols-6 gap-0.5">
            {importedPalette.map((hex) => (
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

      {!displayColors && !displayPreset && !importedPalette && (
        <p className="text-[11px] text-text-muted">Upload an image or pick a preset palette</p>
      )}
    </div>
  )
}
