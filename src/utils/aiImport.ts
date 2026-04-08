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
      const best = freq.get(bestKey)
      if (!best) continue
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
  const colorMap = new Map<number, [number, number, number, number]>()
  for (let i = 0; i < data.length; i += 4) {
    const key = ((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]) >>> 0
    if (!colorMap.has(key)) {
      colorMap.set(key, [data[i], data[i + 1], data[i + 2], data[i + 3]])
    }
  }

  // Build merge mapping: for each color, find the first existing color within threshold
  const colors = Array.from(colorMap.values())
  const mergeMap = new Map<number, [number, number, number, number]>()

  for (const color of colors) {
    const key = ((color[0] << 24) | (color[1] << 16) | (color[2] << 8) | color[3]) >>> 0
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
    const key = ((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]) >>> 0
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
 * Uses pure array manipulation (no canvas) for Worker compatibility.
 */
export function sliceIntoTiles(imageData: ImageData, tileW: number, tileH: number): ImageData[] {
  const { width, data } = imageData
  const cols = Math.floor(imageData.width / tileW)
  const rows = Math.floor(imageData.height / tileH)
  const tiles: ImageData[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tile = new ImageData(tileW, tileH)
      for (let y = 0; y < tileH; y++) {
        const srcOffset = ((row * tileH + y) * width + col * tileW) * 4
        const dstOffset = y * tileW * 4
        tile.data.set(data.subarray(srcOffset, srcOffset + tileW * 4), dstOffset)
      }
      tiles.push(tile)
    }
  }

  return tiles
}

/**
 * Detects the most likely background color by sampling edge pixels.
 * Samples top/bottom rows and left/right columns, quantizes to buckets,
 * and returns the most frequent color.
 */
export function detectBackgroundColor(imageData: ImageData): { r: number; g: number; b: number; a: number } {
  const { width, height, data } = imageData
  const bucket = 8
  const freq = new Map<string, { count: number; r: number; g: number; b: number; a: number }>()

  function sample(x: number, y: number) {
    const i = (y * width + x) * 4
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
    const key = `${((r / bucket) | 0)},${((g / bucket) | 0)},${((b / bucket) | 0)},${((a / bucket) | 0)}`
    const entry = freq.get(key)
    if (entry) {
      entry.count++
      entry.r += r
      entry.g += g
      entry.b += b
      entry.a += a
    } else {
      freq.set(key, { count: 1, r, g, b, a })
    }
  }

  // Sample top and bottom rows
  for (let x = 0; x < width; x++) {
    sample(x, 0)
    sample(x, height - 1)
  }
  // Sample left and right columns (skip corners already sampled)
  for (let y = 1; y < height - 1; y++) {
    sample(0, y)
    sample(width - 1, y)
  }

  // Find most frequent bucket
  let bestKey = ''
  let bestCount = 0
  for (const [key, entry] of freq) {
    if (entry.count > bestCount) {
      bestCount = entry.count
      bestKey = key
    }
  }

  const best = freq.get(bestKey)
  if (!best) return { r: 0, g: 0, b: 0, a: 0 }
  return {
    r: Math.round(best.r / best.count),
    g: Math.round(best.g / best.count),
    b: Math.round(best.b / best.count),
    a: Math.round(best.a / best.count),
  }
}

/**
 * Replaces pixels within Manhattan distance of bgColor with fully transparent.
 * Returns a new ImageData.
 */
export function removeBackgroundColor(
  imageData: ImageData,
  bgColor: { r: number; g: number; b: number; a: number },
  tolerance: number,
): ImageData {
  const data = new Uint8ClampedArray(imageData.data)
  const result = new ImageData(data, imageData.width, imageData.height)

  for (let i = 0; i < data.length; i += 4) {
    const dist =
      Math.abs(data[i] - bgColor.r) +
      Math.abs(data[i + 1] - bgColor.g) +
      Math.abs(data[i + 2] - bgColor.b) +
      Math.abs(data[i + 3] - bgColor.a)
    if (dist <= tolerance) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = 0
    }
  }

  return result
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

