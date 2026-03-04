import { useRef, useEffect, useState } from 'react'

interface UseAnimationPlayerOptions {
  frameCount: number
  fps: number
  playing: boolean
  frameDurations?: (number | undefined)[]  // per-frame delay in ms; undefined = use global fps
}

export function useAnimationPlayer({ frameCount, fps, playing, frameDurations }: UseAnimationPlayerOptions) {
  const [currentFrame, setCurrentFrame] = useState(0)
  const lastTimeRef = useRef(0)
  const rafRef = useRef(0)
  const frameCountRef = useRef(frameCount)
  const fpsRef = useRef(fps)
  const frameDurationsRef = useRef(frameDurations)

  useEffect(() => {
    frameCountRef.current = frameCount
    fpsRef.current = fps
    frameDurationsRef.current = frameDurations
  })

  useEffect(() => {
    if (!playing || frameCount === 0) return

    lastTimeRef.current = performance.now()
    let frame = 0

    const getInterval = (f: number) => {
      const durations = frameDurationsRef.current
      const d = durations?.[f]
      return d ?? (1000 / fpsRef.current)
    }

    const tick = (time: number) => {
      const interval = getInterval(frame)
      if (time - lastTimeRef.current >= interval) {
        lastTimeRef.current = time - ((time - lastTimeRef.current) % interval)
        frame = (frame + 1) % frameCountRef.current
        setCurrentFrame(frame)
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
