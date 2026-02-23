import { useRef, useEffect, useCallback } from 'react'
import { Package, Trash2, X } from 'lucide-react'
import type { SpriteEntry } from '../App'

interface SpriteBankProps {
  sprites: SpriteEntry[]
  onRemove: (id: string) => void
  onOpenExport: () => void
}

function SpriteThumb({ sprite }: { sprite: SpriteEntry }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width = sprite.width
    canvas.height = sprite.height
    ctx.imageSmoothingEnabled = false
    ctx.putImageData(sprite.imageData, 0, 0)
  }, [sprite])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: 48,
        height: 48,
        imageRendering: 'pixelated',
      }}
    />
  )
}

export function SpriteBank({ sprites, onRemove, onOpenExport }: SpriteBankProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const prevCount = useRef(sprites.length)
  useEffect(() => {
    if (sprites.length > prevCount.current && scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
    prevCount.current = sprites.length
  }, [sprites.length])

  const handleClearAll = useCallback(() => {
    sprites.forEach((s) => onRemove(s.id))
  }, [sprites, onRemove])

  return (
    <div className="h-20 bg-bg-panel border-t border-border-default flex items-center shrink-0">
      {/* Label */}
      <div className="flex flex-col items-center justify-center gap-1 px-3 border-r border-border-default h-full min-w-[100px]">
        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
          Sprite Bank
        </span>
        <span className="text-[10px] text-text-muted">{sprites.length} sprites</span>
      </div>

      {/* Sprite list */}
      <div ref={scrollRef} className="flex-1 flex items-center gap-1 px-2 overflow-x-auto h-full">
        {sprites.length === 0 ? (
          <span className="text-xs text-text-muted px-2">
            Save tiles from the editor to build your collection
          </span>
        ) : (
          sprites.map((sprite) => (
            <div
              key={sprite.id}
              className="relative group shrink-0 border border-border-default rounded p-0.5 hover:border-accent transition-colors"
              style={{
                background: `
                  repeating-conic-gradient(#1a1a2e 0% 25%, #0f0f1e 0% 50%)
                  50% / 8px 8px
                `,
              }}
              title={sprite.name}
            >
              <SpriteThumb sprite={sprite} />
              <button
                onClick={() => onRemove(sprite.id)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <X size={10} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1 px-3 border-l border-border-default h-full justify-center">
        <button
          onClick={onOpenExport}
          disabled={sprites.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Package size={13} />
          Export .zip
        </button>
        <button
          onClick={handleClearAll}
          disabled={sprites.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Trash2 size={13} />
          Clear All
        </button>
      </div>
    </div>
  )
}
