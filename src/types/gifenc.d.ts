declare module 'gifenc' {
  export function GIFEncoder(): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: number[][]
        delay?: number
        dispose?: number
        transparent?: boolean
        transparentIndex?: number
      },
    ): void
    finish(): void
    bytes(): Uint8Array
    bytesView(): Uint8Array
    buffer: ArrayBuffer
    reset(): void
  }

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: 'rgb565' | 'rgb444' | 'rgba4444'; oneBitAlpha?: boolean | number },
  ): number[][]

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: 'rgb565' | 'rgb444' | 'rgba4444',
  ): Uint8Array

  export function nearestColorIndex(
    palette: number[][],
    color: number[],
  ): number

  export function nearestColor(
    palette: number[][],
    color: number[],
  ): number[]

  export function nearestColorIndexWithDistance(
    palette: number[][],
    color: number[],
  ): [number, number]

  export function prequantize(
    rgba: Uint8Array | Uint8ClampedArray,
    options?: { roundRGB?: number; roundAlpha?: number; oneBitAlpha?: boolean | number },
  ): Uint8Array

  export function snapColorsToPalette(
    palette: number[][],
    knownColors: number[][],
    threshold?: number,
  ): void
}
