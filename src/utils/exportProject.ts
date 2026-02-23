import JSZip from 'jszip'
import type { SpriteEntry } from '../App'

export type SheetLayout = 'auto' | 'horizontal' | 'vertical' | 'custom'

export interface ExportOptions {
  layout: SheetLayout
  customCols: number
}

const PADDING = 2

interface SpriteFrame {
  name: string
  x: number
  y: number
  width: number
  height: number
}

function imageDataToCanvas(data: ImageData): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = data.width
  c.height = data.height
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.putImageData(data, 0, 0)
  return c
}

function resolveColumns(count: number, options: ExportOptions): number {
  switch (options.layout) {
    case 'horizontal':
      return count
    case 'vertical':
      return 1
    case 'custom':
      return Math.max(1, Math.min(options.customCols, count))
    case 'auto':
    default:
      return Math.ceil(Math.sqrt(count))
  }
}

export async function exportProject(
  sprites: SpriteEntry[],
  options: ExportOptions,
): Promise<void> {
  if (sprites.length === 0) return

  const tileW = sprites[0].width
  const tileH = sprites[0].height

  const cols = resolveColumns(sprites.length, options)
  const rows = Math.ceil(sprites.length / cols)

  const cellW = tileW + PADDING * 2
  const cellH = tileH + PADDING * 2

  const sheetWidth = cols * cellW
  const sheetHeight = rows * cellH

  const sheet = document.createElement('canvas')
  sheet.width = sheetWidth
  sheet.height = sheetHeight
  const ctx = sheet.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  const frames: SpriteFrame[] = []

  sprites.forEach((sprite, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)

    const x = col * cellW + PADDING
    const y = row * cellH + PADDING

    const tileCanvas = imageDataToCanvas(sprite.imageData)
    ctx.drawImage(tileCanvas, x, y)

    frames.push({
      name: sprite.name,
      x,
      y,
      width: sprite.width,
      height: sprite.height,
    })
  })

  const atlas = {
    meta: {
      app: 'CatPix',
      version: '0.3',
      image: 'spritesheet.png',
      size: { w: sheetWidth, h: sheetHeight },
      tileSize: { w: tileW, h: tileH },
      padding: PADDING,
      columns: cols,
      rows,
      layout: options.layout,
      spriteCount: sprites.length,
    },
    frames,
  }

  const pngBlob = await new Promise<Blob>((resolve) => {
    sheet.toBlob((blob) => resolve(blob!), 'image/png')
  })

  const zip = new JSZip()
  zip.file('spritesheet.png', pngBlob)
  zip.file('spritesheet.json', JSON.stringify(atlas, null, 2))

  const zipBlob = await zip.generateAsync({ type: 'blob' })

  const url = URL.createObjectURL(zipBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'catpix_export.zip'
  link.click()
  URL.revokeObjectURL(url)
}
