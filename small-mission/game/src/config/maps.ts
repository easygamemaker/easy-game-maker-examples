export const TILE_SIZE = 40;
export const MAP_COLS = 20;
export const MAP_ROWS = 15;

export const MAP_GRID: number[][] = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1,0,1],
  [1,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,1],
  [1,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,1],
  [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
  [1,0,0,0,0,0,1,0,0,1,1,0,0,1,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,1,0,0,1,1,0,0,1,0,0,0,0,0,1],
  [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
  [1,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,1],
  [1,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,1],
  [1,0,1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

export const SPAWN_POINTS = [
  { x: 60,  y: 60  },
  { x: 740, y: 60  },
  { x: 60,  y: 540 },
  { x: 740, y: 540 },
  { x: 140, y: 300 },
  { x: 660, y: 300 },
];

export const INITIAL_AMMO_POSITIONS = [
  { x: 180, y: 140 },
  { x: 620, y: 140 },
  { x: 340, y: 260 },
  { x: 460, y: 340 },
  { x: 180, y: 460 },
  { x: 620, y: 460 },
];

export function isWallAt(px: number, py: number): boolean {
  const col = Math.floor(px / TILE_SIZE);
  const row = Math.floor(py / TILE_SIZE);
  if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return true;
  return MAP_GRID[row]![col] === 1;
}

/** Check horizontal movement — uses full radius on X, reduced on Y (enables wall sliding). */
export function isCircleInWallX(cx: number, cy: number, radius: number): boolean {
  const ry = radius * 0.55; // narrower Y probe allows sliding near horizontal walls
  return (
    isWallAt(cx - radius, cy) || isWallAt(cx + radius, cy) ||
    isWallAt(cx - radius, cy - ry) || isWallAt(cx + radius, cy - ry) ||
    isWallAt(cx - radius, cy + ry) || isWallAt(cx + radius, cy + ry)
  );
}

/** Check vertical movement — uses full radius on Y, reduced on X (enables wall sliding). */
export function isCircleInWallY(cx: number, cy: number, radius: number): boolean {
  const rx = radius * 0.55;
  return (
    isWallAt(cx, cy - radius) || isWallAt(cx, cy + radius) ||
    isWallAt(cx - rx, cy - radius) || isWallAt(cx + rx, cy - radius) ||
    isWallAt(cx - rx, cy + radius) || isWallAt(cx + rx, cy + radius)
  );
}

/** Legacy full check (server-side bullet collision). */
export function isCircleInWall(cx: number, cy: number, radius: number): boolean {
  return isCircleInWallX(cx, cy, radius) || isCircleInWallY(cx, cy, radius);
}
