export interface SelectionRect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Copy a rectangular region from imageData.
 */
export function copyRegion(imageData: ImageData, rect: SelectionRect): ImageData {
  const { x, y, w, h } = rect
  const result = new ImageData(w, h)
  const srcW = imageData.width

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const srcIdx = ((y + row) * srcW + (x + col)) * 4
      const dstIdx = (row * w + col) * 4
      result.data[dstIdx] = imageData.data[srcIdx]
      result.data[dstIdx + 1] = imageData.data[srcIdx + 1]
      result.data[dstIdx + 2] = imageData.data[srcIdx + 2]
      result.data[dstIdx + 3] = imageData.data[srcIdx + 3]
    }
  }

  return result
}

/**
 * Paste source imageData onto target at position (x, y).
 * Returns a new ImageData.
 */
export function pasteRegion(
  target: ImageData,
  source: ImageData,
  x: number,
  y: number,
): ImageData {
  const result = new ImageData(
    new Uint8ClampedArray(target.data),
    target.width,
    target.height,
  )
  const tW = target.width
  const tH = target.height

  for (let row = 0; row < source.height; row++) {
    for (let col = 0; col < source.width; col++) {
      const tx = x + col
      const ty = y + row
      if (tx < 0 || tx >= tW || ty < 0 || ty >= tH) continue

      const srcIdx = (row * source.width + col) * 4
      const srcA = source.data[srcIdx + 3]
      if (srcA === 0) continue

      const dstIdx = (ty * tW + tx) * 4
      result.data[dstIdx] = source.data[srcIdx]
      result.data[dstIdx + 1] = source.data[srcIdx + 1]
      result.data[dstIdx + 2] = source.data[srcIdx + 2]
      result.data[dstIdx + 3] = srcA
    }
  }

  return result
}

/**
 * Clear (make transparent) a rectangular region of imageData.
 * Returns a new ImageData.
 */
export function clearRegion(imageData: ImageData, rect: SelectionRect): ImageData {
  const result = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height,
  )
  const w = imageData.width

  for (let row = 0; row < rect.h; row++) {
    for (let col = 0; col < rect.w; col++) {
      const idx = ((rect.y + row) * w + (rect.x + col)) * 4
      result.data[idx] = 0
      result.data[idx + 1] = 0
      result.data[idx + 2] = 0
      result.data[idx + 3] = 0
    }
  }

  return result
}
