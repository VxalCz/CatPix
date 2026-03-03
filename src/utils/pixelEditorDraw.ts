import { bresenhamLine } from './lineBresenham'
import { ellipseOutline, filledEllipse, ellipseFromCorners } from './ellipse'

export function rgbaToHex(r: number, g: number, b: number, a: number): string {
  const hex = [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
  if (a < 255) return `#${hex}${a.toString(16).padStart(2, '0')}`
  return `#${hex}`
}

export function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

export function drawLineOnData(
  data: ImageData,
  x0: number, y0: number, x1: number, y1: number,
  rgba: [number, number, number, number],
  getMirroredPixels: (x: number, y: number) => { px: number; py: number }[],
): ImageData {
  const result = new ImageData(new Uint8ClampedArray(data.data), data.width, data.height)
  const linePoints = bresenhamLine(x0, y0, x1, y1)
  const [r, g, b, a] = rgba
  const w = data.width
  const h = data.height

  for (const { x, y } of linePoints) {
    const mirrored = getMirroredPixels(x, y)
    for (const pt of mirrored) {
      if (pt.px < 0 || pt.px >= w || pt.py < 0 || pt.py >= h) continue
      const idx = (pt.py * w + pt.px) * 4
      result.data[idx] = r
      result.data[idx + 1] = g
      result.data[idx + 2] = b
      result.data[idx + 3] = a
    }
  }
  return result
}

export function drawRectOnData(
  data: ImageData,
  x0: number, y0: number, x1: number, y1: number,
  filled: boolean,
  rgba: [number, number, number, number],
  getMirroredPixels: (x: number, y: number) => { px: number; py: number }[],
): ImageData {
  const result = new ImageData(new Uint8ClampedArray(data.data), data.width, data.height)
  const [r, g, b, a] = rgba
  const w = data.width
  const h = data.height

  const minX = Math.max(0, Math.min(x0, x1))
  const maxX = Math.min(w - 1, Math.max(x0, x1))
  const minY = Math.max(0, Math.min(y0, y1))
  const maxY = Math.min(h - 1, Math.max(y0, y1))

  const setPixel = (px: number, py: number) => {
    const mirrored = getMirroredPixels(px, py)
    for (const pt of mirrored) {
      if (pt.px < 0 || pt.px >= w || pt.py < 0 || pt.py >= h) continue
      const idx = (pt.py * w + pt.px) * 4
      result.data[idx] = r
      result.data[idx + 1] = g
      result.data[idx + 2] = b
      result.data[idx + 3] = a
    }
  }

  if (filled) {
    for (let y2 = minY; y2 <= maxY; y2++) {
      for (let x2 = minX; x2 <= maxX; x2++) {
        setPixel(x2, y2)
      }
    }
  } else {
    for (let x2 = minX; x2 <= maxX; x2++) {
      setPixel(x2, minY)
      setPixel(x2, maxY)
    }
    for (let y2 = minY; y2 <= maxY; y2++) {
      setPixel(minX, y2)
      setPixel(maxX, y2)
    }
  }

  return result
}

export function drawEllipseOnData(
  data: ImageData,
  x0: number, y0: number, x1: number, y1: number,
  filled: boolean,
  rgba: [number, number, number, number],
  getMirroredPixels: (x: number, y: number) => { px: number; py: number }[],
): ImageData {
  const result = new ImageData(new Uint8ClampedArray(data.data), data.width, data.height)
  const [r, g, b, a] = rgba
  const w = data.width
  const h = data.height

  const { cx, cy, rx, ry } = ellipseFromCorners(x0, y0, x1, y1, filled)

  if (rx === 0 && ry === 0) {
    const mirrored = getMirroredPixels(cx, cy)
    for (const pt of mirrored) {
      if (pt.px >= 0 && pt.px < w && pt.py >= 0 && pt.py < h) {
        const idx = (pt.py * w + pt.px) * 4
        result.data[idx] = r
        result.data[idx + 1] = g
        result.data[idx + 2] = b
        result.data[idx + 3] = a
      }
    }
    return result
  }

  const points = filled ? filledEllipse(cx, cy, rx, ry) : ellipseOutline(cx, cy, rx, ry)
  for (const { x, y } of points) {
    const mirrored = getMirroredPixels(x, y)
    for (const pt of mirrored) {
      if (pt.px >= 0 && pt.px < w && pt.py >= 0 && pt.py < h) {
        const idx = (pt.py * w + pt.px) * 4
        result.data[idx] = r
        result.data[idx + 1] = g
        result.data[idx + 2] = b
        result.data[idx + 3] = a
      }
    }
  }

  return result
}
