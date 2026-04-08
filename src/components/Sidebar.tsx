import {
  Upload, FilePlus, Sparkles, Film,
  Undo2, Redo2, Save, FolderOpen, Download, Sun, Moon,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import type { PaletteColor } from '../hooks/usePalette'
import type { Tool, BrushShape, SelectionMode } from '../state/appReducer'
import { ToolSelector } from './sidebar/ToolSelector'
import { ColorPanel } from './sidebar/ColorPanel'
import { PalettePanel } from './sidebar/PalettePanel'
import { GridSettings } from './sidebar/GridSettings'

export type { Tool } from '../state/appReducer'

interface SidebarProps {
  gridSize: number
  onGridSizeChange: (size: number) => void
  tileCountX: number
  tileCountY: number
  onTileCountXChange: (count: number) => void
  onTileCountYChange: (count: number) => void
  onUpload: () => void
  onNewProject: () => void
  onAIImport: () => void
  onGifImport: (file: File) => void
  activeTool: Tool
  onToolChange: (tool: Tool) => void
  activeColor: string
  onColorChange: (color: string) => void
  secondaryColor: string
  onSecondaryColorChange: (color: string) => void
  onSwapColors: () => void
  colorHistory: string[]
  snapToPalette: boolean
  onSnapToPaletteChange: (enabled: boolean) => void
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
  palette: PaletteColor[]
  paletteTruncated: boolean
  paletteTotalUnique: number
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onSaveProject: () => void
  onLoadProject: () => void
  onExportCatPix: () => void
}

export function Sidebar({
  gridSize, onGridSizeChange,
  tileCountX, tileCountY, onTileCountXChange, onTileCountYChange,
  onUpload, onNewProject, onAIImport, onGifImport,
  activeTool, onToolChange,
  activeColor, onColorChange,
  secondaryColor, onSecondaryColorChange, onSwapColors,
  colorHistory, snapToPalette, onSnapToPaletteChange,
  brushSize, onBrushSizeChange,
  brushShape, onBrushShapeChange,
  customBrush, onOpenCustomBrush,
  selectionMode, onSelectionModeChange,
  magicTolerance, onMagicToleranceChange,
  palette, paletteTruncated, paletteTotalUnique,
  canUndo, canRedo, onUndo, onRedo,
  onSaveProject, onLoadProject, onExportCatPix,
}: SidebarProps) {
  const gifImportRef = useRef<HTMLInputElement>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('catpix-theme') as 'dark' | 'light') ?? 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('catpix-theme', theme)
  }, [theme])

  return (
    <div className="w-52 bg-bg-panel border-r border-border-default flex flex-col">
      {/* Upload + New */}
      <div className="p-3 border-b border-border-default space-y-1.5">
        <input
          ref={gifImportRef}
          type="file"
          accept=".gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onGifImport(file)
            e.target.value = ''
          }}
        />
        <button
          onClick={onUpload}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors cursor-pointer"
          aria-label="Upload tileset image"
        >
          <Upload size={16} />
          Upload Tileset
        </button>
        <button
          onClick={onNewProject}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-bg-hover hover:bg-border-default text-text-secondary hover:text-text-primary text-sm transition-colors cursor-pointer"
          aria-label="Create new blank tile"
        >
          <FilePlus size={16} />
          New Blank Tile
        </button>
        <button
          onClick={onAIImport}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-bg-hover hover:bg-border-default text-text-secondary hover:text-text-primary text-sm transition-colors cursor-pointer"
          aria-label="AI sprite import"
        >
          <Sparkles size={16} />
          AI Sprite Import
        </button>
        <button
          onClick={() => gifImportRef.current?.click()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-bg-hover hover:bg-border-default text-text-secondary hover:text-text-primary text-sm transition-colors cursor-pointer"
          aria-label="Import GIF as frames"
        >
          <Film size={16} />
          Import GIF
        </button>
      </div>

      {/* Project save/load */}
      <div className="p-3 border-b border-border-default space-y-1.5">
        <div className="flex gap-1.5">
          <button
            onClick={onSaveProject}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-bg-hover hover:bg-border-default text-text-secondary hover:text-text-primary text-xs transition-colors cursor-pointer"
            title="Save project to browser"
            aria-label="Save project"
          >
            <Save size={14} />
            Save
          </button>
          <button
            onClick={onLoadProject}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-bg-hover hover:bg-border-default text-text-secondary hover:text-text-primary text-xs transition-colors cursor-pointer"
            title="Load saved project"
            aria-label="Load project"
          >
            <FolderOpen size={14} />
            Load
          </button>
        </div>
        <button
          onClick={onExportCatPix}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md bg-bg-hover hover:bg-border-default text-text-secondary hover:text-text-primary text-xs transition-colors cursor-pointer"
          title="Export as .catpix project file"
          aria-label="Export as .catpix"
        >
          <Download size={14} />
          Export .catpix
        </button>
      </div>

      {/* Undo / Redo */}
      <div className="p-3 border-b border-border-default">
        <div className="flex gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="flex-1 flex items-center justify-center gap-1 p-2 rounded-md transition-colors cursor-pointer text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <Undo2 size={16} />
            Undo
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="flex-1 flex items-center justify-center gap-1 p-2 rounded-md transition-colors cursor-pointer text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
          >
            <Redo2 size={16} />
            Redo
          </button>
        </div>
      </div>

      <ToolSelector
        activeTool={activeTool}
        onToolChange={onToolChange}
        brushSize={brushSize}
        onBrushSizeChange={onBrushSizeChange}
        brushShape={brushShape}
        onBrushShapeChange={onBrushShapeChange}
        customBrush={customBrush}
        onOpenCustomBrush={onOpenCustomBrush}
        selectionMode={selectionMode}
        onSelectionModeChange={onSelectionModeChange}
        magicTolerance={magicTolerance}
        onMagicToleranceChange={onMagicToleranceChange}
      />

      <ColorPanel
        activeColor={activeColor}
        onColorChange={onColorChange}
        secondaryColor={secondaryColor}
        onSecondaryColorChange={onSecondaryColorChange}
        onSwapColors={onSwapColors}
        colorHistory={colorHistory}
        snapToPalette={snapToPalette}
        onSnapToPaletteChange={onSnapToPaletteChange}
      />

      <PalettePanel
        activeColor={activeColor}
        onColorChange={onColorChange}
        palette={palette}
        paletteTruncated={paletteTruncated}
        paletteTotalUnique={paletteTotalUnique}
      />

      <GridSettings
        gridSize={gridSize}
        onGridSizeChange={onGridSizeChange}
        tileCountX={tileCountX}
        tileCountY={tileCountY}
        onTileCountXChange={onTileCountXChange}
        onTileCountYChange={onTileCountYChange}
      />

      {/* Footer */}
      <div className="p-3 border-t border-border-default flex items-center justify-between">
        <span className="text-xs text-text-muted">CatPix v0.2</span>
        <button
          onClick={() => setTheme((t) => t === 'dark' ? 'light' : 'dark')}
          className="p-1.5 rounded bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </div>
  )
}
