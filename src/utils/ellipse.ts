/**
 * Midpoint ellipse algorithm for drawing ellipses.
 * Returns an array of pixel coordinates for the ellipse.
 */

export interface Point {
  x: number
  y: number
}

/**
 * Draw an ellipse outline using midpoint algorithm.
 */
export function ellipseOutline(cx: number, cy: number, rx: number, ry: number): Point[] {
  const points: Point[] = []
  const seen = new Set<number>()

  if (rx < 0) rx = -rx
  if (ry < 0) ry = -ry
  if (rx === 0 && ry === 0) return [{ x: cx, y: cy }]

  // Dedup pro osy (x=0 nebo y=0 produkují duplicitní čtveřice)
  const add = (x: number, y: number) => {
    const key = (x + 32768) * 65536 + (y + 32768)
    if (!seen.has(key)) { seen.add(key); points.push({ x, y }) }
  }

  const rx2 = rx * rx
  const ry2 = ry * ry

  let x = 0
  let y = ry
  let px = 0
  let py = 2 * rx2 * y

  // Region 1
  let p = ry2 - rx2 * ry + rx2 / 4
  while (px < py) {
    add(cx + x, cy + y)
    add(cx - x, cy + y)
    add(cx + x, cy - y)
    add(cx - x, cy - y)

    x++
    px += 2 * ry2
    if (p < 0) {
      p += ry2 + px
    } else {
      y--
      py -= 2 * rx2
      p += ry2 + px - py
    }
  }

  // Region 2
  p = ry2 * (x * x + x) + rx2 * (y * y - y) + rx2 * ry2
  while (y >= 0) {
    add(cx + x, cy + y)
    add(cx - x, cy + y)
    add(cx + x, cy - y)
    add(cx - x, cy - y)

    y--
    py -= 2 * rx2
    if (p > 0) {
      p += rx2 - py
    } else {
      x++
      px += 2 * ry2
      p += rx2 - py + px
    }
  }

  return points
}

/**
 * Draw a filled ellipse using scan-line algorithm.
 */
export function filledEllipse(cx: number, cy: number, rx: number, ry: number): Point[] {
  const points: Point[] = []

  if (rx < 0) rx = -rx
  if (ry < 0) ry = -ry
  if (rx === 0 && ry === 0) return [{ x: cx, y: cy }]

  const rx2 = rx * rx
  const ry2 = ry * ry

  // Scan line approach: for each y, find x range
  for (let dy = -ry; dy <= ry; dy++) {
    // Solve for x: (x-cx)^2/rx^2 + (dy)^2/ry^2 <= 1
    // (x-cx)^2 <= rx^2 * (1 - dy^2/ry^2)
    const term = rx2 * (1 - (dy * dy) / ry2)
    if (term >= 0) {
      const dx = Math.floor(Math.sqrt(term))
      for (let x = -dx; x <= dx; x++) {
        points.push({ x: cx + x, y: cy + dy })
      }
    }
  }

  return points
}

/**
 * Calculate ellipse parameters from two corner points.
 * Returns center and radii.
 */
export function ellipseFromCorners(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  shiftPressed: boolean,
): { cx: number; cy: number; rx: number; ry: number } {
  const cx = Math.round((x0 + x1) / 2)
  const cy = Math.round((y0 + y1) / 2)

  let rx = Math.abs(x1 - x0) / 2
  let ry = Math.abs(y1 - y0) / 2

  // Shift = circle (equal radii)
  if (shiftPressed) {
    const r = Math.max(rx, ry)
    rx = r
    ry = r
  }

  return { cx, cy, rx: Math.round(rx), ry: Math.round(ry) }
}