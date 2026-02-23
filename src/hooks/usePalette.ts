import { useMemo } from 'react'

export interface PaletteColor {
  r: number
  g: number
  b: number
  a: number
  hex: string
  count: number
}

const MAX_PALETTE = 64

function rgbaToHex(r: number, g: number, b: number, a: number): string {
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

export function usePalette(image: HTMLImageElement | null) {
  return useMemo(() => {
    if (!image) return { colors: [], truncated: false, totalUnique: 0 }

    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(image, 0, 0)

    const data = ctx.getImageData(0, 0, image.width, image.height).data
    const colorMap = new Map<string, { r: number; g: number; b: number; a: number; count: number }>()

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3]
      if (a === 0) continue

      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const key = `${r},${g},${b},${a}`

      const existing = colorMap.get(key)
      if (existing) {
        existing.count++
      } else {
        colorMap.set(key, { r, g, b, a, count: 1 })
      }
    }

    const totalUnique = colorMap.size
    const truncated = totalUnique > 256

    // Sort by frequency (most used first)
    const sorted = Array.from(colorMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_PALETTE)

    const colors: PaletteColor[] = sorted.map((c) => ({
      ...c,
      hex: rgbaToHex(c.r, c.g, c.b, c.a),
    }))

    return { colors, truncated, totalUnique }
  }, [image])
}
