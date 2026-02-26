import { useRef, useEffect, useCallback } from 'react'

interface UseCanvasOptions {
  width: number
  height: number
  draw: (ctx: CanvasRenderingContext2D) => void
}

export function useCanvas({ width, height, draw }: UseCanvasOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    draw(ctx)
  }, [draw])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Guard dimension assignment to avoid unnecessary context reset
    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== height) canvas.height = height
    redraw()
  }, [width, height, redraw])

  return { canvasRef, redraw }
}
