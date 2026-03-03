/**
 * Magic wand selection - flood-fill based selection with tolerance.
 * Selects contiguous pixels that are similar in color.
 */

export interface SelectionMask {
  width: number
  height: number
  data: Uint8Array // 1 = selected, 0 = not selected
}

/**
 * Calculate color distance between two RGBA values.
 * Uses Manhattan distance in RGB space.
 */
function colorDistance(
  r1: number, g1: number, b1: number, a1: number,
  r2: number, g2: number, b2: number, a2: number,
): number {
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2) + Math.abs(a1 - a2)
}

/**
 * Check if a color matches the target within tolerance.
 */
function colorMatches(
  data: Uint8ClampedArray,
  idx: number,
  targetR: number, targetG: number, targetB: number, targetA: number,
  tolerance: number,
): boolean {
  const r = data[idx]
  const g = data[idx + 1]
  const b = data[idx + 2]
  const a = data[idx + 3]
  return colorDistance(r, g, b, a, targetR, targetG, targetB, targetA) <= tolerance
}

/**
 * Magic wand selection using flood-fill algorithm.
 * Returns a selection mask with 1s for selected pixels.
 */
export function magicWandSelect(
  imageData: ImageData,
  startX: number,
  startY: number,
  tolerance: number,
): SelectionMask {
  const { width, height, data } = imageData
  const mask = new Uint8Array(width * height)

  // Get target color at start position
  const startIdx = (startY * width + startX) * 4
  const targetR = data[startIdx]
  const targetG = data[startIdx + 1]
  const targetB = data[startIdx + 2]
  const targetA = data[startIdx + 3]

  // BFS flood-fill with Uint8Array visited buffer and index-based queue
  const visited = new Uint8Array(width * height)
  const queue: number[] = [startX, startY] // flat pairs [x0, y0, x1, y1, ...]
  let head = 0

  // Scale tolerance by 4 to match the RGBA Manhattan distance range (0–1020 for 4 channels)
  const scaledTolerance = tolerance * 4

  while (head < queue.length) {
    const x = queue[head++]
    const y = queue[head++]

    if (x < 0 || x >= width || y < 0 || y >= height) continue
    const pos = y * width + x
    if (visited[pos]) continue

    const idx = pos * 4
    if (!colorMatches(data, idx, targetR, targetG, targetB, targetA, scaledTolerance)) continue

    visited[pos] = 1
    mask[pos] = 1

    // Add neighbors
    queue.push(x - 1, y, x + 1, y, x, y - 1, x, y + 1)
  }

  return { width, height, data: mask }
}

/**
 * Convert a selection mask to a bounding box selection rect.
 */
export function maskToBoundingBox(mask: SelectionMask): { x: number; y: number; w: number; h: number } | null {
  const { width, height, data } = mask
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[y * width + x]) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }

  if (maxX < 0) return null

  return {
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
  }
}

/**
 * Extract selected pixels from a mask as ImageData.
 */
export function extractMaskRegion(imageData: ImageData, mask: SelectionMask): ImageData {
  const { width, height } = imageData
  const result = new ImageData(width, height)

  for (let i = 0; i < mask.data.length; i++) {
    if (mask.data[i]) {
      const srcIdx = i * 4
      result.data[srcIdx] = imageData.data[srcIdx]
      result.data[srcIdx + 1] = imageData.data[srcIdx + 1]
      result.data[srcIdx + 2] = imageData.data[srcIdx + 2]
      result.data[srcIdx + 3] = imageData.data[srcIdx + 3]
    }
  }

  return result
}
