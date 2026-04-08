import { useRef, useEffect, useCallback } from 'react'
import type { ScaleCandidate, DownscaleMethod } from '../utils/aiImport'

let nextId = 0

interface PendingCallbacks {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}

export function useAIImportWorker() {
  const workerRef = useRef<Worker | null>(null)
  const pendingRef = useRef<Map<number, PendingCallbacks>>(new Map())

  useEffect(() => {
    const worker = new Worker(
      new URL('../utils/aiImport.worker.ts', import.meta.url),
      { type: 'module' },
    )
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent) => {
      const { id } = e.data
      const cb = pendingRef.current.get(id)
      if (cb) {
        pendingRef.current.delete(id)
        cb.resolve(e.data)
      }
    }

    worker.onerror = (e: ErrorEvent) => {
      console.error('[AIImportWorker]', e.message)
      // Reject all pending promises so callers don't hang forever
      for (const [, cb] of pendingRef.current) {
        cb.reject(new Error(e.message ?? 'Worker error'))
      }
      pendingRef.current.clear()
    }

    return () => {
      worker.terminate()
      workerRef.current = null
      pendingRef.current.clear()
    }
  }, [])

  const send = useCallback(<T>(msg: Record<string, unknown>): Promise<T> => {
    return new Promise((resolve, reject) => {
      const id = nextId++
      pendingRef.current.set(id, { resolve: resolve as (v: unknown) => void, reject })
      workerRef.current?.postMessage({ ...msg, id })
    })
  }, [])

  const detectScale = useCallback(
    (imageData: ImageData) =>
      send<{ results: ScaleCandidate[] }>({ type: 'detectScale', imageData }).then((r) => r.results),
    [send],
  )

  const detectBgColor = useCallback(
    (imageData: ImageData) =>
      send<{ color: { r: number; g: number; b: number; a: number } }>({ type: 'detectBgColor', imageData }).then(
        (r) => r.color,
      ),
    [send],
  )

  const processImage = useCallback(
    (
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
    ) =>
      send<{ processed: ImageData }>({ type: 'process', imageData, ...opts }).then((r) => r.processed),
    [send],
  )

  const processAndSlice = useCallback(
    (
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
        sliceMode: 'grid' | 'auto'
        tileW: number
        tileH: number
        skipEmpty: boolean
        autoMinPixels: number
      },
    ) =>
      send<{ processed: ImageData; tiles: ImageData[]; colorCount: number }>({
        type: 'processAndSlice',
        imageData,
        ...opts,
      }),
    [send],
  )

  return { detectScale, detectBgColor, processImage, processAndSlice }
}
