import { Image, Info } from 'lucide-react'

interface PropertiesPanelProps {
  image: HTMLImageElement | null
  gridSize: number
}

export function PropertiesPanel({ image, gridSize }: PropertiesPanelProps) {
  const cols = image ? Math.ceil(image.width / gridSize) : 0
  const rows = image ? Math.ceil(image.height / gridSize) : 0
  const totalTiles = cols * rows

  return (
    <>
      {/* Image Info */}
      <div className="p-3 border-b border-border-default">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
          <span className="inline-flex items-center gap-1.5">
            <Image size={12} />
            Tileset Info
          </span>
        </h3>

        {image ? (
          <div className="space-y-1.5 text-sm">
            <InfoRow label="Width" value={`${image.width}px`} />
            <InfoRow label="Height" value={`${image.height}px`} />
            <InfoRow label="Tile size" value={`${gridSize} x ${gridSize}`} />
            <InfoRow label="Columns" value={String(cols)} />
            <InfoRow label="Rows" value={String(rows)} />
            <InfoRow label="Total tiles" value={String(totalTiles)} />
          </div>
        ) : (
          <p className="text-sm text-text-muted">No image loaded</p>
        )}
      </div>

      {/* Help */}
      <div className="p-3 border-b border-border-default">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
          <span className="inline-flex items-center gap-1.5">
            <Info size={12} />
            Controls
          </span>
        </h3>
        <div className="space-y-1 text-xs text-text-secondary">
          <p>Scroll to zoom</p>
          <p>Alt + drag to pan</p>
          <p>Middle-click to pan</p>
        </div>
      </div>

    </>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-text-secondary">{label}</span>
      <span className="text-text-primary font-mono">{value}</span>
    </div>
  )
}
