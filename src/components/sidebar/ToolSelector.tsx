import {
  Pencil, Eraser, PaintBucket, Pipette, Minus, Square, Circle, BoxSelect,
  RefreshCw, Type, SprayCan, Pentagon, Wand2, Lasso, Brush,
} from 'lucide-react'
import type { Tool, BrushShape, SelectionMode } from '../../state/appReducer'

const tools: { icon: typeof Pencil; label: string; key: Tool }[] = [
  { icon: Pencil, label: 'Draw (D)', key: 'draw' },
  { icon: Eraser, label: 'Erase (E)', key: 'erase' },
  { icon: PaintBucket, label: 'Fill (F)', key: 'fill' },
  { icon: Pipette, label: 'Eyedropper (I)', key: 'eyedropper' },
  { icon: Minus, label: 'Line (L)', key: 'line' },
  { icon: Square, label: 'Rectangle (R)', key: 'rectangle' },
  { icon: Circle, label: 'Ellipse (O)', key: 'ellipse' },
  { icon: BoxSelect, label: 'Selection (M)', key: 'selection' },
  { icon: RefreshCw, label: 'Replace color', key: 'replace' },
  { icon: Type, label: 'Text tool', key: 'text' },
  { icon: SprayCan, label: 'Spray (A)', key: 'spray' },
  { icon: Pentagon, label: 'Polygon (P)', key: 'polygon' },
]

interface ToolSelectorProps {
  activeTool: Tool
  onToolChange: (tool: Tool) => void
  brushSize: number
  onBrushSizeChange: (size: number) => void
  brushShape: BrushShape
  onBrushShapeChange: (shape: BrushShape) => void
  customBrush: boolean[][] | null
  onOpenCustomBrush: () => void
  selectionMode: SelectionMode
  onSelectionModeChange: (mode: SelectionMode) => void
  magicTolerance: number
  onMagicToleranceChange: (tolerance: number) => void
}

export function ToolSelector({
  activeTool, onToolChange,
  brushSize, onBrushSizeChange,
  brushShape, onBrushShapeChange,
  customBrush, onOpenCustomBrush,
  selectionMode, onSelectionModeChange,
  magicTolerance, onMagicToleranceChange,
}: ToolSelectorProps) {
  return (
    <div className="p-3 border-b border-border-default">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
        Tools
      </h3>
      <div className="grid grid-cols-4 gap-1">
        {tools.map((tool) => (
          <button
            key={tool.key}
            onClick={() => onToolChange(tool.key)}
            className={`flex flex-col items-center gap-0.5 p-1.5 rounded-md transition-colors cursor-pointer text-[10px] ${
              activeTool === tool.key
                ? 'bg-accent text-white'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            }`}
            title={tool.label}
            aria-label={tool.label}
          >
            <tool.icon size={16} />
            {tool.label.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Brush Size - only for draw/erase */}
      {(activeTool === 'draw' || activeTool === 'erase') && (
        <div className="mt-2">
          {brushShape !== 'custom' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-muted">Size</span>
              <input
                type="range"
                min={1}
                max={16}
                value={brushSize}
                onChange={(e) => onBrushSizeChange(Number(e.target.value))}
                className="flex-1 accent-accent"
              />
              <span className="text-xs text-text-primary font-mono w-4 text-right">{brushSize}</span>
            </div>
          )}
          <div className="flex gap-1 mt-1 flex-wrap">
            <button
              onClick={() => onBrushShapeChange('square')}
              className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] transition-colors cursor-pointer ${
                brushShape === 'square'
                  ? 'bg-accent text-white'
                  : 'bg-bg-hover text-text-secondary hover:text-text-primary'
              }`}
            >
              <Square size={10} />
              Sq
            </button>
            <button
              onClick={() => onBrushShapeChange('circle')}
              className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] transition-colors cursor-pointer ${
                brushShape === 'circle'
                  ? 'bg-accent text-white'
                  : 'bg-bg-hover text-text-secondary hover:text-text-primary'
              }`}
            >
              <Circle size={10} />
              Circ
            </button>
            <button
              onClick={() => onBrushShapeChange('dither')}
              className={`flex-1 flex items-center justify-center py-1 rounded text-[10px] transition-colors cursor-pointer ${
                brushShape === 'dither'
                  ? 'bg-accent text-white'
                  : 'bg-bg-hover text-text-secondary hover:text-text-primary'
              }`}
              title="Dithering (checkerboard pattern)"
            >
              Dith
            </button>
            <button
              onClick={onOpenCustomBrush}
              className={`flex-1 flex items-center justify-center gap-0.5 py-1 rounded text-[10px] transition-colors cursor-pointer ${
                brushShape === 'custom' && customBrush
                  ? 'bg-accent text-white'
                  : 'bg-bg-hover text-text-secondary hover:text-text-primary'
              }`}
              title="Custom brush pattern"
            >
              <Brush size={10} />
              Cust
            </button>
          </div>
        </div>
      )}

      {/* Selection Mode - only for selection tool */}
      {activeTool === 'selection' && (
        <div className="mt-2">
          <div className="flex gap-1">
            <button
              onClick={() => onSelectionModeChange('box')}
              className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] transition-colors cursor-pointer ${
                selectionMode === 'box'
                  ? 'bg-accent text-white'
                  : 'bg-bg-hover text-text-secondary hover:text-text-primary'
              }`}
            >
              <BoxSelect size={10} />
              Box
            </button>
            <button
              onClick={() => onSelectionModeChange('magic')}
              className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] transition-colors cursor-pointer ${
                selectionMode === 'magic'
                  ? 'bg-accent text-white'
                  : 'bg-bg-hover text-text-secondary hover:text-text-primary'
              }`}
            >
              <Wand2 size={10} />
              Magic
            </button>
            <button
              onClick={() => onSelectionModeChange('lasso')}
              className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] transition-colors cursor-pointer ${
                selectionMode === 'lasso'
                  ? 'bg-accent text-white'
                  : 'bg-bg-hover text-text-secondary hover:text-text-primary'
              }`}
            >
              <Lasso size={10} />
              Lasso
            </button>
          </div>
          {selectionMode === 'magic' && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-text-muted">Tolerance</span>
              <input
                type="range"
                min={0}
                max={100}
                value={magicTolerance}
                onChange={(e) => onMagicToleranceChange(Number(e.target.value))}
                className="flex-1 accent-accent"
              />
              <span className="text-xs text-text-primary font-mono w-4 text-right">{magicTolerance}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
