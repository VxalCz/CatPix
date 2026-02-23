export interface PresetPalette {
  name: string
  colors: string[]
}

export const presetPalettes: PresetPalette[] = [
  {
    name: 'GameBoy',
    colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  },
  {
    name: 'PICO-8',
    colors: [
      '#000000', '#1d2b53', '#7e2553', '#008751',
      '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
      '#ff004d', '#ffa300', '#ffec27', '#00e436',
      '#29adff', '#83769c', '#ff77a8', '#ffccaa',
    ],
  },
  {
    name: 'Endesga 16',
    colors: [
      '#e4a672', '#b86f50', '#743f39', '#3f2832',
      '#9e2835', '#e53b44', '#fb922b', '#ffe762',
      '#63c64d', '#327345', '#193d3f', '#4f6781',
      '#afbfd2', '#ffffff', '#2ce8f4', '#0484d1',
    ],
  },
]
