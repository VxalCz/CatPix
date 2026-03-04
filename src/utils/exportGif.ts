import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import type { SpriteEntry } from '../App'
import { imageDataToCanvas } from './exportProject'

export interface GifExportOptions {
  fps: number
  scale: 1 | 2 | 4
  loopCount: number
  frameStart: number
  frameEnd: number
  transparentBackground: boolean
}

export const defaultGifOptions: GifExportOptions = {
  fps: 8,
  scale: 1,
  loopCount: 0,
  frameStart: 0,
  frameEnd: 0,
  transparentBackground: false,
}

function upscaleNearest(src: ImageData, scale: number): ImageData {
  if (scale === 1) return src
  const w = src.width * scale
  const h = src.height * scale
  const out = new ImageData(w, h)
  const sd = src.data
  const od = out.data
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const si = (y * src.width + x) * 4
      const r = sd[si], g = sd[si + 1], b = sd[si + 2], a = sd[si + 3]
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const di = ((y * scale + dy) * w + (x * scale + dx)) * 4
          od[di] = r
          od[di + 1] = g
          od[di + 2] = b
          od[di + 3] = a
        }
      }
    }
  }
  return out
}

export function exportGif(sprites: SpriteEntry[], options: GifExportOptions): void {
  if (sprites.length === 0) return

  const { fps, scale, frameStart, frameEnd, transparentBackground } = options
  const frames = sprites.slice(frameStart, frameEnd + 1)
  if (frames.length === 0) return

  const outW = frames[0].width * scale
  const outH = frames[0].height * scale
  const globalDelay = Math.round(1000 / fps)

  const gif = GIFEncoder()

  for (const frame of frames) {
    const delay = frame.delay ?? globalDelay
    const canvas = imageDataToCanvas(frame.imageData)
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    const raw = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const scaled = upscaleNearest(raw, scale)

    const rgba = scaled.data

    if (transparentBackground) {
      // Mark fully transparent pixels
      const palette = quantize(rgba, 256, { oneBitAlpha: true })
      const index = applyPalette(rgba, palette)

      // Find transparent index: palette entry with alpha < 128
      let transparentIndex = -1
      for (let i = 0; i < palette.length; i++) {
        if (palette[i].length >= 4 && palette[i][3] < 128) {
          transparentIndex = i
          break
        }
      }

      if (transparentIndex >= 0) {
        gif.writeFrame(index, outW, outH, {
          palette,
          delay,
          dispose: 2,
          transparent: true,
          transparentIndex,
        })
      } else {
        gif.writeFrame(index, outW, outH, { palette, delay })
      }
    } else {
      const palette = quantize(rgba, 256)
      const index = applyPalette(rgba, palette)
      gif.writeFrame(index, outW, outH, { palette, delay })
    }
  }

  gif.finish()

  const bytes = gif.bytes()
  const blob = new Blob([new Uint8Array(bytes)], { type: 'image/gif' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `catpix_animation_${frames.length}f_${fps}fps.gif`
  link.click()
  URL.revokeObjectURL(url)
}
