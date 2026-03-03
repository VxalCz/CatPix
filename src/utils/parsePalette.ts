/**
 * Parses palette files into an array of hex color strings.
 * Supports .hex (one RRGGBB per line) and .gpl (GIMP Palette) formats.
 */
export function parsePalette(content: string, filename: string): string[] {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'gpl' || content.trimStart().startsWith('GIMP Palette')) return parseGpl(content)
  return parseHex(content)
}

function parseHex(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trim().replace(/^#/, ''))
    .filter((line) => /^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(line))
    .map((hex) => `#${hex.slice(0, 6).toLowerCase()}`)
}

function parseGpl(content: string): string[] {
  const colors: string[] = []
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (
      !trimmed ||
      trimmed.startsWith('GIMP') ||
      trimmed.startsWith('Name:') ||
      trimmed.startsWith('Columns:') ||
      trimmed.startsWith('#')
    ) continue
    const parts = trimmed.split(/\s+/)
    if (parts.length >= 3) {
      const r = parseInt(parts[0])
      const g = parseInt(parts[1])
      const b = parseInt(parts[2])
      if (!isNaN(r) && !isNaN(g) && !isNaN(b) && r >= 0 && g >= 0 && b >= 0 && r <= 255 && g <= 255 && b <= 255) {
        colors.push(
          `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
        )
      }
    }
  }
  return colors
}
