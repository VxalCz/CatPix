import type { BrushShape } from '../state/appReducer'

export interface BrushOffset {
  dx: number
  dy: number
}

/**
 * Generates a brush stamp - an array of pixel offsets relative to the center.
 * For a brush of size 1, returns [{0, 0}].
 * For larger brushes, generates a square or circle pattern.
 */
export function generateBrushStamp(size: number, shape: BrushShape): BrushOffset[] {
  if (size < 1) return [{ dx: 0, dy: 0 }]

  const offsets: BrushOffset[] = []

  if (shape === 'square' || shape === 'dither') {
    // Square brush: simple NxN grid centered on the cursor
    const half = Math.floor(size / 2)
    for (let dy = -half; dy < size - half; dy++) {
      for (let dx = -half; dx < size - half; dx++) {
        offsets.push({ dx, dy })
      }
    }
  } else {
    // Circle brush: use distance from center
    const radius = size / 2
    const half = Math.floor(size / 2)
    const centerX = (size - 1) / 2
    const centerY = (size - 1) / 2

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Use floating-point center for accurate circle check
        const fdx = x - centerX
        const fdy = y - centerY
        if (fdx * fdx + fdy * fdy <= radius * radius) {
          // Integer offsets relative to half — každý (x,y) dá jedinečný (dx,dy)
          offsets.push({ dx: x - half, dy: y - half })
        }
      }
    }
  }

  return offsets
}