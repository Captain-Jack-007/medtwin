// Single source of truth for the tile provider (spec §33). Kept abstracted so
// production can later swap OSM public tiles for self-hosted / another provider
// without touching component code. No API key required.
export const MAP_TILE_CONFIG = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
} as const;

// Navoiy region default framing.
export const NAVOIY_DEFAULT = {
  center: [40.6, 64.9] as [number, number],
  zoom: 7,
};
