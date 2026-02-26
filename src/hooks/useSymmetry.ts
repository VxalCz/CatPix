import { useCallback } from 'react'

interface SymmetryOptions {
  horizontal: boolean
  vertical: boolean
  width: number
  height: number
}

// Reusable singleton for the common "no symmetry" case (zero allocation)
const _singletonPoint: Array<{ px: number; py: number }> = [{ px: 0, py: 0 }]

export function useSymmetry({ horizontal, vertical, width, height }: SymmetryOptions) {
  const getMirroredPixels = useCallback(
    (px: number, py: number): Array<{ px: number; py: number }> => {
      // Fast path: no symmetry enabled
      if (!horizontal && !vertical) {
        _singletonPoint[0].px = px
        _singletonPoint[0].py = py
        return _singletonPoint
      }

      const mirrorX = width - 1 - px
      const mirrorY = height - 1 - py

      // Use integer key for dedup (avoids string allocation)
      const seen = new Set<number>()
      const points: Array<{ px: number; py: number }> = []

      const add = (x: number, y: number) => {
        const key = (y << 16) | x
        if (!seen.has(key)) {
          seen.add(key)
          points.push({ px: x, py: y })
        }
      }

      // Original point
      add(px, py)

      // Vertical symmetry = mirror across vertical axis (left/right)
      if (vertical) {
        add(mirrorX, py)
      }

      // Horizontal symmetry = mirror across horizontal axis (top/bottom)
      if (horizontal) {
        add(px, mirrorY)
      }

      // Both = diagonal mirror
      if (vertical && horizontal) {
        add(mirrorX, mirrorY)
      }

      return points
    },
    [horizontal, vertical, width, height],
  )

  return { getMirroredPixels }
}
