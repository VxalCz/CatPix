import { useState, useEffect, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { hexToHsl, hslToHex, generateColorRamp } from '../../utils/colorUtils'

interface ColorPanelProps {
  activeColor: string
  onColorChange: (color: string) => void
  secondaryColor: string
  onSecondaryColorChange: (color: string) => void
  onSwapColors: () => void
  colorHistory: string[]
  snapToPalette: boolean
  onSnapToPaletteChange: (enabled: boolean) => void
}

export function ColorPanel({
  activeColor, onColorChange,
  secondaryColor, onSecondaryColorChange,
  onSwapColors,
  colorHistory,
  snapToPalette, onSnapToPaletteChange,
}: ColorPanelProps) {
  // HSL sliders state (derived from activeColor, kept in sync)
  const [hsl, setHsl] = useState<[number, number, number]>(() => hexToHsl(activeColor))
  useEffect(() => { setHsl(hexToHsl(activeColor)) }, [activeColor])

  // Color ramp state
  const [showRamp, setShowRamp] = useState(false)
  const [rampFrom, setRampFrom] = useState('#000000')
  const [rampTo, setRampTo] = useState('#ffffff')
  const [rampSteps, setRampSteps] = useState(8)
  const rampColors = useMemo(() => generateColorRamp(rampFrom, rampTo, rampSteps), [rampFrom, rampTo, rampSteps])

  return (
    <div className="p-3 border-b border-border-default">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Color
        </h3>
        <button
          onClick={() => onSnapToPaletteChange(!snapToPalette)}
          className={`px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
            snapToPalette ? 'bg-accent text-white' : 'bg-bg-hover text-text-secondary hover:text-text-primary'
          }`}
          title="Snap to palette: constrain drawing to palette colors"
        >
          Snap
        </button>
      </div>

      {/* FG / BG color indicator */}
      <div className="flex items-center gap-2 mb-2">
        {/* BG (background/secondary) */}
        <div className="relative ml-3 mt-3">
          <div
            className="w-7 h-7 rounded border border-border-default cursor-pointer"
            style={{ backgroundColor: secondaryColor }}
            title={`Secondary color: ${secondaryColor}`}
          />
          <input
            type="color"
            value={secondaryColor.startsWith('#') ? secondaryColor.slice(0, 7) : '#ffffff'}
            onChange={(e) => onSecondaryColorChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label="Pick secondary color"
          />
        </div>
        {/* FG (foreground/primary) - sits on top */}
        <div className="relative -ml-7 -mt-3 z-10">
          <div
            className="w-8 h-8 rounded border-2 border-bg-panel cursor-pointer"
            style={{
              backgroundColor: activeColor,
              background: activeColor === 'transparent'
                ? 'repeating-conic-gradient(#444 0% 25%, #888 0% 50%) 50% / 8px 8px'
                : activeColor,
              outline: '1px solid var(--color-border-default)',
            }}
            title={`Primary color: ${activeColor}`}
          />
          <input
            type="color"
            value={activeColor.startsWith('#') ? activeColor.slice(0, 7) : '#000000'}
            onChange={(e) => onColorChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label="Pick primary color"
          />
        </div>
        {/* Swap button */}
        <button
          onClick={onSwapColors}
          className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          title="Swap fg/bg colors (X)"
          aria-label="Swap colors"
        >
          ⇄ X
        </button>
        <span className="text-xs font-mono text-text-secondary">{activeColor}</span>
      </div>

      {/* HSL sliders */}
      <div className="space-y-1 mb-2">
        {(['H', 'S', 'L'] as const).map((channel, ci) => (
          <div key={channel} className="flex items-center gap-1">
            <span className="text-[10px] text-text-muted w-3">{channel}</span>
            <input
              type="range"
              min={0}
              max={ci === 0 ? 360 : 100}
              value={hsl[ci]}
              onChange={(e) => {
                const newHsl: [number, number, number] = [...hsl] as [number, number, number]
                newHsl[ci] = Number(e.target.value)
                setHsl(newHsl)
                onColorChange(hslToHex(newHsl[0], newHsl[1], newHsl[2]))
              }}
              className="flex-1 accent-accent"
              style={{
                background: ci === 0
                  ? `linear-gradient(to right, hsl(0,${hsl[1]}%,${hsl[2]}%), hsl(60,${hsl[1]}%,${hsl[2]}%), hsl(120,${hsl[1]}%,${hsl[2]}%), hsl(180,${hsl[1]}%,${hsl[2]}%), hsl(240,${hsl[1]}%,${hsl[2]}%), hsl(300,${hsl[1]}%,${hsl[2]}%), hsl(360,${hsl[1]}%,${hsl[2]}%)`
                  : ci === 1
                  ? `linear-gradient(to right, hsl(${hsl[0]},0%,${hsl[2]}%), hsl(${hsl[0]},100%,${hsl[2]}%))`
                  : `linear-gradient(to right, hsl(${hsl[0]},${hsl[1]}%,0%), hsl(${hsl[0]},${hsl[1]}%,50%), hsl(${hsl[0]},${hsl[1]}%,100%)`,
              }}
            />
            <span className="text-[10px] font-mono text-text-primary w-7 text-right">{hsl[ci]}</span>
          </div>
        ))}
      </div>

      {/* Color history */}
      {colorHistory.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] text-text-muted mb-1">Recent</p>
          <div className="flex flex-wrap gap-0.5">
            {colorHistory.map((hex, i) => (
              <button
                key={`${hex}-${i}`}
                onClick={() => onColorChange(hex)}
                className={`w-5 h-5 rounded-sm border cursor-pointer transition-transform hover:scale-110 ${
                  activeColor === hex ? 'border-white ring-1 ring-white' : 'border-border-default'
                }`}
                style={{ backgroundColor: hex }}
                title={hex}
              />
            ))}
          </div>
        </div>
      )}

      {/* Color Ramp Generator */}
      <div className="mt-2">
        <button
          onClick={() => setShowRamp((v) => !v)}
          className="w-full flex items-center justify-between text-[10px] text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
        >
          <span>Color Ramp</span>
          <ChevronDown size={10} className={`transition-transform ${showRamp ? 'rotate-180' : ''}`} />
        </button>
        {showRamp && (
          <div className="mt-1.5 space-y-1.5">
            <div className="flex gap-1 items-center">
              <div className="relative flex-1">
                <div className="w-full h-5 rounded border border-border-default" style={{ backgroundColor: rampFrom }} />
                <input type="color" value={rampFrom} onChange={(e) => setRampFrom(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Ramp start color" />
              </div>
              <span className="text-[10px] text-text-muted">→</span>
              <div className="relative flex-1">
                <div className="w-full h-5 rounded border border-border-default" style={{ backgroundColor: rampTo }} />
                <input type="color" value={rampTo} onChange={(e) => setRampTo(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Ramp end color" />
              </div>
              <button
                onClick={() => { setRampFrom(activeColor); }}
                className="px-1 py-0.5 rounded text-[9px] bg-bg-hover text-text-secondary hover:text-text-primary cursor-pointer"
                title="Set start to active color"
              >←FG</button>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-text-muted">Steps</span>
              <input type="range" min={2} max={16} value={rampSteps}
                onChange={(e) => setRampSteps(Number(e.target.value))}
                className="flex-1 accent-accent" />
              <span className="text-[10px] font-mono text-text-primary w-4 text-right">{rampSteps}</span>
            </div>
            <div className="flex gap-0.5">
              {rampColors.map((hex) => (
                <button
                  key={hex}
                  onClick={() => onColorChange(hex)}
                  className="flex-1 h-5 rounded-sm border border-border-default cursor-pointer hover:scale-110 transition-transform"
                  style={{ backgroundColor: hex }}
                  title={hex}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