/**
 * Count unique colors in an ImageData (ignoring fully transparent pixels).
 */
export function countUniqueColors(imageData: ImageData): number {
  const data = imageData.data
  const seen = new Set<number>()
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue
    // Pack RGBA into a single 32-bit int
    seen.add((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3])
  }
  return seen.size
}

/**
 * Clean semi-transparent edge pixels by snapping alpha to fully opaque or
 * fully transparent based on threshold (0–255). Pixels with alpha above the
 * threshold become opaque; those at or below become transparent.
 */
export function cleanEdges(imageData: ImageData, alphaThreshold = 128): ImageData {
  const data = new Uint8ClampedArray(imageData.data)
  const result = new ImageData(data, imageData.width, imageData.height)

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a === 0 || a === 255) continue
    if (a >= alphaThreshold) {
      data[i + 3] = 255
    } else {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = 0
    }
  }

  return result
}

/**
 * Snap every pixel to the nearest color in the given palette.
 * Colors are [r, g, b, a] tuples. Transparent pixels are left unchanged.
 */
export function snapToPaletteColors(
  imageData: ImageData,
  palette: [number, number, number, number][],
): ImageData {
  if (palette.length === 0) return imageData
  const data = new Uint8ClampedArray(imageData.data)
  const result = new ImageData(data, imageData.width, imageData.height)

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue
    const r = data[i], g = data[i + 1], b = data[i + 2]
    let bestDist = Infinity
    let bestIdx = 0
    for (let p = 0; p < palette.length; p++) {
      const dist =
        Math.abs(r - palette[p][0]) +
        Math.abs(g - palette[p][1]) +
        Math.abs(b - palette[p][2])
      if (dist < bestDist) {
        bestDist = dist
        bestIdx = p
        if (dist === 0) break
      }
    }
    data[i] = palette[bestIdx][0]
    data[i + 1] = palette[bestIdx][1]
    data[i + 2] = palette[bestIdx][2]
    data[i + 3] = palette[bestIdx][3]
  }

  return result
}

/**
 * Median-cut color quantization. Reduces an ImageData to at most `maxColors`
 * unique colors. Returns a new ImageData with quantized pixels.
 * Fully transparent pixels are skipped.
 */
export function medianCutQuantize(imageData: ImageData, maxColors: number): ImageData {
  const data = imageData.data
  // Collect all opaque pixel colors
  const pixels: [number, number, number, number][] = []
  const pixelIndices: number[] = [] // index in data for each pixel
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue
    pixels.push([data[i], data[i + 1], data[i + 2], data[i + 3]])
    pixelIndices.push(i)
  }

  if (pixels.length === 0 || maxColors <= 0) {
    return new ImageData(new Uint8ClampedArray(data), imageData.width, imageData.height)
  }

  // Build initial bucket
  interface Bucket {
    pixels: number[] // indices into pixels array
  }

  const allIndices = pixels.map((_, i) => i)
  const buckets: Bucket[] = [{ pixels: allIndices }]

  // Split buckets until we reach maxColors
  while (buckets.length < maxColors) {
    // Find bucket with largest color range
    let bestBucket = -1
    let bestRange = -1
    let bestChannel = 0

    for (let b = 0; b < buckets.length; b++) {
      const bk = buckets[b]
      if (bk.pixels.length <= 1) continue
      for (let ch = 0; ch < 4; ch++) {
        let min = 255, max = 0
        for (const pi of bk.pixels) {
          const v = pixels[pi][ch]
          if (v < min) min = v
          if (v > max) max = v
        }
        const range = max - min
        if (range > bestRange) {
          bestRange = range
          bestBucket = b
          bestChannel = ch
        }
      }
    }

    if (bestBucket === -1 || bestRange === 0) break

    // Sort bucket by the widest channel and split at median
    const bk = buckets[bestBucket]
    bk.pixels.sort((a, b) => pixels[a][bestChannel] - pixels[b][bestChannel])
    const mid = bk.pixels.length >> 1
    const left: Bucket = { pixels: bk.pixels.slice(0, mid) }
    const right: Bucket = { pixels: bk.pixels.slice(mid) }
    buckets.splice(bestBucket, 1, left, right)
  }

  // Compute average color per bucket and map pixels
  const resultData = new Uint8ClampedArray(data)
  for (const bk of buckets) {
    if (bk.pixels.length === 0) continue
    let rSum = 0, gSum = 0, bSum = 0
    for (const pi of bk.pixels) {
      rSum += pixels[pi][0]
      gSum += pixels[pi][1]
      bSum += pixels[pi][2]
    }
    const n = bk.pixels.length
    const avgR = Math.round(rSum / n)
    const avgG = Math.round(gSum / n)
    const avgB = Math.round(bSum / n)
    for (const pi of bk.pixels) {
      const di = pixelIndices[pi]
      resultData[di] = avgR
      resultData[di + 1] = avgG
      resultData[di + 2] = avgB
    }
  }

  return new ImageData(resultData, imageData.width, imageData.height)
}

