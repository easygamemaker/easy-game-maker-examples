export type FruitType = 'melancia' | 'maca' | 'laranja' | 'abacaxy' | 'coco' | 'melao';
export type ZombieType = 'zumbiNormal' | 'zumbiVelho' | 'zumbiGordo' | 'zumbiKid' | 'zumbiMulher' | 'zumbiFortao';

export interface LaneConfig {
  zombies: ZombieType[];
  fruits: FruitType[];
  zombieStartX: number;
  zombieSpacing: number;
}

export interface LevelConfig {
  id: number;
  name: string;
  background: string;
  music: string;
  // Single-catapult (levels 1–3)
  zombies?: ZombieType[];
  fruits?: FruitType[];
  zombieStartX?: number;
  zombieSpacing?: number;
  zombieY?: number;
  // Dual-catapult (levels 4–5)
  dual?: { topLane: LaneConfig; bottomLane: LaneConfig };
  nextLevel: number | null;
}

export const CANVAS_W = 568;
export const CANVAS_H = 320;
export const WORLD_W = 1136;
export const CATAPULT_X = 170;
export const CATAPULT_Y = 255;
export const PPM = 50;

// Dual lane constants (each lane is 155px tall, 10px divider)
export const LANE_H = 155;
export const LANE_GAP = 10;
export const LANE_BOT_Y = LANE_H + LANE_GAP;       // 165 — canvas y where bottom lane starts
export const LANE_CAT_Y = 124;                       // catapult base y within a lane
export const LANE_ZOMBIE_Y = 110;                    // zombie center y within a lane
export const LANE_FLOOR_Y = 140;                     // floor physics y within a lane
export const LANE_ZOMBIE_START_X = 700;

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: 'Italy',
    background: 'assets/images/levels/italy2.fw.png',
    music: 'assets/audio/levels/italy.ogg',
    zombies: ['zumbiVelho', 'zumbiNormal'],
    fruits: ['coco', 'laranja', 'maca'],
    zombieStartX: 720, zombieSpacing: 180, zombieY: 235,
    nextLevel: 2,
  },
  {
    id: 2,
    name: 'Rio de Janeiro',
    background: 'assets/images/levels/rio.fw.png',
    music: 'assets/audio/levels/rio.ogg',
    zombies: ['zumbiMulher', 'zumbiNormal', 'zumbiKid'],
    fruits: ['abacaxy', 'melancia', 'maca', 'laranja'],
    zombieStartX: 700, zombieSpacing: 150, zombieY: 235,
    nextLevel: 3,
  },
  {
    id: 3,
    name: 'France',
    background: 'assets/images/levels/france.fw.png',
    music: 'assets/audio/levels/france.ogg',
    zombies: ['zumbiNormal', 'zumbiFortao', 'zumbiGordo'],
    fruits: ['melancia', 'abacaxy', 'maca', 'laranja', 'maca'],
    zombieStartX: 680, zombieSpacing: 155, zombieY: 235,
    nextLevel: 4,
  },
  {
    id: 4,
    name: 'New York',
    background: 'assets/images/levels/new york.fw.png',
    music: 'assets/audio/levels/new-york.ogg',
    zombies: ['zumbiNormal', 'zumbiGordo', 'zumbiVelho'],
    fruits: ['abacaxy', 'melancia', 'maca', 'laranja', 'abacaxy'],
    zombieStartX: 650, zombieSpacing: 150, zombieY: 235,
    nextLevel: null,  // TODO: restore to 5 when Favela/San Francisco are re-enabled
  },
  /* --- Dual-catapult levels (temporarily disabled) ---
  {
    id: 5,
    name: 'Favela',
    background: 'assets/images/levels/favela.fw.png',
    music: 'assets/audio/levels/rio.ogg',
    dual: {
      topLane: {
        zombies: ['zumbiNormal', 'zumbiGordo', 'zumbiVelho', 'zumbiNormal'],
        fruits: ['abacaxy', 'melancia', 'maca', 'laranja'],
        zombieStartX: 640, zombieSpacing: 120,
      },
      bottomLane: {
        zombies: ['zumbiGordo', 'zumbiVelho', 'zumbiNormal', 'zumbiGordo'],
        fruits: ['laranja', 'abacaxy', 'maca', 'laranja'],
        zombieStartX: 680, zombieSpacing: 115,
      },
    },
    nextLevel: 6,
  },
  {
    id: 6,
    name: 'San Francisco',
    background: 'assets/images/levels/san-francisco.fw.png',
    music: 'assets/audio/levels/new-york.ogg',
    dual: {
      topLane: {
        zombies: ['zumbiMulher', 'zumbiFortao', 'zumbiGordo', 'zumbiVelho', 'zumbiNormal'],
        fruits: ['melancia', 'abacaxy', 'coco', 'maca', 'laranja'],
        zombieStartX: 620, zombieSpacing: 110,
      },
      bottomLane: {
        zombies: ['zumbiNormal', 'zumbiGordo', 'zumbiFortao', 'zumbiMulher', 'zumbiKid'],
        fruits: ['abacaxy', 'melancia', 'laranja', 'coco', 'maca'],
        zombieStartX: 650, zombieSpacing: 108,
      },
    },
    nextLevel: null,
  },
  --- end disabled levels --- */
];

export function isLevelDual(cfg: LevelConfig): cfg is LevelConfig & { dual: NonNullable<LevelConfig['dual']> } {
  return cfg.dual != null;
}
