/**
 * Which KMA grid square an apartment is in. From .env:
 *   WEATHER_GRID=60,127                                   default for every apartment (Seoul)
 *   WEATHER_GRIDS={"Raemian Gwanggyo":"62,120"}           optional per-apartment overrides (JSON)
 */
export interface GridConfig {
  fallback: string;
  byApartment: Map<string, string>;
}

const GRID_RE = /^\s*(\d{1,3})\s*,\s*(\d{1,3})\s*$/;

export function readGrids(env: { WEATHER_GRID?: string; WEATHER_GRIDS?: string }): GridConfig {
  const fallback = GRID_RE.test(env.WEATHER_GRID ?? '') ? normalize(env.WEATHER_GRID!) : '60,127';
  const byApartment = new Map<string, string>();
  if (env.WEATHER_GRIDS) {
    try {
      const parsed = JSON.parse(env.WEATHER_GRIDS) as Record<string, string>;
      for (const [name, grid] of Object.entries(parsed)) {
        if (GRID_RE.test(grid)) byApartment.set(name.trim().toLowerCase(), normalize(grid));
      }
    } catch {
      // invalid JSON: every apartment uses the default grid
    }
  }
  return { fallback, byApartment };
}

export const gridFor = (config: GridConfig, apartmentName?: string) =>
  config.byApartment.get((apartmentName ?? '').trim().toLowerCase()) ?? config.fallback;

export const allGrids = (config: GridConfig) => [...new Set([config.fallback, ...config.byApartment.values()])];

export const parseGrid = (grid: string) => {
  const [nx, ny] = grid.split(',').map(Number);
  return { nx, ny };
};

function normalize(grid: string) {
  const m = grid.match(GRID_RE)!;
  return `${Number(m[1])},${Number(m[2])}`;
}
