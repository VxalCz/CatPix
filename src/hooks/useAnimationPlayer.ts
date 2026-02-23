import { useRef, useEffect, useCallback, useState } from 'react'

interface UseAnimationPlayerOptions {
  frameCount: number
  fps: number
  playing: boolean
}

export function useAnimationPlayer({ frameCount, fps, playing }: UseAnimationPlayerOptions) {
  const [currentFrame, setCurrentFrame] = useState(0)
  const lastTimeRef = useRef(0)
  const rafRef = useRef(0)

  const tick = useCallback(
    (time: number) => {
      if (frameCount === 0) return

      const interval = 1000 / fps
      if (time - lastTimeRef.current >= interval) {
        lastTimeRef.current = time - ((time - lastTimeRef.current) % interval)
        setCurrentFrame((prev) => (prev + 1) % frameCount)
      }

      rafRef.current = requestAnimationFrame(tick)
    },
    [frameCount, fps],
  )

  useEffect(() => {
    if (playing && frameCount > 0) {
      lastTimeRef.current = performance.now()
      rafRef.current = requestAnimationFrame(tick)
    }
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing, frameCount, tick])

  // Reset frame when count changes
  useEffect(() => {
    if (frameCount > 0) {
      setCurrentFrame((prev) => (prev >= frameCount ? 0 : prev))
    }
  }, [frameCount])

  return { currentFrame }
}
