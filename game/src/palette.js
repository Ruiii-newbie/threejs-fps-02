// Palette: dark slate blue-grey + amber accents + teal site markers. One source of truth.
export const PALETTE = {
  canvas: '#1a222b', surface: '#1e262f', hairline: '#2c3642', ink: '#e9e6df',
  muted: '#8b98a5', accent: '#f0a830', teal: '#2fb8a6', red: '#e0533d',
  blue: '#3f8cff', amber: '#f0a830', floor: '#2b343e', wall: '#343e49',
  crate: '#5a4a33', container: '#7a5a28', containerB: '#2e6b62', dark: '#161c22',
};
export function shade(n) { return PALETTE[n]; }
