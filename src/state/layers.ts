export type LayerBlendMode =
  | 'source-over'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'hard-light'
  | 'soft-light'
  | 'color-dodge'
  | 'color-burn'
  | 'difference'
  | 'exclusion'
  | 'lighten'
  | 'darken'

export interface Layer {
  id: string
  name: string
  imageData: ImageData
  visible: boolean
  opacity: number // 0–1
  blendMode: LayerBlendMode
}

let layerNameCounter = 0

export function createLayer(width: number, height: number, name?: string): Layer {
  layerNameCounter++
  return {
    id: crypto.randomUUID(),
    name: name ?? `Layer ${layerNameCounter}`,
    imageData: new ImageData(width, height),
    visible: true,
    opacity: 1,
    blendMode: 'source-over',
  }
}

export function createLayerFromImageData(imageData: ImageData, name?: string): Layer {
  layerNameCounter++
  return {
    id: crypto.randomUUID(),
    name: name ?? `Layer ${layerNameCounter}`,
    imageData: new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height,
    ),
    visible: true,
    opacity: 1,
    blendMode: 'source-over',
  }
}

// Module-level reusable canvas for per-layer rendering
let _layerTmpCanvas: HTMLCanvasElement | null = null

/**
 * Composite all visible layers bottom-up into a single ImageData.
 * Respects layer visibility, opacity, and blend mode.
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
  const ctx = canvas.getContext('2d')
  if (!ctx) return new ImageData(w, h)
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, w, h)

  // Reuse a single temp canvas for layer data
  if (!_layerTmpCanvas) _layerTmpCanvas = document.createElement('canvas')
  const tmp = _layerTmpCanvas
  if (tmp.width !== w) tmp.width = w
  if (tmp.height !== h) tmp.height = h
  const tmpCtx = tmp.getContext('2d')
  if (!tmpCtx) return new ImageData(w, h)

  for (const layer of layers) {
    if (!layer.visible) continue

    tmpCtx.clearRect(0, 0, w, h)
    tmpCtx.putImageData(layer.imageData, 0, 0)

    ctx.globalAlpha = layer.opacity
    ctx.globalCompositeOperation = layer.blendMode
    ctx.drawImage(tmp, 0, 0)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  return ctx.getImageData(0, 0, w, h)
}

export const MAX_LAYERS = 8
