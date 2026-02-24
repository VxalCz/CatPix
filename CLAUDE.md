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

**CatPix** is a browser-based tileset editor and pixel sprite studio. The entire app is client-side — no backend, no persistence.

### Data flow

1. User uploads an image → stored as `HTMLImageElement` in `App` state
2. User clicks a tile in `TilesetViewer` → `App` calls `getImageData` on an offscreen canvas → `tileData: ImageData` is passed to `PixelEditor`
3. User paints pixels → `PixelEditor` mutates a copy of the `ImageData` and fires `onTileDataChange` back to `App`
4. User clicks "Save to Bank" → `App` clones the `ImageData` into a `SpriteEntry` in the `sprites[]` array
5. User exports → `exportProject()` composites all sprites onto a sheet canvas, builds a JSON atlas, zips both with JSZip, and triggers a download

### State ownership

All meaningful state lives in `App.tsx`:
- `image` — the loaded `HTMLImageElement`
- `gridSize` — tile size in px (8–128, step 8)
- `tileCountX` / `tileCountY` — how many tiles wide/tall to extract at once (multi-tile selection)
- `selectedTile` / `tileData` — the tile currently open in the pixel editor
- `editingBankIndex` — index of the sprite currently loaded from the bank into the editor (`null` if editing from tileset)
- `sprites: SpriteEntry[]` — the sprite bank collection
- `activeTool` / `activeColor` — shared editor state passed down to Sidebar and PixelEditor

### Component layout

```
App
├── Sidebar (left, w-52)       — upload, tool picker, color/palette, grid size, tile count
├── TilesetViewer (center)     — zoomable/pannable canvas; click to select tile
└── Right panel (w-72)
    ├── PropertiesPanel        — image metadata display
    ├── PixelEditor            — 256×256 display canvas for editing; symmetry toggles; onion skin; save/update-in-bank
    └── AnimationPreview       — flip-book preview of sprites in the bank
SpriteBank (bottom bar)        — thumbnail strip of saved sprites; select/duplicate/remove; export trigger
ExportModal (overlay)          — layout options, preview, triggers exportProject()
AIImportModal (overlay)        — two-step AI sprite import (configure → preview)
NewProjectModal (overlay)      — create a blank canvas with a chosen tile size
```

### Custom hooks

- `useCanvas` — generic hook: takes `{width, height, draw}`, manages canvas sizing and exposes `redraw()`
- `usePalette` — extracts the top-64 most-frequent colors from the loaded image (skips fully transparent pixels); returns `{colors, truncated, totalUnique}`
- `useSymmetry` — given `{horizontal, vertical, gridSize}`, returns `getMirroredPixels(px, py)` which yields all pixel coordinates to paint (deduplicates center pixels on odd-size grids)

### AI Sprite Import

`AIImportModal` lets users import AI-generated pixel art (512x512+ images where each logical pixel is an NxN block). The pipeline:

1. User uploads an image → `detectScaleFactor()` samples random NxN blocks for candidates `[2, 3, 4, 6, 8, 10, 12, 16]`, scores uniformity, returns sorted `{factor, confidence}[]`
2. User picks scale factor (auto-detected or manual), downscale method, tile size, sprite layout (tiles wide × tall), optional color quantization, optional background removal
3. `downscaleImage()` dispatches to one of three methods:
   - `'mode'` (`downscaleMode`) — most-frequent-color per block (recommended; handles JPEG artifacts via color bucketing)
   - `'center'` (`downscaleNearestNeighbor`) — samples center pixel of each block
   - `'average'` (`downscaleAverage`) — averages all pixels per block
4. Optional: `quantizeColors()` merges similar colors within a Manhattan-distance threshold
5. Optional: `detectBackgroundColor()` samples edge pixels → `removeBackgroundColor()` makes matching pixels transparent
6. `sliceIntoTiles()` cuts the downscaled image into sprites, optionally skipping empty tiles
7. Resulting `ImageData[]` is passed to `App.handleAIImport()` which assigns IDs/names via `spriteCounter` and appends to `sprites[]`; alternatively `App.handleAILoadAsTileset()` loads the downscaled image as the main tileset

Utility functions live in `src/utils/aiImport.ts`: `detectScaleFactor`, `downscaleImage`, `downscaleNearestNeighbor`, `downscaleMode`, `downscaleAverage`, `quantizeColors`, `detectBackgroundColor`, `removeBackgroundColor`, `sliceIntoTiles`, `isEmptyTile`.

### Styling

Tailwind CSS v4 via the `@tailwindcss/vite` plugin (no `tailwind.config.js`). The design uses a set of CSS custom-property-backed semantic tokens throughout: `bg-bg-panel`, `bg-bg-hover`, `bg-bg-primary`, `bg-bg-secondary`, `text-text-primary`, `text-text-secondary`, `text-text-muted`, `border-border-default`, `bg-accent`, `bg-accent-hover`. Use these tokens rather than raw Tailwind colors to stay consistent with the dark theme.

### Export format

`exportProject()` produces a `catpix_export.zip` containing:
- `spritesheet.png` — all sprites composited with 2px padding per side
- `spritesheet.json` — atlas with `meta` (app, version, size, tileSize, padding, layout) and `frames[]` (name, x, y, width, height)

### Keyboard shortcuts

- `D` — draw tool
- `E` — erase tool
- `Escape` — close modals (export, new project, AI import)
- Scroll wheel — zoom TilesetViewer
- Middle-click or Alt+left-click — pan TilesetViewer
