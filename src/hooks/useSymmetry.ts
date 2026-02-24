import { useCallback } from 'react'

interface SymmetryOptions {
  horizontal: boolean
  vertical: boolean
  width: number
  height: number
}

export function useSymmetry({ horizontal, vertical, width, height }: SymmetryOptions) {
  const getMirroredPixels = useCallback(
    (px: number, py: number): Array<{ px: number; py: number }> => {
      const mirrorX = width - 1 - px
      const mirrorY = height - 1 - py

      // Use a Set-like approach to deduplicate (important for odd grids
      // where the center pixel mirrors onto itself)
      const seen = new Set<string>()
      const points: Array<{ px: number; py: number }> = []

      const add = (x: number, y: number) => {
        const key = `${x},${y}`
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
