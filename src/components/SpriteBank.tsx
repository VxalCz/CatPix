import { useRef, useEffect, useCallback, useState, memo } from 'react'
import { Package, Trash2, X, Copy } from 'lucide-react'
import type { SpriteEntry } from '../App'
import { ConfirmDialog } from './ConfirmDialog'

interface SpriteBankProps {
  sprites: SpriteEntry[]
  editingBankIndex: number | null
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  onSelectSprite: (index: number) => void
  onRename: (id: string, name: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onClearAll: () => void
  onOpenExport: () => void
}

const SpriteThumb = memo(function SpriteThumb({ sprite }: { sprite: SpriteEntry }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width = sprite.width
    canvas.height = sprite.height
    ctx.imageSmoothingEnabled = false
    ctx.putImageData(sprite.imageData, 0, 0)
  }, [sprite])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: 48,
        height: 48,
        imageRendering: 'pixelated',
      }}
    />
  )
})

export function SpriteBank({
  sprites,
  editingBankIndex,
  onRemove,
  onDuplicate,
  onSelectSprite,
  onRename,
  onReorder,
  onClearAll,
  onOpenExport,
}: SpriteBankProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [editingNameValue, setEditingNameValue] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const prevCount = useRef(sprites.length)
  useEffect(() => {
    if (sprites.length > prevCount.current && scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
    prevCount.current = sprites.length
  }, [sprites.length])

  const handleClearAll = useCallback(() => {
    setShowClearConfirm(true)
  }, [])

  const confirmClearAll = useCallback(() => {
    onClearAll()
    setShowClearConfirm(false)
  }, [onClearAll])

  const startRename = useCallback((id: string, currentName: string) => {
    setEditingNameId(id)
    setEditingNameValue(currentName)
  }, [])

  const commitRename = useCallback(() => {
    if (editingNameId && editingNameValue.trim()) {
      onRename(editingNameId, editingNameValue.trim())
    }
    setEditingNameId(null)
  }, [editingNameId, editingNameValue, onRename])

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIndex(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(idx)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDropTarget(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, toIdx: number) => {
    e.preventDefault()
    const fromIdx = dragIndex
    setDragIndex(null)
    setDropTarget(null)
    if (fromIdx !== null && fromIdx !== toIdx) {
      onReorder(fromIdx, toIdx)
    }
  }, [dragIndex, onReorder])

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    setDropTarget(null)
  }, [])

  return (
    <>
      <div className="h-20 bg-bg-panel border-t border-border-default flex items-center shrink-0">
        {/* Label */}
        <div className="flex flex-col items-center justify-center gap-1 px-3 border-r border-border-default h-full min-w-[100px]">
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
            Sprite Bank
          </span>
          <span className="text-[10px] text-text-muted">{sprites.length} sprites</span>
        </div>

        {/* Sprite list */}
        <div ref={scrollRef} className="flex-1 flex items-center gap-1 px-2 overflow-x-auto h-full">
          {sprites.length === 0 ? (
            <span className="text-xs text-text-muted px-2">
              Save tiles from the editor to build your collection
            </span>
          ) : (
            sprites.map((sprite, idx) => (
              <div
                key={sprite.id}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={`relative group shrink-0 rounded p-0.5 transition-colors cursor-pointer ${
                  editingBankIndex === idx
                    ? 'border-2 border-accent'
                    : 'border border-border-default hover:border-accent'
                } ${dragIndex === idx ? 'opacity-40' : ''} ${
                  dropTarget === idx && dragIndex !== idx ? 'ring-2 ring-accent' : ''
                }`}
                style={{
                  background: `
                    repeating-conic-gradient(#1a1a2e 0% 25%, #0f0f1e 0% 50%)
                    50% / 8px 8px
                  `,
                }}
                title={`${sprite.name} (click to edit, double-click name to rename)`}
                onClick={() => onSelectSprite(idx)}
              >
                <SpriteThumb sprite={sprite} />

                {/* Name / rename input */}
                <span
                  className="absolute bottom-0 left-0 right-0 bg-black/70 text-[9px] text-text-muted px-1 truncate text-center"
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    startRename(sprite.id, sprite.name)
                  }}
                >
                  {editingNameId === sprite.id ? (
                    <input
                      autoFocus
                      value={editingNameValue}
                      onChange={(e) => setEditingNameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename()
                        if (e.key === 'Escape') setEditingNameId(null)
                        e.stopPropagation()
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-transparent text-white text-[9px] text-center outline-none border-b border-accent"
                    />
                  ) : (
                    sprite.name
                  )}
                </span>

                {/* Duplicate button */}
                <button
                  onClick={(e) => { e.stopPropagation(); onDuplicate(sprite.id) }}
                  className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full bg-accent text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  title="Duplicate"
                  aria-label={`Duplicate ${sprite.name}`}
                >
                  <Copy size={9} />
                </button>

                {/* Remove button */}
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(sprite.id) }}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  aria-label={`Remove ${sprite.name}`}
                >
                  <X size={10} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 px-3 border-l border-border-default h-full justify-center">
          <button
            onClick={onOpenExport}
            disabled={sprites.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Export sprite sheet"
          >
            <Package size={13} />
            Export .zip
          </button>
          <button
            onClick={handleClearAll}
            disabled={sprites.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Clear all sprites"
          >
            <Trash2 size={13} />
            Clear All
          </button>
        </div>
      </div>

      {showClearConfirm && (
        <ConfirmDialog
          title="Clear All Sprites"
          message={`Are you sure you want to remove all ${sprites.length} sprites? This cannot be undone.`}
          confirmLabel="Clear All"
          destructive
          onConfirm={confirmClearAll}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </>
  )
}
