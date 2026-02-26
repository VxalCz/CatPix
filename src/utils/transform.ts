/**
 * Rotate ImageData 90 degrees clockwise or counter-clockwise.
 */
export function rotateImageData90(
  imageData: ImageData,
  direction: 'cw' | 'ccw',
): ImageData {
  const w = imageData.width
  const h = imageData.height
  const src = imageData.data
  // Rotated dimensions: width becomes height, height becomes width
  const result = new ImageData(h, w)
  const dst = result.data

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 4
      let dstX: number, dstY: number

      if (direction === 'cw') {
        dstX = h - 1 - y
        dstY = x
      } else {
        dstX = y
        dstY = w - 1 - x
      }

      const dstIdx = (dstY * h + dstX) * 4
      dst[dstIdx] = src[srcIdx]
      dst[dstIdx + 1] = src[srcIdx + 1]
      dst[dstIdx + 2] = src[srcIdx + 2]
      dst[dstIdx + 3] = src[srcIdx + 3]
    }
  }

  return result
}

/**
 * Flip ImageData horizontally or vertically.
 */
export function flipImageData(
  imageData: ImageData,
  axis: 'horizontal' | 'vertical',
): ImageData {
  const w = imageData.width
  const h = imageData.height
  const src = imageData.data
  const result = new ImageData(w, h)
  const dst = result.data

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 4
      let dstX: number, dstY: number

      if (axis === 'horizontal') {
        dstX = w - 1 - x
        dstY = y
      } else {
        dstX = x
        dstY = h - 1 - y
      }

      const dstIdx = (dstY * w + dstX) * 4
      dst[dstIdx] = src[srcIdx]
      dst[dstIdx + 1] = src[srcIdx + 1]
      dst[dstIdx + 2] = src[srcIdx + 2]
      dst[dstIdx + 3] = src[srcIdx + 3]
    }
  }

  return result
}
