export type DownscaleMethod = 'center' | 'mode' | 'average'

export interface ScaleCandidate {
  factor: number
  confidence: number
}

/**
 * Detects likely scale factors for AI-generated pixel art.
 * Samples random NxN blocks and checks pixel uniformity within each.
 */
export function detectScaleFactor(imageData: ImageData): ScaleCandidate[] {
  const { width, height, data } = imageData
  const candidates = [2, 3, 4, 6, 8, 10, 12, 16]
  const sampleCount = 200

  function getPixel(x: number, y: number): [number, number, number, number] {
    const i = (y * width + x) * 4
    return [data[i], data[i + 1], data[i + 2], data[i + 3]]
  }

  function pixelsMatch(
    a: [number, number, number, number],
    b: [number, number, number, number],
    tolerance = 8,
  ): boolean {
    return (
      Math.abs(a[0] - b[0]) <= tolerance &&
      Math.abs(a[1] - b[1]) <= tolerance &&
      Math.abs(a[2] - b[2]) <= tolerance &&
      Math.abs(a[3] - b[3]) <= tolerance
    )
  }

  const results: ScaleCandidate[] = []

  for (const factor of candidates) {
    if (width % factor !== 0 || height % factor !== 0) continue
    if (width < factor * 2 || height < factor * 2) continue

    const blocksX = Math.floor(width / factor)
    const blocksY = Math.floor(height / factor)
    let uniform = 0

    for (let s = 0; s < sampleCount; s++) {
      const bx = Math.floor(Math.random() * blocksX)
      const by = Math.floor(Math.random() * blocksY)
      const startX = bx * factor
      const startY = by * factor
      const ref = getPixel(startX, startY)

      let blockUniform = true
      outer: for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          if (dx === 0 && dy === 0) continue
          if (!pixelsMatch(ref, getPixel(startX + dx, startY + dy))) {
            blockUniform = false
            break outer
          }
        }
      }

      if (blockUniform) uniform++
    }

    results.push({ factor, confidence: uniform / sampleCount })
  }

  // Sort by confidence desc, prefer larger factor on ties within 5%
  results.sort((a, b) => {
    if (Math.abs(a.confidence - b.confidence) <= 0.05) {
      return b.factor - a.factor
    }
    return b.confidence - a.confidence
  })

  return results
}

/**
 * Downscale by sampling the center pixel of each NxN block.
 */
export function downscaleNearestNeighbor(imageData: ImageData, factor: number): ImageData {
  const srcW = imageData.width
  const srcH = imageData.height
  const dstW = Math.floor(srcW / factor)
  const dstH = Math.floor(srcH / factor)
  const dst = new ImageData(dstW, dstH)
  const srcData = imageData.data
  const dstData = dst.data
  const center = Math.floor(factor / 2)

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const srcX = x * factor + center
      const srcY = y * factor + center
      const si = (srcY * srcW + srcX) * 4
      const di = (y * dstW + x) * 4
      dstData[di] = srcData[si]
      dstData[di + 1] = srcData[si + 1]
      dstData[di + 2] = srcData[si + 2]
      dstData[di + 3] = srcData[si + 3]
    }
  }

  return dst
}

/**
 * Downscale by picking the most frequent color in each NxN block,
 * after insetting to skip anti-aliased edges.
 * Colors are quantized to buckets (rounding channels by `bucketSize`) before
 * counting so that compression artifacts and slight gradients are grouped
 * together. The output pixel uses the average of all pixels in the winning bucket.
 */
export function downscaleMode(imageData: ImageData, factor: number): ImageData {
  const srcW = imageData.width
  const srcH = imageData.height
  const dstW = Math.floor(srcW / factor)
  const dstH = Math.floor(srcH / factor)
  const dst = new ImageData(dstW, dstH)
  const srcData = imageData.data
  const dstData = dst.data
  // Inset margin to skip anti-aliased edges; ensure at least 1 pixel remains
  const margin = factor <= 2 ? 0 : Math.min(Math.floor(factor * 0.2), Math.floor((factor - 1) / 2))
  // Bucket size for grouping similar colors — 8 handles JPEG artifacts well
  const bucket = 8

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const blockX = x * factor
      const blockY = y * factor
      const freq = new Map<string, { count: number; r: number; g: number; b: number; a: number }>()
      let bestKey = ''
      let bestCount = 0

      for (let dy = margin; dy < factor - margin; dy++) {
        for (let dx = margin; dx < factor - margin; dx++) {
          const si = ((blockY + dy) * srcW + (blockX + dx)) * 4
          const r = srcData[si], g = srcData[si + 1], b = srcData[si + 2], a = srcData[si + 3]
          // Quantize to bucket for grouping
          const key = `${((r / bucket) | 0)},${((g / bucket) | 0)},${((b / bucket) | 0)},${((a / bucket) | 0)}`
          const entry = freq.get(key)
          if (entry) {
            entry.count++
            entry.r += r
            entry.g += g
            entry.b += b
            entry.a += a
            if (entry.count > bestCount) {
              bestCount = entry.count
              bestKey = key
            }
          } else {
            freq.set(key, { count: 1, r, g, b, a })
            if (1 > bestCount) {
              bestCount = 1
              bestKey = key
            }
          }
        }
      }

      const di = (y * dstW + x) * 4
      const best = freq.get(bestKey)!
      dstData[di] = Math.round(best.r / best.count)
      dstData[di + 1] = Math.round(best.g / best.count)
      dstData[di + 2] = Math.round(best.b / best.count)
      dstData[di + 3] = Math.round(best.a / best.count)
    }
  }

  return dst
}

