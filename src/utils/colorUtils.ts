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
