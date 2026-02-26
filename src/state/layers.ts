export interface Layer {
  id: string
  name: string
  imageData: ImageData
  visible: boolean
  opacity: number // 0–1
}

let layerCounter = 0

export function createLayer(width: number, height: number, name?: string): Layer {
  layerCounter++
  return {
    id: `layer_${layerCounter}_${Date.now()}`,
    name: name ?? `Layer ${layerCounter}`,
    imageData: new ImageData(width, height),
    visible: true,
    opacity: 1,
  }
}

export function createLayerFromImageData(imageData: ImageData, name?: string): Layer {
  layerCounter++
  return {
    id: `layer_${layerCounter}_${Date.now()}`,
    name: name ?? `Layer ${layerCounter}`,
    imageData: new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height,
    ),
    visible: true,
    opacity: 1,
  }
}

// Module-level reusable canvas for per-layer rendering
let _layerTmpCanvas: HTMLCanvasElement | null = null

/**
 * Composite all visible layers bottom-up into a single ImageData.
 * Respects layer visibility and opacity.
 * Accepts an optional reusable compositor canvas to avoid allocation.
 */
export function flattenLayers(layers: Layer[], compositorCanvas?: HTMLCanvasElement): ImageData {
  if (layers.length === 0) {
    return new ImageData(1, 1)
  }

  const w = layers[0].imageData.width
  const h = layers[0].imageData.height

  const canvas = compositorCanvas ?? document.createElement('canvas')
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, w, h)

  // Reuse a single temp canvas for layer data
  if (!_layerTmpCanvas) _layerTmpCanvas = document.createElement('canvas')
  const tmp = _layerTmpCanvas
  if (tmp.width !== w) tmp.width = w
  if (tmp.height !== h) tmp.height = h
  const tmpCtx = tmp.getContext('2d')!

  for (const layer of layers) {
    if (!layer.visible) continue

    tmpCtx.clearRect(0, 0, w, h)
    tmpCtx.putImageData(layer.imageData, 0, 0)

    ctx.globalAlpha = layer.opacity
    ctx.drawImage(tmp, 0, 0)
    ctx.globalAlpha = 1
  }

  return ctx.getImageData(0, 0, w, h)
}

export const MAX_LAYERS = 8