/**
 * Downscale by averaging all pixels in each NxN block,
 * after insetting to skip anti-aliased edges.
 */
export function downscaleAverage(imageData: ImageData, factor: number): ImageData {
  const srcW = imageData.width
  const srcH = imageData.height
  const dstW = Math.floor(srcW / factor)
  const dstH = Math.floor(srcH / factor)
  const dst = new ImageData(dstW, dstH)
  const srcData = imageData.data
  const dstData = dst.data
  const margin = factor <= 2 ? 0 : Math.min(Math.floor(factor * 0.2), Math.floor((factor - 1) / 2))

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const blockX = x * factor
      const blockY = y * factor
      let r = 0, g = 0, b = 0, a = 0, count = 0

      for (let dy = margin; dy < factor - margin; dy++) {
        for (let dx = margin; dx < factor - margin; dx++) {
          const si = ((blockY + dy) * srcW + (blockX + dx)) * 4
          r += srcData[si]
          g += srcData[si + 1]
          b += srcData[si + 2]
          a += srcData[si + 3]
          count++
        }
      }

      const di = (y * dstW + x) * 4
      dstData[di] = Math.round(r / count)
      dstData[di + 1] = Math.round(g / count)
      dstData[di + 2] = Math.round(b / count)
      dstData[di + 3] = Math.round(a / count)
    }
  }

  return dst
}

/**
 * Unified downscale dispatcher.
 */
export function downscaleImage(imageData: ImageData, factor: number, method: DownscaleMethod): ImageData {
  switch (method) {
    case 'center':
      return downscaleNearestNeighbor(imageData, factor)
    case 'mode':
      return downscaleMode(imageData, factor)
    case 'average':
      return downscaleAverage(imageData, factor)
  }
}

/**
 * Greedy merge of similar colors within Manhattan distance threshold.
 */
export function quantizeColors(imageData: ImageData, threshold: number): ImageData {
  const data = new Uint8ClampedArray(imageData.data)
  const result = new ImageData(data, imageData.width, imageData.height)

  // Build a map of unique colors
  const colorMap = new Map<string, [number, number, number, number]>()
  for (let i = 0; i < data.length; i += 4) {
    const key = `${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`
    if (!colorMap.has(key)) {
      colorMap.set(key, [data[i], data[i + 1], data[i + 2], data[i + 3]])
    }
  }

  // Build merge mapping: for each color, find the first existing color within threshold
  const colors = Array.from(colorMap.values())
  const mergeMap = new Map<string, [number, number, number, number]>()

  for (const color of colors) {
    const key = color.join(',')
    if (mergeMap.has(key)) continue

    for (const target of colors) {
      if (target === color) {
        mergeMap.set(key, color)
        break
      }
      const dist =
        Math.abs(color[0] - target[0]) +
        Math.abs(color[1] - target[1]) +
        Math.abs(color[2] - target[2]) +
        Math.abs(color[3] - target[3])
      if (dist <= threshold) {
        mergeMap.set(key, target)
        break
      }
    }
    if (!mergeMap.has(key)) mergeMap.set(key, color)
  }

  // Apply mapping
  for (let i = 0; i < data.length; i += 4) {
    const key = `${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`
    const mapped = mergeMap.get(key)!
    data[i] = mapped[0]
    data[i + 1] = mapped[1]
    data[i + 2] = mapped[2]
    data[i + 3] = mapped[3]
  }

  return result
}

/**
 * Slice an ImageData into a grid of tiles.
 */
export function sliceIntoTiles(imageData: ImageData, tileW: number, tileH: number): ImageData[] {
  const canvas = new OffscreenCanvas(imageData.width, imageData.height)
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(imageData, 0, 0)

  const tiles: ImageData[] = []
  const cols = Math.floor(imageData.width / tileW)
  const rows = Math.floor(imageData.height / tileH)

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      tiles.push(ctx.getImageData(col * tileW, row * tileH, tileW, tileH))
    }
  }

  return tiles
}

/**
 * Check if all pixels are fully transparent.
 */
export function isEmptyTile(imageData: ImageData): boolean {
  const data = imageData.data
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0) return false
  }
  return true
}
