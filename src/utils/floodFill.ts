/**
 * Flood fill using scanline algorithm.
 * Replaces contiguous pixels matching the target color with fillColor.
 */
export function floodFill(
  imageData: ImageData,
  startX: number,
  startY: number,
  fillColor: [number, number, number, number],
  tolerance: number = 0,
): ImageData {
  const w = imageData.width
  const h = imageData.height
  const data = new Uint8ClampedArray(imageData.data)

  const getIdx = (x: number, y: number) => (y * w + x) * 4
  const startIdx = getIdx(startX, startY)
  const targetR = data[startIdx]
  const targetG = data[startIdx + 1]
  const targetB = data[startIdx + 2]
  const targetA = data[startIdx + 3]

  // Don't fill if target color equals fill color
  if (
    targetR === fillColor[0] &&
    targetG === fillColor[1] &&
    targetB === fillColor[2] &&
    targetA === fillColor[3]
  ) {
    return new ImageData(data, w, h)
  }

  const matches = (idx: number) => {
    return (
      Math.abs(data[idx] - targetR) <= tolerance &&
      Math.abs(data[idx + 1] - targetG) <= tolerance &&
      Math.abs(data[idx + 2] - targetB) <= tolerance &&
      Math.abs(data[idx + 3] - targetA) <= tolerance
    )
  }

  const setPixel = (idx: number) => {
    data[idx] = fillColor[0]
    data[idx + 1] = fillColor[1]
    data[idx + 2] = fillColor[2]
    data[idx + 3] = fillColor[3]
  }

  const visited = new Uint8Array(w * h)
  const stack: [number, number][] = [[startX, startY]]

  while (stack.length > 0) {
    const [x, y] = stack.pop()!
    const pixelIdx = y * w + x
    if (visited[pixelIdx]) continue
    visited[pixelIdx] = 1

    const idx = pixelIdx * 4
    if (!matches(idx)) continue

    // Scan left
    let left = x
    while (left > 0 && matches(getIdx(left - 1, y)) && !visited[y * w + left - 1]) {
      left--
    }

    // Scan right
    let right = x
    while (right < w - 1 && matches(getIdx(right + 1, y)) && !visited[y * w + right + 1]) {
      right++
    }

    // Fill the scanline and check above/below
    for (let px = left; px <= right; px++) {
      const pIdx = y * w + px
      visited[pIdx] = 1
      setPixel(pIdx * 4)

      if (y > 0 && !visited[(y - 1) * w + px] && matches(getIdx(px, y - 1))) {
        stack.push([px, y - 1])
      }
      if (y < h - 1 && !visited[(y + 1) * w + px] && matches(getIdx(px, y + 1))) {
        stack.push([px, y + 1])
      }
    }
  }

  return new ImageData(data, w, h)
}
