import { hexToRgba } from './colorUtils'

/**
 * For each transparent pixel adjacent (4-way) to a non-transparent pixel,
 * paint it with the outline color.
 */
export function addOutline(imageData: ImageData, color: string): ImageData {
  const { width, height, data } = imageData
  const [r, g, b, a] = hexToRgba(color)
  const result = new ImageData(new Uint8ClampedArray(data), width, height)
  const dst = result.data

  const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]]

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      if (data[idx + 3] > 0) continue  // Not transparent — skip

      // Check if any neighbor is non-transparent
      let hasOpaqueNeighbor = false
      for (const [dx, dy] of neighbors) {
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = (ny * width + nx) * 4
          if (data[nIdx + 3] > 0) {
            hasOpaqueNeighbor = true
            break
          }
        }
      }

      if (hasOpaqueNeighbor) {
        dst[idx] = r
        dst[idx + 1] = g
        dst[idx + 2] = b
        dst[idx + 3] = a
      }
    }
  }

  return result
}
