import { useRef, useEffect, useState } from 'react'

interface UseAnimationPlayerOptions {
  frameCount: number
  fps: number
  playing: boolean
}

export function useAnimationPlayer({ frameCount, fps, playing }: UseAnimationPlayerOptions) {
  const [currentFrame, setCurrentFrame] = useState(0)
  const lastTimeRef = useRef(0)
  const rafRef = useRef(0)
  const frameCountRef = useRef(frameCount)
  const fpsRef = useRef(fps)

  useEffect(() => {
    frameCountRef.current = frameCount
    fpsRef.current = fps
  })

  useEffect(() => {
    if (!playing || frameCount === 0) return

    lastTimeRef.current = performance.now()

    const tick = (time: number) => {
      const interval = 1000 / fpsRef.current
      if (time - lastTimeRef.current >= interval) {
        lastTimeRef.current = time - ((time - lastTimeRef.current) % interval)
        setCurrentFrame((prev) => (prev + 1) % frameCountRef.current)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing, frameCount])

  // Clamp frame if count changes
  const safeFrame = frameCount > 0 ? currentFrame % frameCount : 0

  return { currentFrame: safeFrame }
}
