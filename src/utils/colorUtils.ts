/**
 * Shared color conversion utilities.
 */

/** Parse a hex color string (#RGB, #RRGGBB, or #RRGGBBAA) into [r, g, b, a] */
export function hexToRgba(hex: string): [number, number, number, number] {
  const clean = hex.replace('#', '')
  if (clean.length === 8) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
      parseInt(clean.slice(6, 8), 16),
    ]
  }
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
    255,
  ]
}

/** Convert RGBA components to a hex string (#RRGGBB or #RRGGBBAA) */
export function rgbaToHex(r: number, g: number, b: number, a: number): string {
  if (a < 255) {
    return (
      '#' +
      [r, g, b, a].map((v) => v.toString(16).padStart(2, '0')).join('')
    )
  }
  return (
    '#' +
    [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
  )
}

/**
 * Safely get a 2D rendering context from a canvas.
 * Throws a descriptive error instead of silently returning null.
 */
export function getContext2D(canvas: HTMLCanvasElement | OffscreenCanvas): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get 2D rendering context from canvas')
  }
  return ctx
}

/** Convert hex color to [h (0-360), s (0-100), l (0-100)] */
export function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgba(hex)
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, Math.round(l * 100)]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

/** Convert [h (0-360), s (0-100), l (0-100)] to hex color */
export function hslToHex(h: number, s: number, l: number): string {
  const hn = h / 360, sn = s / 100, ln = l / 100
  if (sn === 0) {
    const v = Math.round(ln * 255)
    return `#${v.toString(16).padStart(2, '0').repeat(3)}`
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn
  const p = 2 * ln - q
  const hue2rgb = (p2: number, q2: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p2 + (q2 - p2) * 6 * t
    if (t < 1 / 2) return q2
    if (t < 2 / 3) return p2 + (q2 - p2) * (2 / 3 - t) * 6
    return p2
  }
  const r = Math.round(hue2rgb(p, q, hn + 1 / 3) * 255)
  const g = Math.round(hue2rgb(p, q, hn) * 255)
  const b = Math.round(hue2rgb(p, q, hn - 1 / 3) * 255)
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** Generate a linear RGB gradient ramp of `steps` colors between two hex values */
export function generateColorRamp(fromHex: string, toHex: string, steps: number): string[] {
  const [r1, g1, b1] = hexToRgba(fromHex)
  const [r2, g2, b2] = hexToRgba(toHex)
  const colors: string[] = []
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1)
    const r = Math.round(r1 + (r2 - r1) * t)
    const g = Math.round(g1 + (g2 - g1) * t)
    const b = Math.round(b1 + (b2 - b1) * t)
    colors.push(`#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`)
  }
  return colors
}
