import { useRef, useEffect, useState } from 'react'
import { Play, Pause, Film } from 'lucide-react'
import type { SpriteEntry } from '../App'
import { useAnimationPlayer } from '../hooks/useAnimationPlayer'

interface AnimationPreviewProps {
  sprites: SpriteEntry[]
}

const PREVIEW_SIZE = 96

export function AnimationPreview({ sprites }: AnimationPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [fps, setFps] = useState(8)
  const [playing, setPlaying] = useState(true)

  const { currentFrame } = useAnimationPlayer({
    frameCount: sprites.length,
    fps,
    playing,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    if (sprites.length === 0) {
      canvas.width = PREVIEW_SIZE
      canvas.height = PREVIEW_SIZE
      ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE)
      return
    }

    const sprite = sprites[currentFrame]
    if (!sprite) return

    canvas.width = sprite.width
    canvas.height = sprite.height
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, sprite.width, sprite.height)
    ctx.putImageData(sprite.imageData, 0, 0)
  }, [sprites, currentFrame])

  return (
    <div className="p-3 border-b border-border-default">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        <span className="inline-flex items-center gap-1.5">
          <Film size={12} />
          Animation Preview
        </span>
      </h3>

      {/* Preview canvas */}
      <div
        className="relative mx-auto border border-border-default rounded flex items-center justify-center"
        style={{
          width: PREVIEW_SIZE,
          height: PREVIEW_SIZE,
          background: `
            repeating-conic-gradient(#1a1a2e 0% 25%, #0f0f1e 0% 50%)
            50% / 8px 8px
          `,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: PREVIEW_SIZE,
            height: PREVIEW_SIZE,
            imageRendering: 'pixelated',
          }}
        />
        {sprites.length === 0 && (
          <span className="absolute text-[10px] text-text-muted">No frames</span>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={() => setPlaying((p) => !p)}
          disabled={sprites.length === 0}
          className="p-1 rounded bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <input
          type="range"
          min={1}
          max={24}
          value={fps}
          onChange={(e) => setFps(Number(e.target.value))}
          className="flex-1 accent-accent"
          title={`${fps} FPS`}
        />
        <span className="text-[11px] font-mono text-text-secondary w-10 text-right">
          {fps} fps
        </span>
      </div>

      {/* Frame info */}
      {sprites.length > 0 && (
        <p className="text-[10px] text-text-muted text-center mt-1">
          Frame {currentFrame + 1} / {sprites.length}
        </p>
      )}
    </div>
  )
}
