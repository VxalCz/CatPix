import JSZip from 'jszip'
import type { SpriteEntry } from '../App'

export type SheetLayout = 'auto' | 'horizontal' | 'vertical' | 'custom'
export type AtlasFormat = 'catpix' | 'texturepacker' | 'css'

export interface ExportOptions {
  layout: SheetLayout
  customCols: number
  padding: number
  atlasFormat: AtlasFormat
  exportIndividualPngs: boolean
}

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

function buildCatPixAtlas(
  sheetWidth: number, sheetHeight: number,
  tileW: number, tileH: number,
  cols: number, rows: number,
  padding: number, layout: SheetLayout,
  sprites: SpriteEntry[], frames: SpriteFrame[],
) {
  return {
    meta: {
      app: 'CatPix',
      version: '0.3',
      image: 'spritesheet.png',
      size: { w: sheetWidth, h: sheetHeight },
      tileSize: { w: tileW, h: tileH },
      padding,
      columns: cols,
      rows,
      layout,
      spriteCount: sprites.length,
    },
    frames,
  }
}

function buildTexturePackerAtlas(
  sheetWidth: number, sheetHeight: number,
  frames: SpriteFrame[],
) {
  const frameMap: Record<string, object> = {}
  for (const f of frames) {
    frameMap[f.name] = {
      frame: { x: f.x, y: f.y, w: f.width, h: f.height },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: f.width, h: f.height },
      sourceSize: { w: f.width, h: f.height },
    }
  }
  return {
    frames: frameMap,
    meta: {
      app: 'CatPix',
      version: '0.3',
      image: 'spritesheet.png',
      format: 'RGBA8888',
      size: { w: sheetWidth, h: sheetHeight },
      scale: '1',
    },
  }
}

function buildCSSAtlas(frames: SpriteFrame[]) {
  const rules = frames.map((f) =>
    `.${f.name.replace(/[^a-zA-Z0-9_-]/g, '_')} {\n` +
    `  width: ${f.width}px;\n` +
    `  height: ${f.height}px;\n` +
    `  background: url('spritesheet.png') -${f.x}px -${f.y}px;\n` +
    `}`
  )
  return rules.join('\n\n')
}

export async function exportProject(
  sprites: SpriteEntry[],
  options: ExportOptions,
): Promise<void> {
  if (sprites.length === 0) return

  const padding = options.padding ?? 2
  const tileW = sprites[0].width
  const tileH = sprites[0].height

  const cols = resolveColumns(sprites.length, options)
  const rows = Math.ceil(sprites.length / cols)

  const cellW = tileW + padding * 2
  const cellH = tileH + padding * 2

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

    const x = col * cellW + padding
    const y = row * cellH + padding

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

  const pngBlob = await new Promise<Blob>((resolve) => {
    sheet.toBlob((blob) => resolve(blob!), 'image/png')
  })

  const zip = new JSZip()
  zip.file('spritesheet.png', pngBlob)

  // Atlas in selected format
  const format = options.atlasFormat ?? 'catpix'
  if (format === 'texturepacker') {
    const atlas = buildTexturePackerAtlas(sheetWidth, sheetHeight, frames)
    zip.file('spritesheet.json', JSON.stringify(atlas, null, 2))
  } else if (format === 'css') {
    const css = buildCSSAtlas(frames)
    zip.file('sprites.css', css)
    // Also include a basic JSON reference
    const atlas = buildCatPixAtlas(sheetWidth, sheetHeight, tileW, tileH, cols, rows, padding, options.layout, sprites, frames)
    zip.file('spritesheet.json', JSON.stringify(atlas, null, 2))
  } else {
    const atlas = buildCatPixAtlas(sheetWidth, sheetHeight, tileW, tileH, cols, rows, padding, options.layout, sprites, frames)
    zip.file('spritesheet.json', JSON.stringify(atlas, null, 2))
  }

  // Individual PNGs
  if (options.exportIndividualPngs) {
    const folder = zip.folder('individual')!
    for (const sprite of sprites) {
      const canvas = imageDataToCanvas(sprite.imageData)
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png')
      })
      folder.file(`${sprite.name}.png`, blob)
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })

  const url = URL.createObjectURL(zipBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'catpix_export.zip'
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Export project as .catpix file (ZIP with metadata + sprites).
 */
export async function exportCatPixProject(
  sprites: SpriteEntry[],
  gridSize: number,
  imageDataUrl: string | null,
): Promise<void> {
  const zip = new JSZip()

  const meta = {
    app: 'CatPix',
    version: '0.3',
    gridSize,
    sprites: sprites.map((s) => ({
      id: s.id,
      name: s.name,
      width: s.width,
      height: s.height,
    })),
  }
  zip.file('project.json', JSON.stringify(meta, null, 2))

  const spritesFolder = zip.folder('sprites')!
  for (const sprite of sprites) {
    const canvas = imageDataToCanvas(sprite.imageData)
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png')
    })
    spritesFolder.file(`${sprite.name}.png`, blob)
  }

  if (imageDataUrl) {
    // Convert data URL to blob
    const resp = await fetch(imageDataUrl)
    const blob = await resp.blob()
    zip.file('tileset.png', blob)
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(zipBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'project.catpix'
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Import a .catpix project file.
 */
export async function importCatPixProject(file: File): Promise<{
  sprites: SpriteEntry[]
  gridSize: number
  tilesetImage: HTMLImageElement | null
}> {
  const zip = await JSZip.loadAsync(file)

  const metaFile = zip.file('project.json')
  if (!metaFile) throw new Error('Invalid .catpix file: missing project.json')

  const meta = JSON.parse(await metaFile.async('text'))
  const gridSize: number = meta.gridSize ?? 32

  const sprites: SpriteEntry[] = []
  for (const spriteMeta of meta.sprites) {
    const pngFile = zip.file(`sprites/${spriteMeta.name}.png`)
    if (!pngFile) continue

    const blob = await pngFile.async('blob')
    const imageBitmap = await createImageBitmap(blob)

    const canvas = document.createElement('canvas')
    canvas.width = imageBitmap.width
    canvas.height = imageBitmap.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(imageBitmap, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    sprites.push({
      id: spriteMeta.id ?? `sprite_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: spriteMeta.name,
      width: spriteMeta.width ?? imageBitmap.width,
      height: spriteMeta.height ?? imageBitmap.height,
      imageData,
    })
  }

  let tilesetImage: HTMLImageElement | null = null
  const tilesetFile = zip.file('tileset.png')
  if (tilesetFile) {
    const blob = await tilesetFile.async('blob')
    const url = URL.createObjectURL(blob)
    tilesetImage = await new Promise((resolve) => {
      const img = new window.Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve(img)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(null)
      }
      img.src = url
    })
  }

  return { sprites, gridSize, tilesetImage }
}
