import { Group, RectShape } from 'easy-game-maker';
import { MAP_GRID, TILE_SIZE, MAP_COLS, MAP_ROWS } from '../config/maps';

const FLOOR_A  = '#1e2a1e';
const FLOOR_B  = '#1a261a';
const WALL_BASE = '#2c2c3c';
const WALL_TOP  = '#484860';
const WALL_SHADOW = '#0a0a0f';

export class MapRenderer extends Group {
  constructor() {
    super();
    this._build();
  }

  private _build(): void {
    // Floor (checkerboard pattern)
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (MAP_GRID[row]![col] === 1) continue;
        const color = (row + col) % 2 === 0 ? FLOOR_A : FLOOR_B;
        const tile = new RectShape({
          x: col * TILE_SIZE, y: row * TILE_SIZE,
          width: TILE_SIZE, height: TILE_SIZE,
          fill: color,
        });
        tile.anchorX = 0; tile.anchorY = 0;
        this.add(tile);
      }
    }

    // Wall shadows (offset rect beneath wall)
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (MAP_GRID[row]![col] !== 1) continue;
        const shadow = new RectShape({
          x: col * TILE_SIZE + 3,
          y: row * TILE_SIZE + 3,
          width: TILE_SIZE,
          height: TILE_SIZE,
          fill: WALL_SHADOW,
        });
        shadow.anchorX = 0; shadow.anchorY = 0;
        this.add(shadow);
      }
    }

    // Wall base
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (MAP_GRID[row]![col] !== 1) continue;
        const wall = new RectShape({
          x: col * TILE_SIZE,
          y: row * TILE_SIZE,
          width: TILE_SIZE,
          height: TILE_SIZE,
          fill: WALL_BASE,
        });
        wall.anchorX = 0; wall.anchorY = 0;
        this.add(wall);

        // Top highlight edge (gives 3D depth illusion)
        const top = new RectShape({
          x: col * TILE_SIZE,
          y: row * TILE_SIZE,
          width: TILE_SIZE,
          height: 5,
          fill: WALL_TOP,
        });
        top.anchorX = 0; top.anchorY = 0;
        this.add(top);

        // Left highlight edge
        const left = new RectShape({
          x: col * TILE_SIZE,
          y: row * TILE_SIZE,
          width: 3,
          height: TILE_SIZE,
          fill: WALL_TOP,
        });
        left.anchorX = 0; left.anchorY = 0;
        this.add(left);
      }
    }
  }
}
