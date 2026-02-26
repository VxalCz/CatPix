import type { SpriteEntry } from '../App'

const DB_NAME = 'catpix'
const DB_VERSION = 1
const STORE_NAME = 'project'
const PROJECT_KEY = 'current'

interface SerializedSprite {
  id: string
  name: string
  width: number
  height: number
  data: number[]  // Uint8ClampedArray as regular array
}

export interface ProjectData {
  gridSize: number
  tileCountX: number
  tileCountY: number
  sprites: SerializedSprite[]
  imageDataUrl: string | null
  savedAt: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function serializeSprites(sprites: SpriteEntry[]): SerializedSprite[] {
  return sprites.map((s) => ({
    id: s.id,
    name: s.name,
    width: s.width,
    height: s.height,
    data: Array.from(s.imageData.data),
  }))
}

function deserializeSprites(serialized: SerializedSprite[]): SpriteEntry[] {
  return serialized.map((s) => ({
    id: s.id,
    name: s.name,
    width: s.width,
    height: s.height,
    imageData: new ImageData(
      new Uint8ClampedArray(s.data),
      s.width,
      s.height,
    ),
  }))
}

export async function saveProject(
  sprites: SpriteEntry[],
  gridSize: number,
  tileCountX: number,
  tileCountY: number,
  image: HTMLImageElement | null,
): Promise<void> {
  let imageDataUrl: string | null = null
  if (image) {
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(image, 0, 0)
    imageDataUrl = canvas.toDataURL('image/png')
  }

  const data: ProjectData = {
    gridSize,
    tileCountX,
    tileCountY,
    sprites: serializeSprites(sprites),
    imageDataUrl,
    savedAt: Date.now(),
  }

  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(data, PROJECT_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadProject(): Promise<ProjectData | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(PROJECT_KEY)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function hasProject(): Promise<boolean> {
  const data = await loadProject()
  return data !== null
}

export async function clearProject(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(PROJECT_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Restores sprites and image from ProjectData.
 */
export function restoreSprites(data: ProjectData): SpriteEntry[] {
  return deserializeSprites(data.sprites)
}

export function restoreImage(data: ProjectData): Promise<HTMLImageElement | null> {
  if (!data.imageDataUrl) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = data.imageDataUrl!
  })
}
