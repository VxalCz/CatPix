import { parseGIF, decompressFrames } from 'gifuct-js'
import type { SpriteEntry } from '../App'

export async function importGif(file: File): Promise<SpriteEntry[]> {
  const buffer = await file.arrayBuffer()
  const gif = parseGIF(buffer)
  const frames = decompressFrames(gif, true)

  if (frames.length === 0) return []

  const width = gif.lsd.width
  const height = gif.lsd.height

  let spriteCounter = Date.now()

  // Compositing canvas — accumulates frames to handle delta/partial frames
  const canvas = new Uint8ClampedArray(width * height * 4)

  return frames.map((frame) => {
    const { patch, dims, disposalType } = frame

    // Save canvas state before drawing if disposal=2 (restore to background after)
    const prevCanvas = disposalType === 2 ? canvas.slice() : null

    // Composite this frame's patch onto the canvas
    for (let y = 0; y < dims.height; y++) {
      for (let x = 0; x < dims.width; x++) {
        const srcIdx = (y * dims.width + x) * 4
        const dstX = dims.left + x
        const dstY = dims.top + y
        if (dstX >= 0 && dstX < width && dstY >= 0 && dstY < height) {
          const dstIdx = (dstY * width + dstX) * 4
          if (patch[srcIdx + 3] > 0) {
            canvas[dstIdx] = patch[srcIdx]
            canvas[dstIdx + 1] = patch[srcIdx + 1]
            canvas[dstIdx + 2] = patch[srcIdx + 2]
            canvas[dstIdx + 3] = patch[srcIdx + 3]
          }
        }
      }
    }

    // Snapshot current canvas as this sprite's ImageData
    const imageData = new ImageData(canvas.slice(), width, height)

    // Restore canvas to pre-frame state for disposal=2
    if (disposalType === 2 && prevCanvas) {
      canvas.set(prevCanvas)
    }

    const id = crypto.randomUUID()
    const name = `gif_${String(spriteCounter++).slice(-4)}`
    // frame.delay is in centiseconds → convert to ms
    const delay = frame.delay ? frame.delay * 10 : undefined

    return { id, name, width, height, imageData, delay } satisfies SpriteEntry
  })
}
