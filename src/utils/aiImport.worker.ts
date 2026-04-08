import {
  detectScaleFactor,
  downscaleImage,
  quantizeColors,
  medianCutQuantize,
  removeBackgroundColor,
  detectBackgroundColor,
  cleanEdges,
  snapToPaletteColors,
  sliceIntoTiles,
  isEmptyTile,
  countUniqueColors,
  extractConnectedSprites,
  type DownscaleMethod,
} from './aiImport'

export type WorkerRequest =
  | { id: number; type: 'detectScale'; imageData: ImageData }
  | { id: number; type: 'detectBgColor'; imageData: ImageData }
  | {
      id: number
      type: 'process'
      imageData: ImageData
      scaleFactor: number
      downscaleMethod: DownscaleMethod
      doCleanEdges: boolean
      cleanEdgesThreshold: number
      removeBg: boolean
      bgColor: { r: number; g: number; b: number; a: number } | null
      bgTolerance: number
      quantizeMode: 'off' | 'threshold' | 'median' | 'palette'
      quantizeThreshold: number
      medianMaxColors: number
      paletteRgba: [number, number, number, number][]
    }
  | {
      id: number
      type: 'processAndSlice'
      imageData: ImageData
      scaleFactor: number
      downscaleMethod: DownscaleMethod
      doCleanEdges: boolean
      cleanEdgesThreshold: number
      removeBg: boolean
      bgColor: { r: number; g: number; b: number; a: number } | null
      bgTolerance: number
      quantizeMode: 'off' | 'threshold' | 'median' | 'palette'
      quantizeThreshold: number
      medianMaxColors: number
      paletteRgba: [number, number, number, number][]
      sliceMode: 'grid' | 'auto'
      tileW: number
      tileH: number
      skipEmpty: boolean
      autoMinPixels: number
    }

function processImagePipeline(
  imageData: ImageData,
  opts: {
    scaleFactor: number
    downscaleMethod: DownscaleMethod
    doCleanEdges: boolean
    cleanEdgesThreshold: number
    removeBg: boolean
    bgColor: { r: number; g: number; b: number; a: number } | null
    bgTolerance: number
    quantizeMode: 'off' | 'threshold' | 'median' | 'palette'
    quantizeThreshold: number
    medianMaxColors: number
    paletteRgba: [number, number, number, number][]
  },
): ImageData {
  let processed = downscaleImage(imageData, opts.scaleFactor, opts.downscaleMethod)
  if (opts.doCleanEdges) {
    processed = cleanEdges(processed, opts.cleanEdgesThreshold)
  }
  if (opts.removeBg && opts.bgColor) {
    processed = removeBackgroundColor(processed, opts.bgColor, opts.bgTolerance)
  }
  if (opts.quantizeMode === 'threshold') {
    processed = quantizeColors(processed, opts.quantizeThreshold)
  } else if (opts.quantizeMode === 'median') {
    processed = medianCutQuantize(processed, opts.medianMaxColors)
  } else if (opts.quantizeMode === 'palette' && opts.paletteRgba.length > 0) {
    processed = snapToPaletteColors(processed, opts.paletteRgba)
  }
  return processed
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data

  switch (msg.type) {
    case 'detectScale': {
      const results = detectScaleFactor(msg.imageData)
      self.postMessage({ id: msg.id, type: 'detectScale', results })
      break
    }

    case 'detectBgColor': {
      const color = detectBackgroundColor(msg.imageData)
      self.postMessage({ id: msg.id, type: 'detectBgColor', color })
      break
    }

    case 'process': {
      const processed = processImagePipeline(msg.imageData, msg)
      self.postMessage({ id: msg.id, type: 'process', processed })
      break
    }

    case 'processAndSlice': {
      const processed = processImagePipeline(msg.imageData, msg)
      const colorCount = countUniqueColors(processed)

      let tiles: ImageData[]
      if (msg.sliceMode === 'auto') {
        tiles = extractConnectedSprites(processed, msg.autoMinPixels)
      } else {
        tiles = sliceIntoTiles(processed, msg.tileW, msg.tileH)
        if (msg.skipEmpty) {
          tiles = tiles.filter((t) => !isEmptyTile(t))
        }
      }

      self.postMessage({ id: msg.id, type: 'processAndSlice', processed, tiles, colorCount })
      break
    }
  }
}
