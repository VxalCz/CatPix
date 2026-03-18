# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git

Do NOT add `Co-Authored-By` trailers to commit messages. This project uses multiple AI models and co-authorship attribution is not wanted.

## Commands

```bash
npm run dev        # Start dev server (Vite HMR)
npm run build      # tsc -b && vite build
npm run lint       # ESLint
npm run preview    # Preview production build
```

No test runner is configured.

## Architecture

**CatPix** is a browser-based tileset editor and pixel sprite studio. The entire app is client-side — no backend, no persistence beyond browser storage.

### Data flow

1. User uploads an image → stored as `HTMLImageElement` in `App` state
2. User clicks a tile in `TilesetViewer` → `App` calls `getImageData` on an offscreen canvas → `tileData: ImageData` is passed to `PixelEditor`
3. User paints pixels → `PixelEditor` mutates layers and fires `onTileDataChange` back to `App`
4. User clicks "Save to Bank" → `App` clones the flattened `ImageData` into a `SpriteEntry` in `sprites[]`
5. User exports → `exportProject()` (spritesheet ZIP) or `exportGif()` (animated GIF)

### State ownership

Global state lives in `App.tsx` managed via `useReducer` → `appReducer.ts` (wrapped by `undoReducer.ts` for undo/redo). Contexts: `AppStateContext` / `AppDispatchContext`.

Key state fields:
- `image` — the loaded `HTMLImageElement`
- `gridSize` — tile size in px (8–128, step 8)
- `tileCountX` / `tileCountY` — multi-tile selection dimensions
- `selectedTile` / `tileData` — tile currently open in the pixel editor
- `editingBankIndex` — index of the sprite loaded from bank (`null` if editing from tileset)
- `sprites: SpriteEntry[]` — the sprite bank collection
- `layers: Layer[]` — per-sprite layers (max 8); `activeLayerId: string | null`
- `activeTool` — `'draw' | 'erase' | 'fill' | 'eyedropper' | 'line' | 'rectangle' | 'ellipse' | 'selection' | 'replace' | 'text' | 'spray' | 'polygon'`
- `activeColor` / `secondaryColor` — hex strings; `X` key swaps them
- `brushSize` — 1–16
- `brushShape` — `'square' | 'circle' | 'dither' | 'custom'`
- `selectionMode` — `'box' | 'magic' | 'lasso'`; `magicTolerance` — 0–100
- Modal flags: `showExportModal`, `showNewProjectModal`, `showAIImportModal`

### Component layout

```
App
├── Sidebar (left, w-52)       — upload, tool picker, brush size/shape, color/palette,
│                                palette import (.hex/.gpl), preset palettes, grid size,
│                                tile count, undo/redo, save/load project, theme toggle
├── TilesetViewer (center)     — zoomable/pannable canvas; click to select tile
└── Right panel (w-72)
    ├── PropertiesPanel        — image metadata display
    ├── PixelEditor            — editing canvas; zoom/pan; working buffer for draw/erase;
    │   │                        shape previews; symmetry; onion skin; lock alpha; reference image
    │   └── PixelEditorControls — symmetry toggles, wrap, onion, lock-alpha, nudge,
    │                             transform (rotate/flip), reference image, clear, download PNG,
    │                             save/update-in-bank buttons
    ├── LayerPanel             — add/remove/reorder layers; visibility, opacity, blend mode, rename
    └── AnimationPreview       — flip-book preview of sprites in the bank
SpriteBank (bottom bar)        — thumbnail strip of saved sprites; select/duplicate/remove; export trigger
ExportModal (overlay)          — spritesheet tab (layout, padding, atlas format, individual PNGs)
                                 + GIF tab (frame range, FPS, scale, loop, transparent bg)
                                 + Tilemap tab (Tiled-compatible .tsj + .tmj + PNG zip)
AIImportModal (overlay)        — two-step AI sprite import (configure → preview)
NewProjectModal (overlay)      — create a blank canvas with a chosen tile size
```

### Custom hooks

- `useCanvas` — takes `{width, height, draw}`, manages canvas sizing, exposes `redraw()`
- `usePalette` — extracts top-64 most-frequent colors from loaded image (skips transparent); returns `{colors, truncated, totalUnique}`
- `useSymmetry` — given `{horizontal, vertical, gridSize}`, returns `getMirroredPixels(px, py)`
- `usePixelEditorInput` — all mouse/keyboard input for `PixelEditor`: zoom/pan, draw/erase via working buffer, shape preview dispatch, selection (box + magic wand), clipboard (Ctrl+C/V), nudge, Alt-eyedropper; returns `{zoom, offset, isPanning, mousePixelPos, selection, selectionContent, isOverSelection, nudge}`
- `useEditableField` — reusable inline double-click rename; used in SpriteBank and LayerPanel