/**
 * Extract individual sprites by finding connected non-transparent pixel
 * regions (connected components). Each component is cropped to its bounding
 * box and returned as a separate ImageData.
 *
 * @param minPixels - Minimum number of opaque pixels for a region to be kept
 *                    (filters out noise). Defaults to 4.
 */
export function extractConnectedSprites(
  imageData: ImageData,
  minPixels = 4,
): ImageData[] {
  const { width, height, data } = imageData
  const labels = new Int32Array(width * height) // 0 = unvisited
  let nextLabel = 1
  const components: Map<number, { minX: number; minY: number; maxX: number; maxY: number; count: number }> = new Map()

  // BFS for each unvisited opaque pixel
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pos = y * width + x
      if (labels[pos] !== 0) continue
      if (data[pos * 4 + 3] === 0) continue // transparent

      const label = nextLabel++
      const queue: number[] = [x, y]
      let head = 0
      let minX = x, minY = y, maxX = x, maxY = y
      let count = 0

      while (head < queue.length) {
        const cx = queue[head++]
        const cy = queue[head++]
        if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue
        const cp = cy * width + cx
        if (labels[cp] !== 0) continue
        if (data[cp * 4 + 3] === 0) continue

        labels[cp] = label
        count++
        if (cx < minX) minX = cx
        if (cy < minY) minY = cy
        if (cx > maxX) maxX = cx
        if (cy > maxY) maxY = cy

        queue.push(cx - 1, cy, cx + 1, cy, cx, cy - 1, cx, cy + 1)
      }

      components.set(label, { minX, minY, maxX, maxY, count })
    }
  }

  // Filter and sort components by position: top-to-bottom, left-to-right
  const sorted = Array.from(components.entries())
    .filter(([, b]) => b.count >= minPixels)
    .sort((a, b) => {
      const dy = a[1].minY - b[1].minY
      if (Math.abs(dy) > 4) return dy
      return a[1].minX - b[1].minX
    })

  // Extract each component as cropped ImageData
  return sorted.map(([label, box]) => {
    const w = box.maxX - box.minX + 1
    const h = box.maxY - box.minY + 1
    const out = new ImageData(w, h)
    for (let y = box.minY; y <= box.maxY; y++) {
      for (let x = box.minX; x <= box.maxX; x++) {
        const pos = y * width + x
        if (labels[pos] !== label) continue
        const si = pos * 4
        const di = ((y - box.minY) * w + (x - box.minX)) * 4
        out.data[di] = data[si]
        out.data[di + 1] = data[si + 1]
        out.data[di + 2] = data[si + 2]
        out.data[di + 3] = data[si + 3]
      }
    }
    return out
  })
}
