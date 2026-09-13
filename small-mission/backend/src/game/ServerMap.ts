const TILE_SIZE = 40;

const MAP_GRID: number[][] = [
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

export function isWallAt(px: number, py: number): boolean {
  const col = Math.floor(px / TILE_SIZE);
  const row = Math.floor(py / TILE_SIZE);
  if (row < 0 || row >= MAP_GRID.length || col < 0 || col >= (MAP_GRID[0]?.length ?? 0)) return true;
  return MAP_GRID[row]![col] === 1;
}

export function isCircleInWall(cx: number, cy: number, radius: number): boolean {
  const offsets = [
    [0, -radius], [0, radius], [-radius, 0], [radius, 0],
    [-radius * 0.7, -radius * 0.7], [radius * 0.7, -radius * 0.7],
    [-radius * 0.7, radius * 0.7], [radius * 0.7, radius * 0.7],
  ];
  return offsets.some(([dx, dy]) => isWallAt(cx + dx!, cy + dy!));
}