### Layers

`Layer` interface (`src/state/layers.ts`):
```typescript
interface Layer {
  id: string
  name: string
  imageData: ImageData
  visible: boolean
  opacity: number        // 0–1
  blendMode: LayerBlendMode
}
```

`LayerBlendMode`: `'source-over' | 'multiply' | 'screen' | 'overlay' | 'hard-light' | 'soft-light' | 'color-dodge' | 'color-burn' | 'difference' | 'exclusion' | 'lighten' | 'darken'`

Key functions: `createLayer(w, h, name?)`, `createLayerFromImageData(imageData, name?)`, `flattenLayers(layers)`.

### Utilities

- `src/utils/brushStamp.ts` — `generateBrushStamp(size, shape): BrushOffset[]`; shapes: square, circle, dither (checkerboard)
- `src/utils/ellipse.ts` — `ellipseOutline`, `filledEllipse`, `ellipseFromCorners` (midpoint algorithm)
- `src/utils/magicWand.ts` — `magicWandSelect(imageData, x, y, tolerance)`, `maskToBoundingBox`, `extractMaskRegion`; BFS with RGBA Manhattan distance
- `src/utils/colorUtils.ts` — `hexToRgba`, `rgbaToHex`, `getContext2D`
- `src/utils/parsePalette.ts` — `parsePalette(content, filename)` — parses `.hex` and `.gpl` (GIMP) palette files
- `src/utils/pixelEditorDraw.ts` — drawing helpers used by `PixelEditor` (flood fill, shape rendering on ImageData)
- `src/utils/exportGif.ts` — `exportGif(sprites[], options)` using `gifenc`; options: fps, scale (1/2/4×), loopCount, frameStart/End, transparentBackground
- `src/utils/exportProject.ts` — `exportProject()` produces spritesheet ZIP (PNG + JSON atlas)
- `src/utils/aiImport.ts` — AI import pipeline (see AI Sprite Import section)

### AI Sprite Import

`AIImportModal` lets users import AI-generated pixel art (512×512+ images where each logical pixel is an NxN block). The pipeline:

1. User uploads an image → `detectScaleFactor()` samples random NxN blocks for candidates `[2, 3, 4, 6, 8, 10, 12, 16]`, scores uniformity, returns sorted `{factor, confidence}[]`
2. User picks scale factor, downscale method, tile size, sprite layout, optional color quantization, optional background removal
3. `downscaleImage()` dispatches to: `'mode'` (most-frequent-color per block, recommended), `'center'` (center pixel), `'average'` (averaged pixels)
4. Optional: `quantizeColors()` merges similar colors within a Manhattan-distance threshold
5. Optional: `detectBackgroundColor()` → `removeBackgroundColor()` makes matching edge pixels transparent
6. `sliceIntoTiles()` cuts the result into sprites, optionally skipping empty tiles
7. Results go to `App.handleAIImport()` (appends to `sprites[]`) or `App.handleAILoadAsTileset()` (loads as tileset)

### Styling

Tailwind CSS v4 via the `@tailwindcss/vite` plugin (no `tailwind.config.js`). Use semantic tokens: `bg-bg-panel`, `bg-bg-hover`, `bg-bg-primary`, `bg-bg-secondary`, `text-text-primary`, `text-text-secondary`, `text-text-muted`, `border-border-default`, `bg-accent`, `bg-accent-hover`.

### Export formats

- **Spritesheet ZIP** (`catpix_export.zip`): `spritesheet.png` + `spritesheet.json` atlas (CatPix / TexturePacker / CSS Sprites format); optional individual PNGs
- **Animated GIF** via `exportGif.ts`: frame range, FPS (1–60), scale (1×/2×/4×), loop count, optional 1-bit transparency
- **Project file** (`.catpix`): binary save via `src/utils/storage.ts`; also save/load to browser storage

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `D` | Draw tool |
| `E` | Erase tool |
| `F` | Fill tool |
| `I` | Eyedropper |
| `L` | Line tool |
| `R` | Rectangle tool |
| `O` | Ellipse tool |
| `M` | Selection tool |
| `Alt` | Temporary eyedropper (any tool) |
| `Delete` | Clear selection region |
| `Ctrl+C` | Copy selection |
| `Ctrl+V` | Paste selection |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `A` | Spray tool |
| `P` | Polygon tool |
| `X` | Swap fg/bg colors |
| `0` | Fit canvas to view |
| `Arrow keys` | Move selection content |
| `Shift` (shapes) | Constrain to square/circle |
| `Escape` | Close modals |
| Scroll wheel | Zoom canvas |
| Middle-click / Alt+left-click | Pan canvas |
