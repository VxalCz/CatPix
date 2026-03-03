import { useState } from 'react'
import { Eye, EyeOff, Trash2, Plus, Layers } from 'lucide-react'
import type { Layer, LayerBlendMode } from '../state/layers'
import { MAX_LAYERS } from '../state/layers'
import { useEditableField } from '../hooks/useEditableField'

const BLEND_MODES: { value: LayerBlendMode; label: string }[] = [
  { value: 'source-over', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'darken', label: 'Darken' },
]

interface LayerPanelProps {
  layers: Layer[]
  activeLayerId: string | null
  onAddLayer: () => void
  onRemoveLayer: (id: string) => void
  onSetActiveLayer: (id: string) => void
  onSetVisibility: (id: string, visible: boolean) => void
  onSetOpacity: (id: string, opacity: number) => void
  onSetName: (id: string, name: string) => void
  onSetBlendMode: (id: string, blendMode: LayerBlendMode) => void
  onReorder: (fromIndex: number, toIndex: number) => void
}

export function LayerPanel({
  layers,
  activeLayerId,
  onAddLayer,
  onRemoveLayer,
  onSetActiveLayer,
  onSetVisibility,
  onSetOpacity,
  onSetName,
  onSetBlendMode,
  onReorder,
}: LayerPanelProps) {
  const {
    editingId: editingNameId,
    editingValue: editingNameValue,
    setEditingValue: setEditingNameValue,
    startEditing: startRename,
    commitEditing: commitRename,
    cancelEditing: cancelRename,
  } = useEditableField(onSetName)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)

  if (layers.length === 0) return null

  // Display layers in reverse order (top layer first in UI)
  const displayLayers = [...layers].reverse()

  return (
    <div className="p-3 border-b border-border-default">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          <span className="inline-flex items-center gap-1.5">
            <Layers size={12} />
            Layers
          </span>
        </h3>
        <button
          onClick={onAddLayer}
          disabled={layers.length >= MAX_LAYERS}
          className="p-1 rounded bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          title={`Add layer (max ${MAX_LAYERS})`}
          aria-label="Add layer"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="space-y-0.5">
        {displayLayers.map((layer) => {
          const realIndex = layers.indexOf(layer)
          const isActive = layer.id === activeLayerId

          return (
            <div
              key={layer.id}
              draggable
              onDragStart={() => setDragIndex(realIndex)}
              onDragOver={(e) => {
                e.preventDefault()
                setDropTarget(realIndex)
              }}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(e) => {
                e.preventDefault()
                if (dragIndex !== null && dragIndex !== realIndex) {
                  onReorder(dragIndex, realIndex)
                }
                setDragIndex(null)
                setDropTarget(null)
              }}
              onDragEnd={() => { setDragIndex(null); setDropTarget(null) }}
              onClick={() => onSetActiveLayer(layer.id)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] cursor-pointer transition-colors ${
                isActive
                  ? 'bg-accent/20 border border-accent/50'
                  : 'bg-bg-hover border border-transparent hover:border-border-default'
              } ${dragIndex === realIndex ? 'opacity-40' : ''} ${
                dropTarget === realIndex && dragIndex !== realIndex ? 'ring-1 ring-accent' : ''
              }`}
            >
              {/* Visibility toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSetVisibility(layer.id, !layer.visible)
                }}
                className="p-0.5 text-text-secondary hover:text-text-primary"
                aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
              >
                {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>

              {/* Layer name */}
              <span
                className="flex-1 truncate text-text-primary"
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  startRename(layer.id, layer.name)
                }}
              >
                {editingNameId === layer.id ? (
                  <input
                    autoFocus
                    value={editingNameValue}
                    onChange={(e) => setEditingNameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename()
                      if (e.key === 'Escape') cancelRename()
                      e.stopPropagation()
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-transparent text-text-primary text-[11px] outline-none border-b border-accent"
                  />
                ) : (
                  layer.name
                )}
              </span>

              {/* Opacity */}
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(layer.opacity * 100)}
                onChange={(e) => {
                  e.stopPropagation()
                  onSetOpacity(layer.id, Number(e.target.value) / 100)
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-12 accent-accent"
                title={`Opacity: ${Math.round(layer.opacity * 100)}%`}
              />

              {/* Blend mode */}
              <select
                value={layer.blendMode}
                onChange={(e) => {
                  e.stopPropagation()
                  onSetBlendMode(layer.id, e.target.value as LayerBlendMode)
                }}
                onClick={(e) => e.stopPropagation()}
                className="text-[9px] bg-bg-primary border border-border-default text-text-secondary rounded px-0.5 py-0.5 cursor-pointer focus:outline-none focus:border-accent"
                title="Blend mode"
              >
                {BLEND_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>

              {/* Delete */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRemoveLayer(layer.id)
                }}
                disabled={layers.length <= 1}
                className="p-0.5 text-text-muted hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={`Delete ${layer.name}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
